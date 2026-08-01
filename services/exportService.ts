import { ProjectData, SchoolClass, Lesson, Placement } from '../types';
import { periodsForDay, maxPeriodsAcrossDays } from '../utils';

const SUBJECT_HEX: Record<string, { bg: string; text: string }> = {
  blue: { bg: '#DBEAFE', text: '#1E40AF' },
  green: { bg: '#DCFCE7', text: '#166534' },
  amber: { bg: '#FEF3C7', text: '#92400E' },
  rose: { bg: '#FFE4E6', text: '#9F1239' },
  violet: { bg: '#EDE9FE', text: '#5B21B6' },
  cyan: { bg: '#CFFAFE', text: '#155E75' },
  lime: { bg: '#ECFCCB', text: '#3F6212' },
  orange: { bg: '#FFEDD5', text: '#9A3412' },
  pink: { bg: '#FCE7F3', text: '#9D174D' },
  teal: { bg: '#CCFBF1', text: '#115E59' },
  indigo: { bg: '#E0E7FF', text: '#3730A3' },
  fuchsia: { bg: '#FAE8FF', text: '#86198F' },
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Builds one class's weekly grid as an HTML <table>, used by both the
// standalone HTML/viewer export and the "全クラス一括印刷" print mode.
const buildClassTableHtml = (data: ProjectData, cls: SchoolClass): string => {
  const { settings, teachers, subjects, lessons, placements } = data;
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  const cellAt = (day: number, period: number): { lesson: Lesson; placement: Placement } | null => {
    for (const p of placements) {
      const l = lessonById.get(p.lessonId);
      if (!l || !l.classIds.includes(cls.id)) continue;
      const span = l.consecutive;
      if (p.day === day && period >= p.period && period < p.period + span) return { lesson: l, placement: p };
    }
    return null;
  };

  let rows = '';
  for (let period = 1; period <= maxPeriodsAcrossDays(settings); period++) {
    rows += `<tr${settings.lunchAfterPeriod === period ? ' class="lunch-after"' : ''}><td class="period">${period}限</td>`;
    for (let day = 0; day < settings.days.length; day++) {
      if (period > periodsForDay(settings, day)) { rows += `<td class="cell na"></td>`; continue; }
      const cell = cellAt(day, period);
      if (cell && cell.placement.period !== period) continue; // covered by rowspan
      if (!cell) { rows += `<td class="cell empty"></td>`; continue; }
      const subject = subjects.find(s => s.id === cell.lesson.subjectId);
      const color = SUBJECT_HEX[subject?.color ?? 'blue'];
      const teacherNames = cell.lesson.teacherIds.map(id => teachers.find(t => t.id === id)?.short || teachers.find(t => t.id === id)?.name).filter(Boolean).join('・');
      rows += `<td class="cell" rowspan="${cell.lesson.consecutive}" style="background:${color.bg};color:${color.text}">`
        + `<div class="subject">${escapeHtml(subject?.name ?? '?')}</div>`
        + `<div class="teacher">${escapeHtml(teacherNames)}</div></td>`;
    }
    rows += '</tr>';
  }

  const headerCols = settings.days.map(d => `<th>${escapeHtml(d)}</th>`).join('');

  return `
    <h2>${escapeHtml(cls.name)}</h2>
    <table>
      <thead><tr><th></th>${headerCols}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

export const HTML_STYLE = `
  body { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; color: #1f2937; margin: 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .generated { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  h2 { font-size: 16px; margin: 28px 0 8px; }
  table { border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #d1d5db; padding: 4px 8px; font-size: 12px; text-align: center; }
  th { background: #f3f4f6; color: #6b7280; font-weight: 600; }
  td.period { color: #9ca3af; white-space: nowrap; }
  td.cell { min-width: 64px; }
  td.cell .subject { font-weight: 700; }
  td.cell .teacher { font-size: 11px; opacity: 0.85; }
  td.empty { background: #fafafa; }
  td.na { background: #e5e7eb; border-style: none; }
  tr.lunch-after td { border-bottom: 3px solid #fcd34d; }
  @media print { body { margin: 0; } h2 { page-break-before: always; } h2:first-of-type { page-break-before: avoid; } }
`;

export const buildAllClassesTableHtml = (data: ProjectData): string =>
  data.classes.map(cls => buildClassTableHtml(data, cls)).join('\n');

// Standalone, self-contained HTML output — usable as a read-only "ビューワー"
// by anyone without the app itself, showing every class's weekly timetable.
export const exportHtml = (data: ProjectData) => {
  const body = buildAllClassesTableHtml(data);
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(data.settings.schoolName || 'AI時間割')}</title>
<style>${HTML_STYLE}</style>
</head>
<body>
<h1>${escapeHtml(data.settings.schoolName || 'AI時間割')} の時間割</h1>
<div class="generated">出力日時: ${new Date().toLocaleString('ja-JP')}</div>
${body}
</body>
</html>`;
  download('timetable.html', html, 'text/html;charset=utf-8');
};

// Merges another project's master data (classes/teachers/subjects/rooms) and
// lessons into the current project, matching by name (統合連結: combining
// separately-entered data, e.g. from different subject leads). Placements
// are not merged — re-run 駒入れ after merging.
export const mergeProjectData = (current: ProjectData, incoming: ProjectData): ProjectData => {
  const mergeByName = <T extends { id: string; name: string }>(base: T[], added: T[]): { merged: T[]; idMap: Map<string, string> } => {
    const merged = [...base];
    const idMap = new Map<string, string>();
    for (const item of added) {
      const existing = merged.find(m => m.name === item.name);
      if (existing) {
        idMap.set(item.id, existing.id);
      } else {
        merged.push(item);
        idMap.set(item.id, item.id);
      }
    }
    return { merged, idMap };
  };

  const { merged: classes, idMap: classIdMap } = mergeByName(current.classes, incoming.classes);
  const { merged: teachers, idMap: teacherIdMap } = mergeByName(current.teachers, incoming.teachers);
  const { merged: subjects, idMap: subjectIdMap } = mergeByName(current.subjects, incoming.subjects);
  const { merged: rooms, idMap: roomIdMap } = mergeByName(current.rooms, incoming.rooms);

  const remappedLessons = incoming.lessons.map(l => ({
    ...l,
    id: `${l.id}-merged-${Math.random().toString(36).slice(2, 7)}`,
    classIds: l.classIds.map(id => classIdMap.get(id) ?? id),
    teacherIds: l.teacherIds.map(id => teacherIdMap.get(id) ?? id),
    subjectId: subjectIdMap.get(l.subjectId) ?? l.subjectId,
    roomIds: l.roomIds.map(id => roomIdMap.get(id) ?? id),
  }));

  return {
    ...current,
    classes,
    teachers,
    subjects,
    rooms,
    lessons: [...current.lessons, ...remappedLessons],
  };
};

const download = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportCsv = (data: ProjectData) => {
  const { settings, classes, teachers, rooms, subjects, lessons, placements } = data;
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  const header = ['クラス', '曜日', '時限', '科目', '先生', '教室', '確定'];
  const rows = [header.join(',')];

  for (const cls of classes) {
    const rowsForClass = placements
      .filter(p => lessonById.get(p.lessonId)?.classIds.includes(cls.id))
      .sort((a, b) => a.day - b.day || a.period - b.period);
    for (const p of rowsForClass) {
      const lesson = lessonById.get(p.lessonId);
      if (!lesson) continue;
      const subject = subjects.find(s => s.id === lesson.subjectId)?.name ?? '';
      const teacherNames = lesson.teacherIds.map(id => teachers.find(t => t.id === id)?.name).filter(Boolean).join('・');
      const roomNames = lesson.roomIds.map(id => rooms.find(r => r.id === id)?.name).filter(Boolean).join('・');
      rows.push([
        cls.name,
        settings.days[p.day] ?? '',
        `${p.period}限`,
        subject,
        teacherNames,
        roomNames,
        p.confirmed ? '確定' : '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }
  }

  download('timetable.csv', '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
};

export const saveProjectJson = (data: ProjectData) => {
  download('timetable-data.json', JSON.stringify(data, null, 2), 'application/json');
};

export const loadProjectJson = (file: File): Promise<ProjectData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
