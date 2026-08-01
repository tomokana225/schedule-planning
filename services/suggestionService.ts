import { Lesson, Placement, SlotKey } from '../types';
import { isValidPlacement, SchedulerContext } from './scheduler';
import { generateId, maxPeriodsAcrossDays, periodsForDay } from '../utils';

const lessonSpan = (lessons: Map<string, Lesson>, placement: Placement): number =>
  lessons.get(placement.lessonId)?.consecutive ?? 1;

const occupantAt = (placements: Placement[], lessons: Map<string, Lesson>, day: number, period: number): Placement | undefined =>
  placements.find(p => p.day === day && period >= p.period && period < p.period + lessonSpan(lessons, p));

export interface MoveSuggestion {
  kind: 'move';
  day: number;
  period: number;
}

export interface SwapSuggestion {
  kind: 'swap';
  targetPlacementId: string;
  day: number;
  period: number;
  label: string; // description of what's currently there, for display
}

export type Suggestion = MoveSuggestion | SwapSuggestion;

// 振替提案・移動提案 (AI手直し): 未配置の授業を置ける空きコマの候補を返す
export const suggestSlotsForLesson = (
  ctx: SchedulerContext,
  placements: Placement[],
  lesson: Lesson,
  limit = 6,
): MoveSuggestion[] => {
  const results: MoveSuggestion[] = [];
  for (let day = 0; day < ctx.settings.days.length && results.length < limit; day++) {
    for (let period = 1; period <= maxPeriodsAcrossDays(ctx.settings) && results.length < limit; period++) {
      if (isValidPlacement(ctx, placements, lesson, day, period, new Set())) {
        results.push({ kind: 'move', day, period });
      }
    }
  }
  return results;
};

// 振替提案・移動提案 (AI手直し): 配置済みの駒について、移動できる空きコマ・
// 入れ替えできる相手の駒を提案する。
export const suggestMovesForPlacement = (
  ctx: SchedulerContext,
  placements: Placement[],
  placementId: string,
  labelForPlacement: (p: Placement) => string,
  limit = 6,
): Suggestion[] => {
  const lessonsMap = new Map(ctx.lessons.map(l => [l.id, l]));
  const source = placements.find(p => p.id === placementId);
  if (!source || source.confirmed) return [];
  const sourceLesson = lessonsMap.get(source.lessonId);
  if (!sourceLesson) return [];

  const results: Suggestion[] = [];
  const excludeSelf = new Set([source.id]);

  for (let day = 0; day < ctx.settings.days.length && results.length < limit; day++) {
    for (let period = 1; period <= maxPeriodsAcrossDays(ctx.settings) && results.length < limit; period++) {
      if (day === source.day && period === source.period) continue;
      const occupant = occupantAt(placements, lessonsMap, day, period);

      if (!occupant) {
        if (isValidPlacement(ctx, placements, sourceLesson, day, period, excludeSelf)) {
          results.push({ kind: 'move', day, period });
        }
      } else if (occupant.id !== source.id && !occupant.confirmed && occupant.period === period) {
        const targetLesson = lessonsMap.get(occupant.lessonId);
        if (!targetLesson) continue;
        const exclude = new Set([source.id, occupant.id]);
        const sourceCanGo = isValidPlacement(ctx, placements, sourceLesson, occupant.day, occupant.period, exclude);
        const targetCanGo = isValidPlacement(ctx, placements, targetLesson, source.day, source.period, exclude);
        if (sourceCanGo && targetCanGo) {
          results.push({
            kind: 'swap',
            targetPlacementId: occupant.id,
            day, period,
            label: labelForPlacement(occupant),
          });
        }
      }
    }
  }

  return results;
};

export const slotLabel = (days: string[], day: number, period: number): string => `${days[day]}${period}限`;

export interface GapPlan {
  lessonId: string;
  // 対象マスに直接置く前に、そこを塞いでいる既存の駒を退避させる必要がある場合のみ設定
  blocker?: { placementId: string; day: number; period: number };
}

export interface GapDiagnosis {
  message: string;
  plan?: GapPlan; // 存在する場合のみワンクリックで自動解決できる
}

