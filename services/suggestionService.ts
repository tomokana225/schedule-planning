import { Lesson, Placement, SlotKey } from '../types';
import { isValidPlacement, SchedulerContext } from './scheduler';
import { maxPeriodsAcrossDays } from '../utils';

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

export type { SlotKey };
