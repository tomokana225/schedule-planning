import {
  Lesson, Placement, SchoolClass, Subject, Teacher, Room, TimetableSettings, SchedulerOptions,
  DEFAULT_SCHEDULER_OPTIONS, Meeting,
} from '../types';
import { generateId, hasSlot } from '../utils';

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
  if (period + lesson.consecutive - 1 > settings.periodsPerDay) return false;

  const periods = Array.from({ length: lesson.consecutive }, (_, i) => period + i);

  for (const p of periods) {
    for (const other of placements) {
      if (excludeIds.has(other.id)) continue;
      if (other.day !== day || other.period !== p) continue;
      const otherLesson = lessons.get(other.lessonId);
      if (!otherLesson) continue;
      if (otherLesson.classIds.some(c => lesson.classIds.includes(c))) return false;
      if (otherLesson.teacherIds.some(t => lesson.teacherIds.includes(t))) return false;
      if (otherLesson.roomIds.some(r => lesson.roomIds.includes(r))) return false;
    }
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
      const periodOrder = shuffle(Array.from({ length: settings.periodsPerDay }, (_, idx) => idx + 1));

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

// Runs the auto-assignment (駒入れ), keeping any already-confirmed placements fixed,
// and tries randomized attempts (starting from the active 全体オプション's maxAttempts)
// to minimize leftover (未配置) lessons across every class/grade. If the configured
// number of attempts isn't enough to place every lesson, it keeps retrying beyond
// that — up to a safety cap on extra attempts and elapsed time, so a dataset that's
// structurally impossible to fully place (e.g. not enough teacher/room slots) can't
// freeze the browser forever — stopping the moment every lesson is placed (0 残り駒).
const EXTRA_ATTEMPT_CAP = 1000;
const EXTRA_TIME_BUDGET_MS = 10000;

export const runScheduler = (ctx: SchedulerContext, existingPlacements: Placement[]): RunResult => {
  const keepConfirmed = existingPlacements.filter(p => p.confirmed);
  const configuredAttempts = ctx.options?.maxAttempts ?? 25;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const start = now();

  let best: RunResult | null = null;
  let i = 0;
  while (true) {
    const result = attempt(ctx, keepConfirmed);
    const unplacedTotal = result.unplaced.reduce((s, u) => s + u.count, 0);
    if (!best || unplacedTotal < best.unplaced.reduce((s, u) => s + u.count, 0)) {
      best = result;
    }
    i++;
    if (unplacedTotal === 0) break;
    if (i < configuredAttempts) continue;
    if (i >= configuredAttempts + EXTRA_ATTEMPT_CAP) break;
    if (now() - start > EXTRA_TIME_BUDGET_MS) break;
  }

  return best!;
};
