import { ProjectData } from '../types';

export interface SummaryRow {
  id: string;
  name: string;
  weeklyPeriods: number;      // 実際に時間割へ配置されている週コマ数
  expectedPeriods: number;    // 授業設定上、本来割り当てられているはずの週コマ数
  matches: boolean;           // 上記2つが一致しているか（不一致＝未配置や重複配置の疑いあり）
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
// あわせて、授業設定上「本来割り当てられているはずのコマ数」も算出し、実際に配置
// されているコマ数と一致しているかを確認できるようにする（不一致＝残り駒がある等）。
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

  const expectedFor = (predicate: (teacherIds: string[], classIds: string[], subjectId: string) => boolean): number => {
    let total = 0;
    for (const lesson of lessons) {
      if (predicate(lesson.teacherIds, lesson.classIds, lesson.subjectId)) total += lesson.weeklyCount * lesson.consecutive;
    }
    return total;
  };

  const toRow = (id: string, name: string, weeklyPeriods: number, expectedPeriods: number): SummaryRow => ({
    id, name, weeklyPeriods, expectedPeriods, matches: weeklyPeriods === expectedPeriods, annualPeriods: weeklyPeriods * weeksPerYear,
  });

  return {
    teachers: teachers.map(t => toRow(
      t.id, t.name,
      weeklyFor(teacherIds => teacherIds.includes(t.id)),
      expectedFor(teacherIds => teacherIds.includes(t.id)),
    )),
    classes: classes.map(c => toRow(
      c.id, c.name,
      weeklyFor((_t, classIds) => classIds.includes(c.id)),
      expectedFor((_t, classIds) => classIds.includes(c.id)),
    )),
    subjects: subjects.map(s => toRow(
      s.id, s.name,
      weeklyFor((_t, _c, subjectId) => subjectId === s.id),
      expectedFor((_t, _c, subjectId) => subjectId === s.id),
    )),
  };
};

export const exportSummaryCsv = (summary: SummaryResult, weeksPerYear: number) => {
  const header = ['区分', '名称', '週コマ数', '本来のコマ数', '一致', `年間換算（週数${weeksPerYear}）`];
  const rows = [header.join(',')];
  const section = (label: string, items: SummaryRow[]) => {
    for (const r of items) {
      rows.push([label, r.name, String(r.weeklyPeriods), String(r.expectedPeriods), r.matches ? '○' : '✕', String(r.annualPeriods)]
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

export interface UnitComparisonSubjectRow {
  subjectId: string;
  subjectName: string;
  color: string;
  byClass: Record<string, number>; // classId -> 単位数（週コマ数、授業設定ベース）
  mismatched: boolean;              // 同一学年内でこの科目の単位数が揃っていない
}

export interface UnitComparisonGrade {
  grade: string;
  classes: { id: string; name: string }[];
  subjectRows: UnitComparisonSubjectRow[];
}

// 各クラスごとに、各教科の単位数（週コマ数、授業設定上の weeklyCount 合計）を
// 学年単位で並べ、同じ学年内のクラス間で単位数が揃っているかを確認できるようにする。
// 展開授業などで同じクラス・科目に複数の授業が登録されている場合は合算する。
export const computeUnitComparison = (data: ProjectData): UnitComparisonGrade[] => {
  const { classes, subjects, lessons } = data;

  const groups = new Map<string, typeof classes>();
  for (const c of classes) {
    const key = c.grade || '学年未設定';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const gradeOrder = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'ja'));

  return gradeOrder.map(grade => {
    const classesInGrade = groups.get(grade)!;
    const subjectRows: UnitComparisonSubjectRow[] = subjects
      .map(s => {
        const byClass: Record<string, number> = {};
        for (const c of classesInGrade) {
          byClass[c.id] = lessons
            .filter(l => l.subjectId === s.id && l.classIds.includes(c.id))
            .reduce((sum, l) => sum + l.weeklyCount, 0);
        }
        const values = classesInGrade.map(c => byClass[c.id]);
        const mismatched = values.some(v => v !== values[0]);
        return { subjectId: s.id, subjectName: s.name, color: s.color, byClass, mismatched };
      })
      .filter(row => classesInGrade.some(c => row.byClass[c.id] > 0));

    return { grade, classes: classesInGrade.map(c => ({ id: c.id, name: c.name })), subjectRows };
  });
};
