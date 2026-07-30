import { ProjectData } from '../types';

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
