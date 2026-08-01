import type * as XLSXType from 'xlsx';
import {
  SchoolClass, Teacher, Subject, Room, Lesson, SUBJECT_COLORS,
} from '../types';
import { generateId } from '../utils';

// Reads the "統合版簡単設定" macro-enabled Excel workbook (as described in the
// product's guide: シート「クラス定義」「普通」「TT」「選択授業」「総合」「先生名称」)
// and converts it into classes/teachers/subjects/lessons for this app.
//
// Known simplifications (reported back to the user after import):
// - The source format has no room/教室 columns at all, so imported lessons have
//   no room assigned. Rooms can be added afterward via the master data screen.
// - A 選択授業 row listing more than one subject (展開授業: different teachers
//   teaching different subjects to a split/rotating group at the same time)
//   is imported as one independent lesson per teacher-subject pair, since this
//   app's lesson model allows only one subject per lesson. The classes and
//   total hours are preserved, but the "taught at the exact same time" pairing
//   is lost — check 授業設定 afterward if that matters for your school.
// - Hour codes combine a total-hours number with a circled digit for
//   consecutive block size (例: "6②" = three 2-hour blocks = 6 hours). This
//   app only supports 1- or 2-period blocks, so a total that doesn't split
//   evenly into blocks of 2 (e.g. "3②") is imported as one 2-hour block plus
//   one remaining 1-hour single lesson.

export interface ImportResult {
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  lessons: Lesson[];
  warnings: string[];
}

const ZENKAKU_DIGITS = '０１２３４５６７８９';

const toHankaku = (s: string): string =>
  s.replace(/[０-９]/g, ch => String(ZENKAKU_DIGITS.indexOf(ch)));

const CIRCLED_DIGITS = '①②③④⑤⑥⑦⑧⑨';

interface HourEntry {
  weeklyCount: number;
  consecutive: 1 | 2;
}

// Parses a single hour-count cell such as 4, "4", "3②", "6②" into one or two
// lesson-hour entries (see the module-level comment for the splitting rule).
const parseHourCell = (raw: unknown, warn: (msg: string) => void, context: string): HourEntry[] => {
  if (raw === null || raw === undefined || raw === '') return [];
  if (typeof raw === 'number') {
    return raw > 0 ? [{ weeklyCount: raw, consecutive: 1 }] : [];
  }
  const str = toHankaku(String(raw)).trim();
  if (!str) return [];

  const circledChar = [...str].find(c => CIRCLED_DIGITS.includes(c));
  if (!circledChar) {
    const n = Number(str);
    if (!Number.isFinite(n) || n <= 0) {
      warn(`${context}: 時数の値「${raw}」を読み取れなかったため無視しました`);
      return [];
    }
    return [{ weeklyCount: n, consecutive: 1 }];
  }

  const rawBlockSize = CIRCLED_DIGITS.indexOf(circledChar) + 1;
  const blockSize = Math.min(rawBlockSize, 2) as 1 | 2;
  if (rawBlockSize > 2) {
    warn(`${context}: ${rawBlockSize}時間連続はこのアプリでは未対応のため、2時間連続として取り込みました`);
  }
  const totalStr = str.replace(circledChar, '').trim();
  const total = Number(totalStr);
  if (!Number.isFinite(total) || total <= 0) {
    warn(`${context}: 時数の値「${raw}」を読み取れなかったため無視しました`);
    return [];
  }

  const blocks = Math.floor(total / blockSize);
  const remainder = total - blocks * blockSize;
  const entries: HourEntry[] = [];
  if (blocks > 0) entries.push({ weeklyCount: blocks, consecutive: blockSize });
  if (remainder > 0) entries.push({ weeklyCount: remainder, consecutive: 1 });
  return entries;
};

const sheetToRows = (XLSX: typeof XLSXType, workbook: XLSXType.WorkBook, name: string): unknown[][] | null => {
  const sheet = workbook.Sheets[name];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
};

// Column layout shared by 普通/TT/選択授業: row index 2 (0-based) holds 学年
// per class-column, row index 3 holds クラス (class number within the grade).
interface ClassColumn {
  colIndex: number;
  grade: string; // e.g. "1年"
  classNum: number;
}

