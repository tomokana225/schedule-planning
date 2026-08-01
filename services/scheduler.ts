import {
  Lesson, Placement, SchoolClass, Subject, Teacher, Room, TimetableSettings, SchedulerOptions,
  DEFAULT_SCHEDULER_OPTIONS, Meeting,
} from '../types';
import { generateId, hasSlot, periodsForDay, maxPeriodsAcrossDays } from '../utils';

export interface SchedulerContext {
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  lessons: Lesson[];
  options?: SchedulerOptions;
  meetings?: Meeting[]; // 会議の簡単設定: 指定した曜日・時限・先生（・教室）を拘束する
  isBandMode?: boolean; // 帯時間割の作成中か（1本の連続した枠として扱い、1日あたりの上限は適用しない）
}

const lessonMap = (lessons: Lesson[]) => new Map(lessons.map(l => [l.id, l]));

// Checks whether `lesson` can occupy [period, period+consecutive-1] on `day`,
// given the placements already made (excluding any ids in `excludeIds`).
export const isValidPlacement = (
  ctx: SchedulerContext,
  placements: Placement[],
  lesson: Lesson,
  day: number,
  period: number,
  excludeIds: Set<string> = new Set(),
): boolean => {
  const { settings, teachers, subjects, classes, rooms, meetings = [] } = ctx;
  const options = ctx.options ?? DEFAULT_SCHEDULER_OPTIONS();
  const lessons = lessonMap(ctx.lessons);
  // 帯時間割は曜日ごとの時限数という概念がない単一の連続枠なので、通常の
  // periodsPerDay をそのまま使う（曜日ごとの例外は通常の時間割にのみ適用）。
  const dayPeriodCount = ctx.isBandMode ? settings.periodsPerDay : periodsForDay(settings, day);
  if (period + lesson.consecutive - 1 > dayPeriodCount) return false;

  const periods = Array.from({ length: lesson.consecutive }, (_, i) => period + i);
  const targetEnd = period + lesson.consecutive - 1;

  // Overlap check against existing placements: compares full [start, end] spans
  // rather than just exact start-period equality, so a 2-period placement's
  // *second* period is also caught as a conflict (not just placements that
  // happen to start on the exact same period).
  for (const other of placements) {
    if (excludeIds.has(other.id) || other.day !== day) continue;
    const otherLesson = lessons.get(other.lessonId);
    if (!otherLesson) continue;
    const otherEnd = other.period + otherLesson.consecutive - 1;
    if (period > otherEnd || other.period > targetEnd) continue; // no overlap
    if (otherLesson.classIds.some(c => lesson.classIds.includes(c))) return false;
    if (otherLesson.teacherIds.some(t => lesson.teacherIds.includes(t))) return false;
    if (otherLesson.roomIds.some(r => lesson.roomIds.includes(r))) return false;
  }

  for (const p of periods) {
    // Teacher/class/subject/room unavailable times (禁制)
    for (const teacherId of lesson.teacherIds) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher && hasSlot(teacher.unavailable, day, p)) return false;
    }
    for (const classId of lesson.classIds) {
      const cls = classes.find(c => c.id === classId);
      if (cls && hasSlot(cls.unavailable, day, p)) return false;
    }
    for (const roomId of lesson.roomIds) {
      const room = rooms.find(r => r.id === roomId);
      if (room && hasSlot(room.unavailable, day, p)) return false;
    }
    const subjectForSlot = subjects.find(s => s.id === lesson.subjectId);
    if (subjectForSlot && hasSlot(subjectForSlot.unavailable, day, p)) return false;

    // 会議の簡単設定: 会議に参加する先生・使用する教室の時限は授業を入れられない
    for (const meeting of meetings) {
      if (meeting.day !== day || meeting.period !== p) continue;
      if (meeting.teacherIds.some(t => lesson.teacherIds.includes(t))) return false;
      if (meeting.roomId && lesson.roomIds.includes(meeting.roomId)) return false;
    }
  }

  // Teacher max lessons per day / Subject max-per-day-per-class:
  // both are meaningless on the 帯時間割's single long linear band, so skip them in band mode.
  if (!ctx.isBandMode) {
    for (const teacherId of lesson.teacherIds) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (!teacher?.maxPerDay) continue;
      const countThatDay = placements.filter(pl => {
        if (excludeIds.has(pl.id) || pl.day !== day) return false;
        const l = lessons.get(pl.lessonId);
        return l?.teacherIds.includes(teacherId);
      }).length;
      if (countThatDay + 1 > teacher.maxPerDay) return false;
    }

    const subject = subjects.find(s => s.id === lesson.subjectId);
    const maxPerDay = subject?.maxPerDayPerClass ?? 1;
    for (const classId of lesson.classIds) {
      const countThatDay = placements.filter(pl => {
        if (excludeIds.has(pl.id) || pl.day !== day) return false;
        const l = lessons.get(pl.lessonId);
        return l?.subjectId === lesson.subjectId && l.classIds.includes(classId);
      }).length;
      if (countThatDay + 1 > maxPerDay) return false;
    }
  }

  // 全体オプション: 同じ科目を連続時限に置かない
  if (options.avoidConsecutiveSameSubject) {
    const adjacentPeriods = [periods[0] - 1, periods[periods.length - 1] + 1];
    for (const classId of lesson.classIds) {
      const hasAdjacentSameSubject = placements.some(pl => {
        if (excludeIds.has(pl.id) || pl.day !== day || !adjacentPeriods.includes(pl.period)) return false;
        const l = lessons.get(pl.lessonId);
        return l?.subjectId === lesson.subjectId && l.classIds.includes(classId);
      });
      if (hasAdjacentSameSubject) return false;
    }
  }

  return true;
};

