import React, { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { SchoolClass, Teacher, Subject, Lesson, Placement, TimetableSettings, SUBJECT_COLOR_CLASSES } from '../types';

interface Props {
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  lessons: Lesson[];
  placements: Placement[];
  onOpenClass: (classId: string) => void;
}

interface GapEntry {
  classId: string;
  className: string;
  day: number;
  period: number;
}

// A single merged table — rows are every class (grouped by grade), columns are
// every day×period slot — so the whole school's timetable can be scanned and
// validated at once. Any empty slot is flagged as an error (this app's model
// assumes every period should be filled), with a pass/fail summary listing
// exactly which class/day/period slots are still open.
export const AllClassesMatrix: React.FC<Props> = ({
  settings, classes, teachers, subjects, lessons, placements, onOpenClass,
}) => {
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  const periods = Array.from({ length: settings.periodsPerDay }, (_, i) => i + 1);

  const orderedClasses = useMemo(
    () => [...classes].sort((a, b) => (a.grade || '').localeCompare(b.grade || '', 'ja')),
    [classes],
  );

  const cellAt = (classId: string, day: number, period: number): { lesson: Lesson; placement: Placement } | null => {
    for (const p of placements) {
      const l = lessonById.get(p.lessonId);
      if (!l || !l.classIds.includes(classId)) continue;
      const span = l.consecutive;
      if (p.day === day && period >= p.period && period < p.period + span) return { lesson: l, placement: p };
    }
    return null;
  };

  const gaps: GapEntry[] = [];
  for (const cls of orderedClasses) {
    for (let day = 0; day < settings.days.length; day++) {
      for (const period of periods) {
        if (!cellAt(cls.id, day, period)) {
          gaps.push({ classId: cls.id, className: cls.name, day, period });
        }
      }
    }
  }

  const gapsByClass = new Map<string, GapEntry[]>();
  for (const g of gaps) {
    if (!gapsByClass.has(g.classId)) gapsByClass.set(g.classId, []);
    gapsByClass.get(g.classId)!.push(g);
  }

  if (classes.length === 0) {
    return <div className="text-center text-gray-400 text-sm py-12">クラスが登録されていません</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {gaps.length === 0 ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">
          <CheckCircle2 size={18} />
          成功: 全学年・全クラスのすべてのコマが埋まっています（空きコマなし）
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <div className="flex items-center gap-2 font-medium mb-2">
            <XCircle size={18} />
            エラー: 空きコマが {gaps.length} 件あります（下表の赤いセル）
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
            {[...gapsByClass.entries()].map(([classId, entries]) => (
              <button
                key={classId}
                onClick={() => onOpenClass(classId)}
                className="block text-left hover:underline"
              >
                <span className="font-semibold">{entries[0].className}</span>
                {': '}
                {entries.map(e => `${settings.days[e.day]}${e.period}限`).join('、')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-auto border border-gray-200 rounded-xl">
        <table className="border-collapse text-[11px] w-full">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-20 bg-gray-100 border border-gray-200 px-2 py-1 min-w-[3.5rem]">学年</th>
              <th rowSpan={2} className="sticky left-14 top-0 z-20 bg-gray-100 border border-gray-200 px-2 py-1 min-w-[4.5rem]">クラス</th>
              {settings.days.map(d => (
                <th
                  key={d}
                  colSpan={settings.periodsPerDay}
                  className="sticky top-0 z-10 bg-gray-100 border border-gray-200 px-2 py-1 text-gray-600"
                >
                  {d}
                </th>
              ))}
            </tr>
            <tr>
              {settings.days.map((d, dayIdx) =>
                periods.map(period => (
                  <th
                    key={`${dayIdx}-${period}`}
                    className={`sticky top-6 z-10 bg-gray-50 border border-gray-200 px-1.5 py-1 text-gray-400 font-normal ${
                      settings.lunchAfterPeriod === period ? 'border-b-2 border-b-amber-300' : ''
                    }`}
                  >
                    {period}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {orderedClasses.map((cls, rowIdx) => {
              const prevGrade = rowIdx > 0 ? (orderedClasses[rowIdx - 1].grade || '') : null;
              const grade = cls.grade || '';
              const isFirstOfGrade = grade !== prevGrade;
              const gradeRowSpan = orderedClasses.filter(c => (c.grade || '') === grade).length;

              return (
                <tr key={cls.id}>
                  {isFirstOfGrade && (
                    <td
                      rowSpan={gradeRowSpan}
                      className="sticky left-0 z-10 bg-white border border-gray-200 px-2 py-1 font-semibold text-gray-700 align-top whitespace-nowrap"
                    >
                      {grade || '未設定'}
                    </td>
                  )}
                  <td
                    className="sticky left-14 z-10 bg-white border border-gray-200 px-2 py-1 font-medium text-gray-700 whitespace-nowrap cursor-pointer hover:text-indigo-600"
                    onClick={() => onOpenClass(cls.id)}
                  >
                    {cls.name}
                  </td>
                  {settings.days.map((_, day) =>
                    periods.map(period => {
                      const cell = cellAt(cls.id, day, period);
                      if (cell && cell.placement.period !== period) return null; // covered by colSpan
                      if (!cell) {
                        return (
                          <td
                            key={`${day}-${period}`}
                            className="border border-red-200 bg-red-50 text-red-400 text-center h-7 min-w-[2.75rem]"
                            title={`${cls.name} ${settings.days[day]}${period}限が空いています`}
                          >
                            ×
                          </td>
                        );
                      }
                      const subject = subjects.find(s => s.id === cell.lesson.subjectId);
                      const teacherNames = cell.lesson.teacherIds
                        .map(id => teachers.find(t => t.id === id)?.short || teachers.find(t => t.id === id)?.name)
                        .filter(Boolean)
                        .join('・');
                      return (
                        <td
                          key={`${day}-${period}`}
                          colSpan={cell.lesson.consecutive}
                          className={`border border-gray-100 text-center px-1 min-w-[2.75rem] ${SUBJECT_COLOR_CLASSES[subject?.color ?? 'blue']}`}
                        >
                          <div className="font-semibold leading-tight truncate">{subject?.name ?? '?'}</div>
                          <div className="opacity-70 truncate leading-tight">{teacherNames}</div>
                        </td>
                      );
                    }),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
