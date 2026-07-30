import { ProjectData } from '../types';

export interface SummaryRow {
  id: string;
  name: string;
  weeklyPeriods: number;
  annualPeriods: number;
}

export interface SummaryResult {
  teachers: SummaryRow[];
  classes: SummaryRow[];
  subjects: SummaryRow[];
}

// 年間実績集計プログラム（付属ツール）の簡易版:
// 週あたりの配置済みコマ数を、先生・クラス・科目ごとに集計し、
// 年間の授業週数を掛けて年間実績（見込み）として算出する。
export const computeSummary = (data: ProjectData, weeksPerYear: number): SummaryResult => {
  const { teachers, classes, subjects, lessons, placements } = data;
  const lessonById = new Map(lessons.map(l => [l.id, l]));

  const weeklyFor = (predicate: (teacherIds: string[], classIds: string[], subjectId: string) => boolean): number => {
    let total = 0;
    for (const p of placements) {
      const lesson = lessonById.get(p.lessonId);
      if (!lesson) continue;
      if (predicate(lesson.teacherIds, lesson.classIds, lesson.subjectId)) total += lesson.consecutive;
    }
    return total;
  };

  const toRow = (id: string, name: string, weeklyPeriods: number): SummaryRow => ({
    id, name, weeklyPeriods, annualPeriods: weeklyPeriods * weeksPerYear,
  });

  return {
    teachers: teachers.map(t => toRow(t.id, t.name, weeklyFor(teacherIds => teacherIds.includes(t.id)))),
    classes: classes.map(c => toRow(c.id, c.name, weeklyFor((_t, classIds) => classIds.includes(c.id)))),
    subjects: subjects.map(s => toRow(s.id, s.name, weeklyFor((_t, _c, subjectId) => subjectId === s.id))),
  };
};

export const exportSummaryCsv = (summary: SummaryResult, weeksPerYear: number) => {
  const header = ['区分', '名称', '週コマ数', `年間換算（週数${weeksPerYear}）`];
  const rows = [header.join(',')];
  const section = (label: string, items: SummaryRow[]) => {
    for (const r of items) {
      rows.push([label, r.name, String(r.weeklyPeriods), String(r.annualPeriods)]
        .map(v => `"${v.replace(/"/g, '""')}"`).join(','));
    }
  };
  section('先生', summary.teachers);
  section('クラス', summary.classes);
  section('科目', summary.subjects);

  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'timetable-summary.csv';
  a.click();
  URL.revokeObjectURL(url);
};