interface RunResult {
  placements: Placement[];
  unplaced: { lessonId: string; count: number }[];
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const difficultyScore = (lesson: Lesson, teachers: Teacher[]): number => {
  let score = lesson.classIds.length + lesson.teacherIds.length + lesson.roomIds.length;
  for (const tid of lesson.teacherIds) {
    const t = teachers.find(x => x.id === tid);
    if (t) score += t.unavailable.length * 0.5 + (t.maxPerDay ? 2 : 0);
  }
  return score;
};

const attempt = (ctx: SchedulerContext, keepConfirmed: Placement[]): RunResult => {
  const { settings, teachers, lessons } = ctx;
  const options = ctx.options ?? DEFAULT_SCHEDULER_OPTIONS();
  const placements: Placement[] = [...keepConfirmed];
  const unplacedCount = new Map<string, number>();

  // Tracks total placements already made per class per day, used for the
  // "曜日ごとに均等分散させる" option so lessons prefer the day where the
  // class currently has the fewest lessons scheduled.
  const classDayLoad = new Map<string, number>();
  const loadKey = (classId: string, day: number) => `${classId}-${day}`;
  for (const p of placements) {
    const l = lessons.find(x => x.id === p.lessonId);
    if (!l) continue;
    for (const classId of l.classIds) {
      const key = loadKey(classId, p.day);
      classDayLoad.set(key, (classDayLoad.get(key) || 0) + 1);
    }
  }

  // 指定（選択）授業を先入れ: priority が付いた授業を、通常の難易度順より先に配置する
  const orderedLessons = shuffle(lessons)
    .slice()
    .sort((a, b) => {
      const priorityDiff = (b.priority ? 1 : 0) - (a.priority ? 1 : 0);
      if (priorityDiff !== 0) return priorityDiff;
      return difficultyScore(b, teachers) - difficultyScore(a, teachers);
    });

  for (const lesson of orderedLessons) {
    const alreadyConfirmed = placements.filter(p => p.lessonId === lesson.id).length;
    const remaining = lesson.weeklyCount - alreadyConfirmed;
    const usedDays = new Set(placements.filter(p => p.lessonId === lesson.id).map(p => p.day));

    for (let i = 0; i < remaining; i++) {
      const dayIndexes = shuffle(settings.days.map((_, idx) => idx));
      const dayOrder = dayIndexes.sort((a, b) => {
        const usedDiff = (usedDays.has(a) ? 1 : 0) - (usedDays.has(b) ? 1 : 0);
        if (usedDiff !== 0) return usedDiff;
        if (!options.spreadEvenly) return 0;
        const loadA = Math.max(...lesson.classIds.map(c => classDayLoad.get(loadKey(c, a)) || 0), 0);
        const loadB = Math.max(...lesson.classIds.map(c => classDayLoad.get(loadKey(c, b)) || 0), 0);
        return loadA - loadB;
      });
      const periodOrder = shuffle(Array.from({ length: maxPeriodsAcrossDays(settings) }, (_, idx) => idx + 1));

      let placed = false;
      for (const day of dayOrder) {
        for (const period of periodOrder) {
          if (isValidPlacement(ctx, placements, lesson, day, period)) {
            placements.push({ id: generateId(), lessonId: lesson.id, day, period, confirmed: false });
            usedDays.add(day);
            for (const classId of lesson.classIds) {
              const key = loadKey(classId, day);
              classDayLoad.set(key, (classDayLoad.get(key) || 0) + 1);
            }
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) {
        unplacedCount.set(lesson.id, (unplacedCount.get(lesson.id) || 0) + 1);
      }
    }
  }

  return {
    placements,
    unplaced: Array.from(unplacedCount.entries()).map(([lessonId, count]) => ({ lessonId, count })),
  };
};

// 全試行の中で最良だった結果に残った未配置授業だけを対象に、直接の空きコマ探索と、
// 1つだけ既存の駒をどかす簡易ローカルサーチで置き場所を探す。ランダム再試行を
// 全体でやり直すのではなく、実際に残った少数の未配置だけに絞ることで、
// 「残り駒0になるまで試行回数の設定に関わらず粘る」処理を、試行回数の設定自体を
// 無意味にするほど重くせずに行える。
const REPAIR_ALL_TIME_BUDGET_MS = 10000;
const REPAIR_ROUNDS = 30;

const repairRemainingOnce = (ctx: SchedulerContext, result: RunResult): RunResult => {
  const { settings, lessons } = ctx;
  const lessonById = lessonMap(lessons);
  const placements = [...result.placements];
  const stillUnplaced = new Map<string, number>();

  const allSlots = Array.from({ length: settings.days.length }, (_, day) => day)
    .flatMap(day => Array.from({ length: periodsForDay(settings, day) }, (_, idx) => ({ day, period: idx + 1 })));

  const tryRepairAt = (lesson: Lesson, day: number, period: number): boolean => {
    const targetEnd = period + lesson.consecutive - 1;
    const blockers = placements.filter(p => {
      if (p.confirmed || p.day !== day) return false;
      const l = lessonById.get(p.lessonId);
      if (!l) return false;
      const otherEnd = p.period + l.consecutive - 1;
      if (period > otherEnd || p.period > targetEnd) return false; // no overlap
      return l.classIds.some(c => lesson.classIds.includes(c))
        || l.teacherIds.some(t => lesson.teacherIds.includes(t))
        || l.roomIds.some(r => lesson.roomIds.includes(r));
    });
    if (blockers.length !== 1) return false; // only the simple single-blocker case is worth the risk
    const blocker = blockers[0];
    const blockerLesson = lessonById.get(blocker.lessonId);
    if (!blockerLesson) return false;
    const exclude = new Set([blocker.id]);
    const altSlot = shuffle(allSlots).find(s =>
      !(s.day === day && s.period <= targetEnd && s.period + blockerLesson.consecutive - 1 >= period)
      && isValidPlacement(ctx, placements, blockerLesson, s.day, s.period, exclude),
    );
    if (!altSlot) return false;
    const idx = placements.findIndex(p => p.id === blocker.id);
    placements[idx] = { ...blocker, day: altSlot.day, period: altSlot.period };
    return true;
  };

  for (const { lessonId, count } of result.unplaced) {
    const lesson = lessonById.get(lessonId);
    if (!lesson) continue;
    let remaining = count;
    for (let i = 0; i < count; i++) {
      let placed = false;
      for (const slot of shuffle(allSlots)) {
        if (isValidPlacement(ctx, placements, lesson, slot.day, slot.period)) {
          placements.push({ id: generateId(), lessonId, day: slot.day, period: slot.period, confirmed: false });
          placed = true;
          break;
        }
      }
      if (!placed) {
        for (const slot of shuffle(allSlots)) {
          if (tryRepairAt(lesson, slot.day, slot.period)) {
            placements.push({ id: generateId(), lessonId, day: slot.day, period: slot.period, confirmed: false });
            placed = true;
            break;
          }
        }
      }
      if (placed) remaining--;
    }
    if (remaining > 0) stillUnplaced.set(lessonId, remaining);
  }

  return {
    placements,
    unplaced: Array.from(stillUnplaced.entries()).map(([lessonId, count]) => ({ lessonId, count })),
  };
};

// Runs the auto-assignment (駒入れ), keeping any already-confirmed placements fixed,
// and tries up to 試行回数 (maxAttempts) randomized attempts, keeping whichever leaves
// the fewest lessons unplaced and stopping early the moment one reaches 0 残り駒. The
// configured count is the actual, sole cap for this phase — increasing it in the UI
// directly increases how many attempts run (and how long it can take).
//
// If the best attempt still has leftovers, a second phase repeatedly tries to place
// just those remaining lessons (direct search + single-blocker local repair) against
// the best full schedule found — bounded by its own time budget — so 残り駒 keeps
// shrinking toward 0 for every teacher/class without redoing the whole random search.
export const runScheduler = (ctx: SchedulerContext, existingPlacements: Placement[]): RunResult => {
  const keepConfirmed = existingPlacements.filter(p => p.confirmed);
  const attempts = ctx.options?.maxAttempts ?? 25;
  let best: RunResult | null = null;

  for (let i = 0; i < attempts; i++) {
    const result = attempt(ctx, keepConfirmed);
    const unplacedTotal = result.unplaced.reduce((s, u) => s + u.count, 0);
    if (!best || unplacedTotal < best.unplaced.reduce((s, u) => s + u.count, 0)) {
      best = result;
      if (unplacedTotal === 0) break;
    }
  }

  let bestUnplaced = best!.unplaced.reduce((s, u) => s + u.count, 0);
  if (bestUnplaced > 0) {
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const start = now();
    for (let round = 0; round < REPAIR_ROUNDS && bestUnplaced > 0 && now() - start < REPAIR_ALL_TIME_BUDGET_MS; round++) {
      const repaired = repairRemainingOnce(ctx, best!);
      const repairedUnplaced = repaired.unplaced.reduce((s, u) => s + u.count, 0);
      if (repairedUnplaced < bestUnplaced) {
        best = repaired;
        bestUnplaced = repairedUnplaced;
      }
    }
  }

  return best!;
};
