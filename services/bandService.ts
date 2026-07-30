import { Lesson, Placement, TimetableSettings } from '../types';

// 帯時間割 (band/slide timetable): a single long linear sequence of `bandTotalKoma`
// koma, built once with the normal scheduler treated as "1 long day", then sliced
// into a real week by shifting the starting position by one week's worth of koma
// each time the school moves to the next week (帯スライドツール). See README for
// the known simplifications (day-of-week-specific individual conditions and
// per-day caps don't apply while building the band itself).

export const weeklyKomaOf = (settings: TimetableSettings): number =>
  settings.days.length * settings.periodsPerDay;

// Synthetic settings used to run the normal scheduler as if the whole band
// were one single day with `bandTotalKoma` periods.
export const createBandSettings = (settings: TimetableSettings): TimetableSettings => ({
  ...settings,
  days: ['帯'],
  periodsPerDay: settings.bandTotalKoma || weeklyKomaOf(settings),
});

// 1-indexed band position that lands on real (day, period) once the band has
// been slid `weekOffset` times.
export const bandPositionFor = (
  settings: TimetableSettings,
  weekOffset: number,
  day: number,
  period: number,
): number => {
  const bandTotalKoma = settings.bandTotalKoma || weeklyKomaOf(settings);
  const weeklyKoma = weeklyKomaOf(settings);
  const linearIndexInWeek = day * settings.periodsPerDay + (period - 1);
  return (((weekOffset * weeklyKoma + linearIndexInWeek) % bandTotalKoma) + bandTotalKoma) % bandTotalKoma + 1;
};

export interface SlicedCell {
  day: number;
  period: number;
  lesson: Lesson;
}

// Produces the real week's view for the current `weekOffset` by looking up,
// for every real (day, period) slot, which band placement's occupied range
// (its start position through start+consecutive-1) contains that slot's
// band position.
export const sliceBandToWeek = (
  bandPlacements: Placement[],
  lessons: Lesson[],
  settings: TimetableSettings,
  weekOffset: number,
): SlicedCell[] => {
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  const cells: SlicedCell[] = [];

  for (let day = 0; day < settings.days.length; day++) {
    for (let period = 1; period <= settings.periodsPerDay; period++) {
      const pos = bandPositionFor(settings, weekOffset, day, period);
      const match = bandPlacements.find(bp => {
        const lesson = lessonById.get(bp.lessonId);
        const span = lesson?.consecutive ?? 1;
        return pos >= bp.period && pos < bp.period + span;
      });
      if (match) {
        const lesson = lessonById.get(match.lessonId);
        if (lesson) cells.push({ day, period, lesson });
      }
    }
  }

  return cells;
};
