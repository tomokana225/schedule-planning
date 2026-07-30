// Domain model for AI Timetable (AI時間割) - school class timetable auto-generation

export interface SchoolClass {
  id: string;
  name: string;      // e.g. "1年A組"
  grade?: string;     // e.g. "1年"
}

export interface Teacher {
  id: string;
  name: string;
  short?: string;      // 略称
  maxPerDay?: number;   // 1日の最大授業数（未設定なら制限なし）
  unavailable: SlotKey[]; // 授業できない曜日・時限
}

export interface Subject {
  id: string;
  name: string;
  color: string;        // tailwind color key, e.g. 'blue'
  maxPerDayPerClass?: number; // 1日に同じ科目を何回までクラスに入れられるか（既定1）
}

export interface Room {
  id: string;
  name: string;
}

export type LessonType = 'basic' | 'selective';

// 授業（基本授業・選択授業）: a lesson requirement to be placed into the weekly grid
export interface Lesson {
  id: string;
  type: LessonType;
  classIds: string[];    // 合同授業の場合は複数
  teacherIds: string[];  // TT授業の場合は複数
  subjectId: string;
  roomIds: string[];     // 展開授業などで複数教室を使う場合
  weeklyCount: number;   // 週あたりのコマ数
  consecutive: 1 | 2;    // 連続授業なら2
  confirmedSlots?: SlotKey[]; // 固定（確定）されたスロット（存在すれば優先配置）
  label?: string;        // 表示用の短い名前（例: 選択A）
}

export interface SlotKey {
  day: number;    // 0-indexed weekday (0=月)
  period: number; // 1-indexed period
}

// 駒: a placed instance of a lesson at a specific day/period
export interface Placement {
  id: string;
  lessonId: string;
  day: number;
  period: number;
  confirmed: boolean;
}

export interface TimetableSettings {
  schoolName: string;
  days: string[];       // e.g. ['月','火','水','木','金','土']
  periodsPerDay: number;
  lunchAfterPeriod?: number; // 昼休みの位置（表示用の区切り線）
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

export const SUBJECT_COLORS = [
  'blue', 'green', 'amber', 'rose', 'violet', 'cyan', 'lime', 'orange', 'pink', 'teal', 'indigo', 'fuchsia',
] as const;

export const SUBJECT_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  rose: 'bg-rose-100 text-rose-800 border-rose-300',
  violet: 'bg-violet-100 text-violet-800 border-violet-300',
  cyan: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  lime: 'bg-lime-100 text-lime-800 border-lime-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
  pink: 'bg-pink-100 text-pink-800 border-pink-300',
  teal: 'bg-teal-100 text-teal-800 border-teal-300',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
};

export interface ProjectData {
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  lessons: Lesson[];
  placements: Placement[];
}

export type AppStep = 'setup' | 'master' | 'lessons' | 'constraints' | 'timetable';
