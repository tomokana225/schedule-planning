import { SlotKey } from './types';

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
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
