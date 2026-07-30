import { Lesson, Placement, SchoolClass, Subject, Teacher, TimetableSettings } from '../types';
import { generateId, hasSlot } from '../utils';

export interface SchedulerContext {
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  lessons: Lesson[];
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
  const { settings, teachers, subjects } = ctx;
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
    // Teacher unavailable times
    for (const teacherId of lesson.teacherIds) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher && hasSlot(teacher.unavailable, day, p)) return false;
    }
  }

  // Teacher max lessons per day
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

  // Subject max-per-day-per-class
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
  const placements: Placement[] = [...keepConfirmed];
  const unplacedCount = new Map<string, number>();

  const orderedLessons = shuffle(lessons)
    .slice()
    .sort((a, b) => difficultyScore(b, teachers) - difficultyScore(a, teachers));

  for (const lesson of orderedLessons) {
    const alreadyConfirmed = placements.filter(p => p.lessonId === lesson.id).length;
    const remaining = lesson.weeklyCount - alreadyConfirmed;
    const usedDays = new Set(placements.filter(p => p.lessonId === lesson.id).map(p => p.day));

    for (let i = 0; i < remaining; i++) {
      const dayOrder = shuffle(settings.days.map((_, idx) => idx))
        .sort((a, b) => (usedDays.has(a) ? 1 : 0) - (usedDays.has(b) ? 1 : 0));
      const periodOrder = shuffle(Array.from({ length: settings.periodsPerDay }, (_, idx) => idx + 1));

      let placed = false;
      for (const day of dayOrder) {
        for (const period of periodOrder) {
          if (isValidPlacement(ctx, placements, lesson, day, period)) {
            placements.push({ id: generateId(), lessonId: lesson.id, day, period, confirmed: false });
            usedDays.add(day);
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
// and tries several randomized attempts to minimize leftover (未配置) lessons.
export const runScheduler = (ctx: SchedulerContext, existingPlacements: Placement[], attempts = 25): RunResult => {
  const keepConfirmed = existingPlacements.filter(p => p.confirmed);
  let best: RunResult | null = null;

  for (let i = 0; i < attempts; i++) {
    const result = attempt(ctx, keepConfirmed);
    const unplacedTotal = result.unplaced.reduce((s, u) => s + u.count, 0);
    if (!best || unplacedTotal < best.unplaced.reduce((s, u) => s + u.count, 0)) {
      best = result;
      if (unplacedTotal === 0) break;
    }
  }

  return best!;
};
