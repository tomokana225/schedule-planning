import React, { useMemo } from 'react';
import { SchoolClass, Teacher, Subject, Lesson, Placement, Meeting, TimetableSettings, SUBJECT_COLOR_CLASSES } from '../types';
import { periodsForDay } from '../utils';

interface Props {
  settings: TimetableSettings;
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  lessons: Lesson[];
  placements: Placement[];
  meetings: Meeting[];
  onOpenTeacher: (teacherId: string) => void;
}

// 先生ごとの時間割を一つの表にまとめて表示する（AllClassesMatrix のクラス版に対する
// 先生版）。クラスの一括表と違い、先生には空きコマがあって当然なので、空きコマを
// エラーとして扱うことはしない（単純な一覧表示のみ）。
export const AllTeachersMatrix: React.FC<Props> = ({
  settings, teachers, classes, subjects, lessons, placements, meetings, onOpenTeacher,
}) => {
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  const periodsByDay = settings.days.map((_, day) =>
    Array.from({ length: periodsForDay(settings, day) }, (_, i) => i + 1),
  );

  const orderedTeachers = useMemo(
    () => [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [teachers],
  );

  const cellAt = (teacherId: string, day: number, period: number): { lesson: Lesson; placement: Placement } | null => {
    for (const p of placements) {
      const l = lessonById.get(p.lessonId);
      if (!l || !l.teacherIds.includes(teacherId)) continue;
      const span = l.consecutive;
      if (p.day === day && period >= p.period && period < p.period + span) return { lesson: l, placement: p };
    }
    return null;
  };

  const meetingAt = (teacherId: string, day: number, period: number): Meeting | undefined =>
    meetings.find(m => m.day === day && m.period === period && m.teacherIds.includes(teacherId));

  if (teachers.length === 0) {
    return <div className="text-center text-gray-400 text-sm py-12">先生が登録されていません</div>;
  }

  return (
    <div className="overflow-auto border border-gray-200 rounded-xl">
      <table className="border-collapse text-[11px] table-fixed">
        <colgroup>
          <col style={{ width: '6rem' }} />
          {settings.days.flatMap((_, dayIdx) =>
            periodsByDay[dayIdx].map(period => <col key={`col-${dayIdx}-${period}`} style={{ width: '2.75rem' }} />),
          )}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className="sticky left-0 top-0 z-20 bg-gray-100 border border-gray-200 px-2 py-1">先生</th>
            {settings.days.map((d, dayIdx) => (
              <th
                key={d}
                colSpan={periodsByDay[dayIdx].length}
                className="sticky top-0 z-10 bg-gray-100 border border-gray-200 px-2 py-1 text-gray-600"
              >
                {d}
              </th>
            ))}
          </tr>
          <tr>
            {settings.days.map((d, dayIdx) =>
              periodsByDay[dayIdx].map(period => (
                <th
                  key={`${dayIdx}-${period}`}
                  className={`sticky top-6 z-10 bg-gray-50 border border-gray-200 h-7 text-gray-400 font-normal ${
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
          {orderedTeachers.map(t => (
            <tr key={t.id}>
              <td
                title={t.name}
                className="sticky left-0 z-10 bg-white border border-gray-200 px-2 py-1 font-medium text-gray-700 truncate cursor-pointer hover:text-indigo-600"
                onClick={() => onOpenTeacher(t.id)}
              >
                {t.name}
              </td>
              {settings.days.map((_, day) =>
                periodsByDay[day].map(period => {
                  const cell = cellAt(t.id, day, period);
                  if (cell && cell.placement.period !== period) return null; // covered by colSpan
                  if (!cell) {
                    const meeting = meetingAt(t.id, day, period);
                    if (meeting) {
                      return (
                        <td
                          key={`${day}-${period}`}
                          className="border border-gray-200 bg-slate-200 text-slate-500 text-center align-middle h-11 overflow-hidden"
                          title={`会議: ${meeting.name}`}
                        >
                          <div className="font-semibold leading-tight truncate px-0.5">{meeting.name}</div>
                        </td>
                      );
                    }
                    return <td key={`${day}-${period}`} className="border border-gray-100 bg-gray-50 h-11" />;
                  }
                  const subject = subjects.find(s => s.id === cell.lesson.subjectId);
                  const classNames = cell.lesson.classIds
                    .map(id => classes.find(c => c.id === id)?.name)
                    .filter(Boolean)
                    .join('・');
                  return (
                    <td
                      key={`${day}-${period}`}
                      colSpan={cell.lesson.consecutive}
                      className={`border border-gray-100 text-center align-middle px-1 h-11 overflow-hidden ${SUBJECT_COLOR_CLASSES[subject?.color ?? 'blue']}`}
                    >
                      <div className="font-semibold leading-tight truncate">{subject?.name ?? '?'}</div>
                      <div className="opacity-70 truncate leading-tight">{classNames}</div>
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