// 空きコマ（一括表のエラー）の原因を診断する: そのクラスにまだ配置されていない
// 授業があるか、あればそのマスへ直接置けるか、置けない場合は単一の駒をどかせば
// 置けるようになるかを調べ、可能ならワンクリックで適用できる解決プランを返す。
export const diagnoseGap = (
  ctx: SchedulerContext,
  placements: Placement[],
  classId: string,
  day: number,
  period: number,
  labelForLesson: (lesson: Lesson) => string,
  labelForPlacement: (p: Placement) => string,
): GapDiagnosis => {
  const { settings, lessons } = ctx;
  const lessonById = new Map(lessons.map(l => [l.id, l]));

  const unplacedForClass = lessons
    .filter(l => l.classIds.includes(classId))
    .map(lesson => ({ lesson, remaining: lesson.weeklyCount - placements.filter(p => p.lessonId === lesson.id).length }))
    .filter(x => x.remaining > 0);

  if (unplacedForClass.length === 0) {
    return {
      message: 'このクラスの授業はすべて配置済みです。週の総コマ数が時間割の枠数より少ないため空きになっている可能性があります。授業設定画面でこのクラスの週コマ数を見直してください。',
    };
  }

  // 1. まずこのマスへ直接置ける未配置授業がないか
  for (const { lesson } of unplacedForClass) {
    if (isValidPlacement(ctx, placements, lesson, day, period, new Set())) {
      return {
        message: `「${labelForLesson(lesson)}」が未配置です。このマスに配置できます。`,
        plan: { lessonId: lesson.id },
      };
    }
  }

  // 2. 直接は置けないが、このマスにある既存の駒を1つだけどかせば置けるようにならないか
  const allSlots = Array.from({ length: settings.days.length }, (_, d) => d)
    .flatMap(d => Array.from({ length: periodsForDay(settings, d) }, (_, idx) => ({ day: d, period: idx + 1 })));

  for (const { lesson } of unplacedForClass) {
    const targetEnd = period + lesson.consecutive - 1;
    if (targetEnd > periodsForDay(settings, day)) continue; // そもそもこの曜日にその時限数が収まらない

    const blockers = placements.filter(p => {
      if (p.confirmed || p.day !== day) return false;
      const l = lessonById.get(p.lessonId);
      if (!l) return false;
      const otherEnd = p.period + l.consecutive - 1;
      if (period > otherEnd || p.period > targetEnd) return false; // 重なっていない
      return l.classIds.some(c => lesson.classIds.includes(c))
        || l.teacherIds.some(t => lesson.teacherIds.includes(t))
        || l.roomIds.some(r => lesson.roomIds.includes(r));
    });
    if (blockers.length !== 1) continue; // 単純な単一障害物のケースのみ対象にする
    const blocker = blockers[0];
    const blockerLesson = lessonById.get(blocker.lessonId);
    if (!blockerLesson) continue;

    const exclude = new Set([blocker.id]);
    if (!isValidPlacement(ctx, placements, lesson, day, period, exclude)) continue;

    const altSlot = allSlots.find(s =>
      !(s.day === day && s.period <= targetEnd && s.period + blockerLesson.consecutive - 1 >= period)
      && isValidPlacement(ctx, placements, blockerLesson, s.day, s.period, exclude),
    );
    if (!altSlot) continue;

    return {
      message: `「${labelForLesson(lesson)}」が未配置です。このマスには現在「${labelForPlacement(blocker)}」が入っていますが、`
        + `${slotLabel(settings.days, altSlot.day, altSlot.period)}に移動すれば空けられます。`,
      plan: { lessonId: lesson.id, blocker: { placementId: blocker.id, day: altSlot.day, period: altSlot.period } },
    };
  }

  return {
    message: 'このクラスに未配置の授業がありますが、禁制条件や他の授業との競合により、このマスへ自動で配置する方法が見つかりませんでした。個別条件（禁制設定）を見直すか、手動で駒を調整してください。',
  };
};

// diagnoseGap が返した解決プランを、現在の placements に適用した新しい配列を返す。
export const applyGapFix = (placements: Placement[], plan: GapPlan, day: number, period: number): Placement[] => {
  let next = placements;
  if (plan.blocker) {
    next = next.map(p => (p.id === plan.blocker!.placementId ? { ...p, day: plan.blocker!.day, period: plan.blocker!.period } : p));
  }
  return [...next, { id: generateId(), lessonId: plan.lessonId, day, period, confirmed: false }];
};

export type { SlotKey };
