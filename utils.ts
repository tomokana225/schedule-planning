import { SlotKey, TimetableSettings } from './types';

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

// その曜日に実際に存在する時限数（periodsPerDayOverrides があればそれを優先）
export const periodsForDay = (settings: TimetableSettings, day: number): number =>
  settings.periodsPerDayOverrides?.[day] ?? settings.periodsPerDay;

// 全曜日を通じて存在しうる最大の時限数（グリッドの行数などに使う）
export const maxPeriodsAcrossDays = (settings: TimetableSettings): number => {
  let max = settings.periodsPerDay;
  for (let day = 0; day < settings.days.length; day++) {
    max = Math.max(max, periodsForDay(settings, day));
  }
  return max;
};

export const slotKey = (day: number, period: number): string => `${day}-${period}`;

export const parseSlotKey = (key: string): SlotKey => {
  const [day, period] = key.split('-').map(Number);
  return { day, period };
};

export const hasSlot = (slots: SlotKey[] | undefined, day: number, period: number): boolean => {
  if (!slots) return false;
  return slots.some(s => s.day === day && s.period === period);
};

export const DEFAULT_DAYS = ['月', '火', '水', '木', '金'];
