import React from 'react';
import { SchoolClass, Teacher, Subject, Lesson, Placement, Meeting, TimetableSettings, SUBJECT_COLOR_CLASSES } from '../types';
import { periodsForDay, maxPeriodsAcrossDays } from '../utils';

interface Props {
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  lessons: Lesson[];
  placements: Placement[];
  meetings: Meeting[];
  onOpenClass: (classId: string) => void;
}

// Shows every class's actual weekly timetable (subject + teacher per cell,
// not just occupancy dots), grouped by grade, so all classes/grades can be
// compared side by side without opening each one individually.
export const AllClassesOverview: React.FC<Props> = ({
  settings, classes, teachers, subjects, lessons, placements, meetings, onOpenClass,
}) => {
  const lessonById = new Map(lessons.map(l => [l.id, l]));

  const classTeacherIds = new Map<string, Set<string>>();
  for (const l of lessons) {
    for (const classId of l.classIds) {
      if (!classTeacherIds.has(classId)) classTeacherIds.set(classId, new Set());
      const set = classTeacherIds.get(classId)!;
      for (const t of l.teacherIds) set.add(t);
    }
  }
  const meetingBlockingClass = (classId: string, day: number, period: number): Meeting | undefined => {
    const teacherIds = classTeacherIds.get(classId);
    if (!teacherIds || teacherIds.size === 0) return undefined;
    return meetings.find(m => m.day === day && m.period === period && [...teacherIds].every(t => m.teacherIds.includes(t)));
  };

  const cellAt = (classId: string, day: number, period: number): { lesson: Lesson; placement: Placement } | null => {
    for (const p of placements) {
      const l = lessonById.get(p.lessonId);
      if (!l || !l.classIds.includes(classId)) continue;
      const span = l.consecutive;
      if (p.day === day && period >= p.period && period < p.period + span) return { lesson: l, placement: p };
    }
    return null;
  };

  const groups = new Map<string, SchoolClass[]>();
  for (const c of classes) {
    const key = c.grade || '学年未設定';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const gradeOrder = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'ja'));
  const periods = Array.from({ length: maxPeriodsAcrossDays(settings) }, (_, i) => i + 1);

  if (classes.length === 0) {
    return <div className="text-center text-gray-400 text-sm py-12">クラスが登録されていません</div>;
  }

  return (
    <div className="space-y-8">
      {gradeOrder.map(grade => (
        <div key={grade}>
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-indigo-500 rounded-full inline-block" />
            {grade}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {groups.get(grade)!.map(cls => (
              <div
                key={cls.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenClass(cls.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenClass(cls.id); }}
                className="text-left bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:border-indigo-300 hover:shadow-md transition overflow-x-auto cursor-pointer"
              >
                <div className="font-semibold text-sm text-gray-800 mb-2">{cls.name}</div>
                <table className="w-full border-collapse text-[10px] table-fixed">
                  <thead>
                    <tr>
                      <th className="w-5"></th>
                      {settings.days.map(d => (
                        <th key={d} className="text-gray-400 font-medium pb-1">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(period => (
                      <tr key={period} className={settings.lunchAfterPeriod === period ? 'border-b-2 border-amber-300' : ''}>
                        <td className="text-gray-400 text-center pr-1">{period}</td>
                        {settings.days.map((_, day) => {
                          if (period > periodsForDay(settings, day)) {
                            return <td key={day} className="bg-gray-100/60" title="この曜日にはこの時限がありません" />;
                          }
                          const cell = cellAt(cls.id, day, period);
                          if (cell && cell.placement.period !== period) return null; // covered by rowSpan above
                          if (!cell) {
                            const meeting = meetingBlockingClass(cls.id, day, period);
                            if (meeting) {
                              return (
                                <td key={day} className="border border-gray-100 h-6 bg-slate-200 text-slate-500 text-center overflow-hidden" title={`会議: ${meeting.name}`}>
                                  <span className="truncate block leading-tight">{meeting.name}</span>
                                </td>
                              );
                            }
                            return <td key={day} className="border border-gray-100 h-6 bg-gray-50" />;
                          }
                          const subject = subjects.find(s => s.id === cell.lesson.subjectId);
                          const teacherNames = cell.lesson.teacherIds
                            .map(id => teachers.find(t => t.id === id)?.short || teachers.find(t => t.id === id)?.name)
                            .filter(Boolean)
                            .join('・');
                          return (
                            <td
                              key={day}
                              rowSpan={cell.lesson.consecutive}
                              className={`border border-gray-100 text-center align-middle px-0.5 ${SUBJECT_COLOR_CLASSES[subject?.color ?? 'blue']}`}
                            >
                              <div className="font-semibold leading-tight truncate">{subject?.name ?? '?'}</div>
                              <div className="opacity-70 truncate leading-tight">{teacherNames}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
