import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Wand2, X } from 'lucide-react';
import {
  SchoolClass, Teacher, Room, Subject, Lesson, Placement, Meeting, TimetableSettings, SchedulerOptions,
  SUBJECT_COLOR_CLASSES,
} from '../types';
import { periodsForDay } from '../utils';
import { SchedulerContext } from '../services/scheduler';
import { diagnoseGap, applyGapFix, GapDiagnosis } from '../services/suggestionService';

interface Props {
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  rooms: Room[];
  subjects: Subject[];
  lessons: Lesson[];
  placements: Placement[];
  meetings: Meeting[];
  activeOption: SchedulerOptions;
  onOpenClass: (classId: string) => void;
  setPlacements: React.Dispatch<React.SetStateAction<Placement[]>>;
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
  settings, classes, teachers, rooms, subjects, lessons, placements, meetings, activeOption, onOpenClass, setPlacements,
}) => {
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  const ctx: SchedulerContext = { settings, classes, teachers, subjects, rooms, lessons, options: activeOption, meetings };
  const [activeGap, setActiveGap] = useState<GapEntry | null>(null);
  const [diagnosis, setDiagnosis] = useState<GapDiagnosis | null>(null);

  const lessonLabel = (lesson: Lesson) => {
    const subject = subjects.find(s => s.id === lesson.subjectId);
    const teacherNames = lesson.teacherIds.map(id => teachers.find(t => t.id === id)?.short || teachers.find(t => t.id === id)?.name).filter(Boolean).join('・');
    return `${subject?.name ?? '?'}${teacherNames ? `（${teacherNames}）` : ''}`;
  };
  const placementLabel = (p: Placement) => {
    const l = lessonById.get(p.lessonId);
    return l ? lessonLabel(l) : '?';
  };

  const openGap = (gap: GapEntry) => {
    setActiveGap(gap);
    setDiagnosis(diagnoseGap(ctx, placements, gap.classId, gap.day, gap.period, lessonLabel, placementLabel));
  };
  const closeGap = () => { setActiveGap(null); setDiagnosis(null); };

  const applyFix = () => {
    if (!activeGap || !diagnosis?.plan) return;
    const { day, period } = activeGap;
    const plan = diagnosis.plan;
    setPlacements(prev => applyGapFix(prev, plan, day, period));
    closeGap();
  };
  // 曜日ごとに実際に存在する時限のリスト（例: 月曜だけ5時限までなど）
  const periodsByDay = settings.days.map((_, day) =>
    Array.from({ length: periodsForDay(settings, day) }, (_, i) => i + 1),
  );

  const orderedClasses = useMemo(
    () => [...classes].sort((a, b) => (a.grade || '').localeCompare(b.grade || '', 'ja')),
    [classes],
  );

  // クラスが受け持つ全先生（そのクラスの授業に登場する先生）を求めておき、その全員が
  // 会議で拘束されている枠は「空きコマ」ではなく会議中として扱う（誰も授業できない）。
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

  const gaps: GapEntry[] = [];
  for (const cls of orderedClasses) {
    for (let day = 0; day < settings.days.length; day++) {
      for (const period of periodsByDay[day]) {
        if (!cellAt(cls.id, day, period) && !meetingBlockingClass(cls.id, day, period)) {
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
            エラー: 空きコマが {gaps.length} 件あります（下表の赤いセル、クリックすると原因と解決方法を確認できます）
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
            {[...gapsByClass.entries()].map(([classId, entries]) => (
              <div key={classId} className="flex flex-wrap items-baseline gap-x-1">
                <button onClick={() => onOpenClass(classId)} className="font-semibold hover:underline">
                  {entries[0].className}
                </button>
                {': '}
                {entries.map((e, i) => (
                  <React.Fragment key={`${e.day}-${e.period}`}>
                    <button onClick={() => openGap(e)} className="hover:underline hover:text-red-900">
                      {settings.days[e.day]}{e.period}限
                    </button>
                    {i < entries.length - 1 && '、'}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-auto border border-gray-200 rounded-xl">
        <table className="border-collapse text-[11px] table-fixed">
          <colgroup>
            <col style={{ width: '3.5rem' }} />
            <col style={{ width: '4.5rem' }} />
            {settings.days.flatMap((_, dayIdx) =>
              periodsByDay[dayIdx].map(period => <col key={`col-${dayIdx}-${period}`} style={{ width: '2.75rem' }} />),
            )}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-20 bg-gray-100 border border-gray-200 px-2 py-1">学年</th>
              <th rowSpan={2} className="sticky left-14 top-0 z-20 bg-gray-100 border border-gray-200 px-2 py-1">クラス</th>
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
                      title={grade || '未設定'}
                      className="sticky left-0 z-10 bg-white border border-gray-200 px-2 py-1 font-semibold text-gray-700 align-top truncate"
                    >
                      {grade || '未設定'}
                    </td>
                  )}
                  <td
                    title={cls.name}
                    className="sticky left-14 z-10 bg-white border border-gray-200 px-2 py-1 font-medium text-gray-700 truncate cursor-pointer hover:text-indigo-600"
                    onClick={() => onOpenClass(cls.id)}
                  >
                    {cls.name}
                  </td>
                  {settings.days.map((_, day) =>
                    periodsByDay[day].map(period => {
                      const cell = cellAt(cls.id, day, period);
                      if (cell && cell.placement.period !== period) return null; // covered by colSpan
                      if (!cell) {
                        const meeting = meetingBlockingClass(cls.id, day, period);
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
                        return (
                          <td
                            key={`${day}-${period}`}
                            onClick={() => openGap({ classId: cls.id, className: cls.name, day, period })}
                            className="border border-red-200 bg-red-50 text-red-400 text-center align-middle h-11 cursor-pointer hover:bg-red-100"
                            title={`${cls.name} ${settings.days[day]}${period}限が空いています（クリックして原因を確認）`}
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
                          className={`border border-gray-100 text-center align-middle px-1 h-11 overflow-hidden ${SUBJECT_COLOR_CLASSES[subject?.color ?? 'blue']}`}
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

      {activeGap && diagnosis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={closeGap}>
          <div
            className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-md w-full p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-800">
                {activeGap.className} {settings.days[activeGap.day]}{activeGap.period}限の空きコマ
              </h3>
              <button onClick={closeGap} className="text-gray-400 hover:text-gray-600 p-1 -m-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{diagnosis.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={closeGap} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50">
                閉じる
              </button>
              {diagnosis.plan && (
                <button
                  onClick={applyFix}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow-md shadow-indigo-200"
                >
                  <Wand2 size={15} />
                  <span>ワンクリックで解決</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
