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

// Summarizes an arbitrary placements array the same way attempt()/repairRemainingOnce()
// do, so an existing schedule can be compared against freshly generated ones on equal terms.
const summarizeUnplaced = (lessons: Lesson[], placements: Placement[]): { lessonId: string; count: number }[] => {
  const placedCount = new Map<string, number>();
  for (const p of placements) placedCount.set(p.lessonId, (placedCount.get(p.lessonId) || 0) + 1);
  return lessons
    .map(l => ({ lessonId: l.id, count: l.weeklyCount - (placedCount.get(l.id) || 0) }))
    .filter(u => u.count > 0);
};

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
// 「残り駒0になるまで実行時間の設定に関わらず粘る」処理を、時間の設定自体を
// 無意味にするほど重くせずに行える。
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

    // Crucial: confirm the target lesson would actually be valid at (day, period)
    // once this one blocker is out of the way — the blocker being the sole
    // *placement* conflict there does NOT mean the slot is otherwise open; it
    // could still violate 禁制 (unavailable), a 会議, maxPerDay, etc. Without
    // this check the repair would blindly place the lesson into a forbidden
    // slot as long as exactly one other placement happened to be there too.
    const excludeBlocker = new Set([blocker.id]);
    if (!isValidPlacement(ctx, placements, lesson, day, period, excludeBlocker)) return false;

    const altSlot = shuffle(allSlots).find(s =>
      !(s.day === day && s.period <= targetEnd && s.period + blockerLesson.consecutive - 1 >= period)
      && isValidPlacement(ctx, placements, blockerLesson, s.day, s.period, excludeBlocker),
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

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const totalUnplaced = (r: RunResult): number => r.unplaced.reduce((s, u) => s + u.count, 0);

// Runs the auto-assignment (駒入れ), keeping any already-confirmed placements fixed,
// and keeps trying randomized attempts within the configured time budget (実行時間、秒),
// keeping whichever leaves the fewest lessons unplaced and stopping early the moment
// one reaches 0 残り駒. The configured seconds is the actual, sole cap for this phase —
// increasing it in the UI directly increases how long attempts keep running.
//
// Each round does one fresh full random attempt, then (if time remains) one repair pass
// against whichever result is currently best — rather than a fixed split where a whole
// half of the budget is committed to fresh attempts and the other half to repair. A rigid
// split can waste large stretches of a long budget: if the residual unplaced lessons only
// ever have multiple blocking placements at every candidate slot, repairRemainingOnce's
// single-blocker heuristic can never succeed no matter how many rounds it gets, so a fixed
// repair half is pure dead time that fresh attempts could have used instead (this showed up
// as longer time budgets not improving results, while many short repeated runs did better —
// each short run wasted only a small, proportional slice on unproductive repair instead of
// a large fixed block of it). Interleaving keeps both phases perpetually earning their share
// of the budget based on whether they're actually helping, for any dataset shape.
//
// `best` is seeded with the schedule that's already on screen (existingPlacements), not
// just its confirmed subset, so re-running can never silently hand back something worse:
// a fresh attempt or repair pass only replaces it once it's a genuine improvement in 残り駒.
// Without this, every click was a gamble — a worse random attempt could overwrite an
// already-good (or already-complete) schedule, which is what made "just keep clicking a
// short run and stop when it looks good" feel more reliable than one longer run.
export const runScheduler = (ctx: SchedulerContext, existingPlacements: Placement[]): RunResult => {
  const keepConfirmed = existingPlacements.filter(p => p.confirmed);
  const budgetMs = (ctx.options?.maxSeconds ?? 15) * 1000;
  const start = now();

  let best: RunResult = { placements: existingPlacements, unplaced: summarizeUnplaced(ctx.lessons, existingPlacements) };
  if (totalUnplaced(best) === 0) return best;

  do {
    const result = attempt(ctx, keepConfirmed);
    if (totalUnplaced(result) < totalUnplaced(best)) best = result;
    if (totalUnplaced(best) === 0) break;

    if (now() - start < budgetMs) {
      const repaired = repairRemainingOnce(ctx, best);
      if (totalUnplaced(repaired) < totalUnplaced(best)) best = repaired;
      if (totalUnplaced(best) === 0) break;
    }
  } while (now() - start < budgetMs);

  return best;
};
