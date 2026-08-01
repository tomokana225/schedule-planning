import React, { useMemo, useState } from 'react';
import { Wand2, Trash2 } from 'lucide-react';
import { ExamSession, SchoolClass, Subject, TimetableSettings, SUBJECT_COLOR_CLASSES } from '../types';
import { generateId } from '../utils';

interface Props {
  settings: TimetableSettings;
  setSettings: React.Dispatch<React.SetStateAction<TimetableSettings>>;
  classes: SchoolClass[];
  subjects: Subject[];
  examSessions: ExamSession[];
  setExamSessions: React.Dispatch<React.SetStateAction<ExamSession[]>>;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const ExamTimetableEditor: React.FC<Props> = ({
  settings, setSettings, classes, subjects, examSessions, setExamSessions,
}) => {
  const examDays = settings.examDays ?? 3;
  const examPeriodsPerDay = settings.examPeriodsPerDay ?? 4;

  const [classId, setClassId] = useState<string | null>(classes[0]?.id ?? null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const currentClassId = classId && classes.some(c => c.id === classId) ? classId : classes[0]?.id ?? null;

  const sessionsForClass = useMemo(
    () => examSessions.filter(s => s.classId === currentClassId),
    [examSessions, currentClassId],
  );

  const sessionAt = (day: number, period: number) => sessionsForClass.find(s => s.day === day && s.period === period);

  const setSubjectAt = (day: number, period: number, subjectId: string) => {
    if (!currentClassId) return;
    setExamSessions(prev => {
      const withoutThis = prev.filter(s => !(s.classId === currentClassId && s.day === day && s.period === period));
      if (!subjectId) return withoutThis;
      return [...withoutThis, { id: generateId(), classId: currentClassId, day, period, subjectId }];
    });
  };

  const clearClass = () => {
    if (!currentClassId) return;
    setExamSessions(prev => prev.filter(s => s.classId !== currentClassId));
  };

  const autoAssign = () => {
    if (!currentClassId || selectedSubjectIds.length === 0) return;
    const slots: { day: number; period: number }[] = [];
    for (let day = 0; day < examDays; day++) {
      for (let period = 1; period <= examPeriodsPerDay; period++) slots.push({ day, period });
    }
    const shuffledSlots = shuffle(slots);
    const toPlace = shuffle(selectedSubjectIds).slice(0, shuffledSlots.length);
    const newSessions: ExamSession[] = toPlace.map((subjectId, i) => ({
      id: generateId(), classId: currentClassId, day: shuffledSlots[i].day, period: shuffledSlots[i].period, subjectId,
    }));
    setExamSessions(prev => [...prev.filter(s => s.classId !== currentClassId), ...newSessions]);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            試験日数：
            <input
              type="number" min={1} max={10} value={examDays}
              onChange={e => setSettings(s => ({ ...s, examDays: Number(e.target.value) }))}
              className="w-16 px-2 py-1 rounded border border-gray-200"
            />
          </label>
          <label className="flex items-center gap-2">
            1日の時限数：
            <input
              type="number" min={1} max={10} value={examPeriodsPerDay}
              onChange={e => setSettings(s => ({ ...s, examPeriodsPerDay: Number(e.target.value) }))}
              className="w-16 px-2 py-1 rounded border border-gray-200"
            />
          </label>
          <select
            value={currentClassId ?? ''}
            onChange={e => setClassId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={clearClass} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 px-2 py-1 rounded hover:bg-gray-100">
          <Trash2 size={14} />
          <span>このクラスをクリア</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="text-xs font-semibold text-gray-500 mb-2">出題科目を選択して自動作成</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {subjects.map(s => (
            <label key={s.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border cursor-pointer ${
              selectedSubjectIds.includes(s.id) ? SUBJECT_COLOR_CLASSES[s.color] : 'border-gray-200 text-gray-500'
            }`}>
              <input
                type="checkbox"
                checked={selectedSubjectIds.includes(s.id)}
                onChange={e => setSelectedSubjectIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}
                className="accent-indigo-600"
              />
              {s.name}
            </label>
          ))}
          {subjects.length === 0 && <span className="text-xs text-gray-400">科目が登録されていません</span>}
        </div>
        <button
          onClick={autoAssign}
          disabled={!currentClassId || selectedSubjectIds.length === 0}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md shadow-indigo-200"
        >
          <Wand2 size={16} />
          <span>自動作成</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        {!currentClassId ? (
          <div className="text-gray-400 text-sm">クラスを登録してください。</div>
        ) : (
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="w-14"></th>
                {Array.from({ length: examDays }, (_, i) => (
                  <th key={i} className="px-3 py-1 text-xs font-medium text-gray-500 text-center">{i + 1}日目</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: examPeriodsPerDay }, (_, pIdx) => {
                const period = pIdx + 1;
                return (
                  <tr key={period}>
                    <td className="text-xs text-gray-400 text-right pr-2">{period}時限</td>
                    {Array.from({ length: examDays }, (_, day) => {
                      const session = sessionAt(day, period);
                      const subject = session ? subjects.find(s => s.id === session.subjectId) : undefined;
                      return (
                        <td key={day} className="p-0.5">
                          <select
                            value={session?.subjectId ?? ''}
                            onChange={e => setSubjectAt(day, period, e.target.value)}
                            className={`w-28 h-10 rounded-md border text-xs text-center ${
                              subject ? SUBJECT_COLOR_CLASSES[subject.color] : 'bg-gray-50 border-dashed border-gray-200 text-gray-400'
                            }`}
                          >
                            <option value="">（なし）</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