const readClassColumns = (rows: unknown[][], gradeRowIdx: number, classRowIdx: number, startCol: number): ClassColumn[] => {
  const gradeRow = rows[gradeRowIdx] ?? [];
  const classRow = rows[classRowIdx] ?? [];
  const columns: ClassColumn[] = [];
  const maxCol = Math.max(gradeRow.length, classRow.length);
  for (let c = startCol; c < maxCol; c++) {
    const gradeRaw = gradeRow[c];
    const classNumRaw = classRow[c];
    if (gradeRaw === null || gradeRaw === undefined || gradeRaw === '') continue;
    const grade = toHankaku(String(gradeRaw)).trim();
    const classNum = Number(classNumRaw);
    if (!grade || !Number.isFinite(classNum)) continue;
    columns.push({ colIndex: c, grade, classNum });
  }
  return columns;
};

export const parseIdeaExcelWorkbook = async (file: File): Promise<ImportResult> => {
  const XLSX = await import('xlsx'); // lazily loaded: keeps the parser out of the main bundle
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];
  const warn = (msg: string) => warnings.push(msg);

  // ---- クラス定義: 学年ごとのクラス数からクラス一覧を作る ----
  const classDefRows = sheetToRows(XLSX, workbook, 'クラス定義');
  if (!classDefRows) {
    throw new Error('「クラス定義」シートが見つかりません。統合版簡単設定エクセルブックの形式ではない可能性があります。');
  }
  const classes: SchoolClass[] = [];
  const classByGradeClass = new Map<string, SchoolClass>(); // key: "1年-1"
  for (const row of classDefRows) {
    const gradeRaw = row?.[1];
    const countRaw = row?.[2];
    if (gradeRaw === null || gradeRaw === undefined || gradeRaw === '') continue;
    const grade = toHankaku(String(gradeRaw)).trim();
    const count = Number(countRaw);
    if (!/^\d+年$/.test(grade) || !Number.isFinite(count) || count <= 0) continue;
    for (let i = 1; i <= count; i++) {
      const name = `${grade}${i}組`;
      const cls: SchoolClass = { id: generateId(), name, grade, unavailable: [] };
      classes.push(cls);
      classByGradeClass.set(`${grade}-${i}`, cls);
    }
  }
  if (classes.length === 0) {
    throw new Error('「クラス定義」シートからクラスを読み取れませんでした。学年・クラス数の入力を確認してください。');
  }
  const classesByGrade = new Map<string, SchoolClass[]>();
  for (const cls of classes) {
    if (!cls.grade) continue;
    const list = classesByGrade.get(cls.grade) ?? [];
    list.push(cls);
    classesByGrade.set(cls.grade, list);
  }

  // ---- 先生名称 (任意): 先生の正式な一覧・略称 ----
  const teacherByName = new Map<string, Teacher>();
  const ensureTeacher = (name: string): Teacher => {
    const key = name.trim();
    let t = teacherByName.get(key);
    if (!t) {
      t = { id: generateId(), name: key, unavailable: [] };
      teacherByName.set(key, t);
    }
    return t;
  };
  // Column A on this sheet is a macro helper cell that concatenates the whole
  // row (not a name) — the actual teacher name lives in column B, with 略称1/2
  // in columns C/D.
  const teacherSheetRows = sheetToRows(XLSX, workbook, '先生名称');
  if (teacherSheetRows) {
    for (const row of teacherSheetRows) {
      const name = row?.[1];
      if (!name || typeof name !== 'string') continue;
      const short = typeof row?.[2] === 'string' ? row[2] : undefined;
      const t = ensureTeacher(name);
      if (short && short !== t.name) t.short = short;
    }
  }

  // ---- 科目 ----
  const subjectByName = new Map<string, Subject>();
  const ensureSubject = (name: string): Subject => {
    const key = name.trim();
    let s = subjectByName.get(key);
    if (!s) {
      s = {
        id: generateId(), name: key,
        color: SUBJECT_COLORS[subjectByName.size % SUBJECT_COLORS.length],
        maxPerDayPerClass: 1, unavailable: [],
      };
      subjectByName.set(key, s);
    }
    return s;
  };

  const lessons: Lesson[] = [];
  const splitNames = (raw: unknown): string[] =>
    typeof raw === 'string' ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];

  // ---- 普通: 一人の先生が一つのクラスを教える基本授業 ----
  const normalRows = sheetToRows(XLSX, workbook, '普通');
  if (normalRows) {
    const columns = readClassColumns(normalRows, 2, 3, 2);
    for (let r = 5; r < normalRows.length; r++) {
      const row = normalRows[r];
      if (!row) continue;
      const teacherName = row[0];
      const subjectName = row[1];
      if (!teacherName || !subjectName || typeof teacherName !== 'string' || typeof subjectName !== 'string') continue;
      const teacher = ensureTeacher(teacherName);
      const subject = ensureSubject(subjectName);
      for (const col of columns) {
        const cls = classByGradeClass.get(`${col.grade}-${col.classNum}`);
        if (!cls) continue;
        const entries = parseHourCell(row[col.colIndex], warn, `普通シート ${r + 1}行目 (${teacherName}/${subjectName}/${cls.name})`);
        for (const entry of entries) {
          lessons.push({
            id: generateId(), type: 'basic', classIds: [cls.id], teacherIds: [teacher.id],
            subjectId: subject.id, roomIds: [], weeklyCount: entry.weeklyCount, consecutive: entry.consecutive,
          });
        }
      }
    }
  } else {
    warn('「普通」シートが見つかりませんでした。');
  }

  // ---- TT: 複数の先生が一つのクラスを教える授業 ----
  const ttRows = sheetToRows(XLSX, workbook, 'TT');
  if (ttRows) {
    const columns = readClassColumns(ttRows, 2, 3, 3);
    for (let r = 5; r < ttRows.length; r++) {
      const row = ttRows[r];
      if (!row) continue;
      const label = row[0];
      const teacherNames = splitNames(row[1]);
      const subjectName = row[2];
      if (teacherNames.length === 0 || !subjectName || typeof subjectName !== 'string') continue;
      const teacherIds = teacherNames.map(n => ensureTeacher(n).id);
      const subject = ensureSubject(subjectName);
      for (const col of columns) {
        const cls = classByGradeClass.get(`${col.grade}-${col.classNum}`);
        if (!cls) continue;
        const entries = parseHourCell(row[col.colIndex], warn, `TTシート ${r + 1}行目 (${label}/${cls.name})`);
        for (const entry of entries) {
          lessons.push({
            id: generateId(), type: 'selective', classIds: [cls.id], teacherIds,
            subjectId: subject.id, roomIds: [], weeklyCount: entry.weeklyCount, consecutive: entry.consecutive,
            label: typeof label === 'string' ? label : undefined,
          });
        }
      }
    }
  } else {
    warn('「TT」シートが見つかりませんでした。');
  }

  // ---- 選択授業: 複数の先生・科目・クラスにまたがる選択/合同/展開授業 ----
  const electiveRows = sheetToRows(XLSX, workbook, '選択授業');
  if (electiveRows) {
    const columns = readClassColumns(electiveRows, 2, 3, 3);
    for (let r = 5; r < electiveRows.length; r++) {
      const row = electiveRows[r];
      if (!row) continue;
      const label = row[0];
      const teacherNames = splitNames(row[1]);
      const subjectNames = splitNames(row[2]);
      if (teacherNames.length === 0 || subjectNames.length === 0) continue;

      const involvedClassIds: string[] = [];
      let sampleEntries: HourEntry[] = [];
      for (const col of columns) {
        const cls = classByGradeClass.get(`${col.grade}-${col.classNum}`);
        if (!cls) continue;
        const entries = parseHourCell(row[col.colIndex], warn, `選択授業シート ${r + 1}行目 (${label}/${cls.name})`);
        if (entries.length > 0) {
          involvedClassIds.push(cls.id);
          if (sampleEntries.length === 0) sampleEntries = entries;
        }
      }
      if (involvedClassIds.length === 0) continue;

      if (subjectNames.length === 1) {
        // 全員が同じ科目を、参加する先生全員で受け持つ合同/選択授業
        const subject = ensureSubject(subjectNames[0]);
        const teacherIds = teacherNames.map(n => ensureTeacher(n).id);
        for (const entry of sampleEntries) {
          lessons.push({
            id: generateId(), type: 'selective', classIds: involvedClassIds, teacherIds,
            subjectId: subject.id, roomIds: [], weeklyCount: entry.weeklyCount, consecutive: entry.consecutive,
            label: typeof label === 'string' ? label : undefined,
          });
        }
      } else {
        // 展開授業: 先生と科目がペアになった、同時進行の複数科目授業。
        // このアプリでは1コマ=1科目のため、先生・科目のペアごとに別コマとして取り込む。
        if (teacherNames.length !== subjectNames.length) {
          warn(`選択授業シート ${r + 1}行目 (${label}): 先生の人数と科目の数が一致しないため、対応関係が不正確な可能性があります`);
        }
        warn(`選択授業シート ${r + 1}行目 (${label}): 複数科目の展開授業のため、科目ごとに別々のコマとして取り込みました（同時進行の想定は失われます）`);
        subjectNames.forEach((subjectName, i) => {
          const teacherName = teacherNames[i] ?? teacherNames[teacherNames.length - 1];
          const subject = ensureSubject(subjectName);
          const teacher = ensureTeacher(teacherName);
          for (const entry of sampleEntries) {
            lessons.push({
              id: generateId(), type: 'selective', classIds: involvedClassIds, teacherIds: [teacher.id],
              subjectId: subject.id, roomIds: [], weeklyCount: entry.weeklyCount, consecutive: entry.consecutive,
              label: typeof label === 'string' ? label : undefined,
            });
          }
        });
      }
    }
  } else {
    warn('「選択授業」シートが見つかりませんでした。');
  }

  // ---- 総合: 学年単位の総合的な学習の時間 ----
  const integratedRows = sheetToRows(XLSX, workbook, '総合');
  if (integratedRows) {
    const headerRow = integratedRows[2] ?? [];
    const gradeColumns: { colIndex: number; grade: string }[] = [];
    for (let c = 3; c < headerRow.length; c++) {
      const raw = headerRow[c];
      if (raw === null || raw === undefined || raw === '') continue;
      const grade = toHankaku(String(raw)).trim();
      if (/^\d+年$/.test(grade)) gradeColumns.push({ colIndex: c, grade });
    }
    for (let r = 3; r < integratedRows.length; r++) {
      const row = integratedRows[r];
      if (!row) continue;
      const label = row[0];
      const teacherNames = splitNames(row[1]);
      const subjectName = row[2];
      if (!label || teacherNames.length === 0 || !subjectName || typeof subjectName !== 'string') continue;
      const subject = ensureSubject(subjectName);
      const teacherIds = teacherNames.map(n => ensureTeacher(n).id);
      for (const col of gradeColumns) {
        const entries = parseHourCell(row[col.colIndex], warn, `総合シート ${r + 1}行目 (${label}/${col.grade})`);
        if (entries.length === 0) continue;
        const classIds = (classesByGrade.get(col.grade) ?? []).map(c => c.id);
        if (classIds.length === 0) continue;
        for (const entry of entries) {
          lessons.push({
            id: generateId(), type: 'selective', classIds, teacherIds,
            subjectId: subject.id, roomIds: [], weeklyCount: entry.weeklyCount, consecutive: entry.consecutive,
            label: typeof label === 'string' ? label : undefined,
          });
        }
      }
    }
  } else {
    warn('「総合」シートが見つかりませんでした。');
  }

  if (lessons.length === 0) {
    warn('授業データを1件も読み取れませんでした。ファイルの形式をご確認ください。');
  }
  warn('このエクセル形式には教室（教室）の情報が含まれていないため、取り込んだ授業には教室が設定されていません。必要に応じて授業設定画面から追加してください。');

  return {
    classes,
    teachers: [...teacherByName.values()],
    subjects: [...subjectByName.values()],
    rooms: [],
    lessons,
    warnings,
  };
};
