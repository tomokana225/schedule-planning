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

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

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

// 単純な1手の空き探し（未配置の授業→単一の邪魔な駒を1つ動かす）では解決できない
// ケースが多い: 邪魔な駒を動かそうにも、その移動先自体がまた別の1つの駒に塞がれて
// いる、という「玉突き」がしばしば起こる。これを深さ制限付きの再帰でたどれるように
// したのが REPAIR_CHAIN_DEPTH で、単一障害物の連鎖を最大その段数までさかのぼって
// 解決を試みる（各段はあくまで「邪魔な駒がちょうど1つ」の場合のみ扱う — 複数の駒が
// 同時に重なっているマスは、正しい解決の組み合わせが爆発的に増えるため対象外のまま）。
const REPAIR_CHAIN_DEPTH = 3;

// Upper bound on how long a single repairRemainingOnce call may run, independent of
// how much of the overall 実行時間 budget remains. Keeps the interleaved loop below
// coming back around often enough to yield control (and report progress) even when
// the chain search is grinding through a lot of unproductive candidates.
const REPAIR_SLICE_MS = 300;

// 全試行の中で最良だった結果に残った未配置授業だけを対象に、直接の空きコマ探索と、
// 邪魔な駒を玉突きで動かす連鎖ローカルサーチで置き場所を探す。ランダム再試行を
// 全体でやり直すのではなく、実際に残った少数の未配置だけに絞ることで、
// 「残り駒0になるまで実行時間の設定に関わらず粘る」処理を、時間の設定自体を
// 無意味にするほど重くせずに行える。
const repairRemainingOnce = (ctx: SchedulerContext, result: RunResult, deadline: number): RunResult => {
  const { settings, lessons } = ctx;
  const lessonById = lessonMap(lessons);
  const placements = [...result.placements];
  const stillUnplaced = new Map<string, number>();
  const timeUp = () => now() > deadline;

  const allSlots = Array.from({ length: settings.days.length }, (_, day) => day)
    .flatMap(day => Array.from({ length: periodsForDay(settings, day) }, (_, idx) => ({ day, period: idx + 1 })));

  const moveBlocker = (blockerId: string, day: number, period: number) => {
    const idx = placements.findIndex(p => p.id === blockerId);
    placements[idx] = { ...placements[idx], day, period };
  };

  // Tries to make (day, period) available for `lesson` (not yet placed there) by
  // relocating the single blocking placement there, chaining through further
  // single-blocker relocations (up to REPAIR_CHAIN_DEPTH hops) if the blocker's own
  // candidate destinations are themselves each blocked by exactly one other placement.
  //
  // Every relocation is committed to `placements` for real immediately once its own
  // destination is confirmed clear — never tracked in a side "exclude" list that
  // accumulates across the whole chain. `isValidPlacement` is only ever asked to
  // ignore the ONE blocker being relocated at that exact step, so every check still
  // sees every OTHER placement's true current position. (An earlier version excluded
  // every ancestor blocker for the rest of the chain, which let a later step believe
  // an ancestor had already vacated a slot it was, in fact, still sitting in — placing
  // something else right on top of it.) Because a call only ever mutates `placements`
  // immediately before returning true, a `false` return is always fully side-effect-free,
  // so no separate rollback bookkeeping is needed either.
  //
  // `originalDay`/`originalPeriod`/`originalSpan` identify the absolute top-level slot
  // this whole chain exists to free up: no relocation anywhere in the chain may ever
  // land there, since the caller is about to place `lesson`'s original target there
  // itself once this returns true.
  const clearSlotFor = (
    lesson: Lesson, day: number, period: number, depth: number,
    originalDay: number, originalPeriod: number, originalSpan: number,
  ): boolean => {
    if (depth > REPAIR_CHAIN_DEPTH || timeUp()) return false;
    const targetEnd = period + lesson.consecutive - 1;
    const blockers = placements.filter(p => {
      if (p.confirmed || p.day !== day) return false;
      const l = lessonById.get(p.lessonId);
      // A different placement of the very same lesson can never be a legitimate
      // "blocker": it isn't a competing resource, it's the same recurring
      // commitment appearing again, and treating it as relocatable risks stacking
      // two of that lesson's own instances onto the same slot.
      if (!l || l.id === lesson.id) return false;
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

    // Crucial: confirm `lesson` would actually be valid at (day, period) once this
    // one blocker is out of the way — the blocker being the sole *placement*
    // conflict there does NOT mean the slot is otherwise open; it could still
    // violate 禁制 (unavailable), a 会議, maxPerDay, etc. Without this check the
    // repair would blindly place into a forbidden slot as long as exactly one
    // other placement happened to be there too.
    if (!isValidPlacement(ctx, placements, lesson, day, period, new Set([blocker.id]))) return false;

    const overlapsOwnTarget = (s: { day: number; period: number }, span: number) =>
      s.day === day && s.period <= targetEnd && s.period + span - 1 >= period;
    const conflictsWithOriginal = (s: { day: number; period: number }, span: number) =>
      s.day === originalDay && s.period <= originalPeriod + originalSpan - 1 && s.period + span - 1 >= originalPeriod;

    for (const s of shuffle(allSlots)) {
      if (timeUp()) return false;
      if (overlapsOwnTarget(s, blockerLesson.consecutive) || conflictsWithOriginal(s, blockerLesson.consecutive)) continue;
      const directlyValid = isValidPlacement(ctx, placements, blockerLesson, s.day, s.period, new Set([blocker.id]));
      // If s isn't directly free, see whether *it* can be cleared the same way (one
      // more link in the chain) before giving up on this candidate destination.
      if (directlyValid || clearSlotFor(blockerLesson, s.day, s.period, depth + 1, originalDay, originalPeriod, originalSpan)) {
        moveBlocker(blocker.id, s.day, s.period);
        return true;
      }
    }
    return false;
  };

  const tryRepairAt = (lesson: Lesson, day: number, period: number): boolean =>
    clearSlotFor(lesson, day, period, 1, day, period, lesson.consecutive);

  for (const { lessonId, count } of result.unplaced) {
    if (timeUp()) { stillUnplaced.set(lessonId, count); continue; }
    const lesson = lessonById.get(lessonId);
    if (!lesson) continue;
    let remaining = count;
    for (let i = 0; i < count; i++) {
      if (timeUp()) break;
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
          if (timeUp()) break;
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

  const repaired: RunResult = {
    placements,
    unplaced: Array.from(stillUnplaced.entries()).map(([lessonId, count]) => ({ lessonId, count })),
  };

  // Safety net: the chain repair above is intricate enough that a residual bug in it
  // could in principle produce an inconsistent schedule. Verify every placement is
  // still genuinely valid against every other one — reusing isValidPlacement, the same
  // function that governs placement everywhere else, rather than a second hand-written
  // check that could just as easily be wrong in its own way — and if anything doesn't
  // check out, fall back to the untouched input rather than ever hand back a result
  // that violates a constraint.
  for (const p of repaired.placements) {
    const lesson = lessonById.get(p.lessonId);
    if (!lesson || !isValidPlacement(ctx, repaired.placements, lesson, p.day, p.period, new Set([p.id]))) {
      return result;
    }
  }

  return repaired;
};

const totalUnplaced = (r: RunResult): number => r.unplaced.reduce((s, u) => s + u.count, 0);

// Drives the auto-assignment (駒入れ), keeping any already-confirmed placements fixed,
// and keeps trying randomized attempts within the configured time budget (実行時間、秒),
// keeping whichever leaves the fewest lessons unplaced and stopping early the moment
// one reaches 0 残り駒. The configured seconds is the actual, sole cap for this phase —
// increasing it in the UI directly increases how long attempts keep running. Yields the
// current best every time it genuinely improves, so a caller (sync or async) can observe
// progress as it happens; the final `return` value is always the true end result.
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
function* runSchedulerSteps(ctx: SchedulerContext, existingPlacements: Placement[]): Generator<RunResult, RunResult, void> {
  const keepConfirmed = existingPlacements.filter(p => p.confirmed);
  const budgetMs = (ctx.options?.maxSeconds ?? 15) * 1000;
  const start = now();

  let best: RunResult = { placements: existingPlacements, unplaced: summarizeUnplaced(ctx.lessons, existingPlacements) };
  if (totalUnplaced(best) === 0) return best;

  // Yielding only on genuine improvement isn't enough on its own: long stretches
  // where nothing improves (common once the search is close to its limit) would
  // otherwise run the whole loop below to completion without ever handing control
  // back to whoever is driving this generator. For the async driver that means the
  // browser's event loop — and the UI it needs to paint a countdown or a live
  // preview on — would never get a turn, even though this generator is technically
  // yielding "sometimes". So also yield on a plain time tick regardless of whether
  // `best` changed, purely to give the caller a chance to breathe.
  let lastTick = now();
  const tick = () => {
    if (now() - lastTick > 50) {
      lastTick = now();
      return true;
    }
    return false;
  };

  do {
    const result = attempt(ctx, keepConfirmed);
    if (totalUnplaced(result) < totalUnplaced(best)) {
      best = result;
      yield best;
      lastTick = now();
    } else if (tick()) {
      yield best;
    }
    if (totalUnplaced(best) === 0) return best;

    if (now() - start < budgetMs) {
      // Cap each repair call to a short slice of its own, regardless of how much of
      // the overall budget remains: on heavily-contested data the depth-3 chain
      // search can in principle explore a very large number of candidate chains for
      // a single stubborn lesson, and without its own bound that single call could
      // run for the entire remaining budget (or, before this bound existed, even
      // past it) with no chance for the interleaved loop above to come back around
      // and yield — which is exactly what made the countdown/preview freeze solid
      // instead of ticking down smoothly on harder data.
      const repairDeadline = Math.min(start + budgetMs, now() + REPAIR_SLICE_MS);
      const repaired = repairRemainingOnce(ctx, best, repairDeadline);
      if (totalUnplaced(repaired) < totalUnplaced(best)) {
        best = repaired;
        yield best;
        lastTick = now();
      } else if (tick()) {
        yield best;
      }
      if (totalUnplaced(best) === 0) return best;
    }
  } while (now() - start < budgetMs);

  return best;
}

// Synchronous entry point: runs the whole time budget in one tight loop with no
// yielding back to the caller, exactly as before this function was split out.
export const runScheduler = (ctx: SchedulerContext, existingPlacements: Placement[]): RunResult => {
  const gen = runSchedulerSteps(ctx, existingPlacements);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
};

// Async entry point for interactive callers: periodically yields control back to the
// browser's event loop (so the UI stays responsive and can render a live countdown),
// calling `onProgress` with the current best placements each time — so the timetable
// grid can visibly update as the search finds better arrangements (and a countdown can
// tick down smoothly even during stretches with no improvement), instead of freezing
// for the whole budget and only then revealing a result.
export const runSchedulerAsync = async (
  ctx: SchedulerContext,
  existingPlacements: Placement[],
  onProgress?: (best: RunResult, elapsedMs: number, budgetMs: number) => void,
): Promise<RunResult> => {
  const start = now();
  const budgetMs = (ctx.options?.maxSeconds ?? 15) * 1000;
  const gen = runSchedulerSteps(ctx, existingPlacements);

  let lastYield = now();
  let step = gen.next();
  while (!step.done) {
    if (now() - lastYield > 80) {
      onProgress?.(step.value, now() - start, budgetMs);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      lastYield = now();
    }
    step = gen.next();
  }
  onProgress?.(step.value, now() - start, budgetMs);
  return step.value;
};
