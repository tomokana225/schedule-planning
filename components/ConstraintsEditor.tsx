import React, { useState } from 'react';
import { Ban } from 'lucide-react';
import { Teacher, TimetableSettings } from '../types';
import { hasSlot } from '../utils';

interface Props {
  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  settings: TimetableSettings;
}

export const ConstraintsEditor: React.FC<Props> = ({ teachers, setTeachers, settings }) => {
  const [selectedId, setSelectedId] = useState<string | null>(teachers[0]?.id ?? null);
  const selected = teachers.find(t => t.id === selectedId) || null;

  const toggleSlot = (day: number, period: number) => {
    if (!selected) return;
    setTeachers(prev => prev.map(t => {
      if (t.id !== selected.id) return t;
      const exists = hasSlot(t.unavailable, day, period);
      return {
        ...t,
        unavailable: exists
          ? t.unavailable.filter(s => !(s.day === day && s.period === period))
          : [...t.unavailable, { day, period }],
      };
    }));
  };

  return (
    <div className="flex h-full gap-4">
      <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">先生を選択</div>
        {teachers.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 flex items-center justify-between ${
              selectedId === t.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50'
            }`}
          >
            <span>{t.name}</span>
            {t.unavailable.length > 0 && <Ban size={13} className="text-red-400" />}
          </button>
        ))}
        {teachers.length === 0 && <div className="px-3 py-6 text-center text-xs text-gray-400">先生が登録されていません</div>}
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-auto">
        {!selected ? (
          <div className="text-gray-400 text-sm">先生を選択して、授業ができない曜日・時限を設定してください。</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">{selected.name} 先生の禁制設定</h3>
              <span className="text-xs text-gray-400">クリックした時限を「授業不可」に設定します</span>
            </div>
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="w-12"></th>
                  {settings.days.map((d, i) => (
                    <th key={i} className="px-3 py-1 text-xs font-medium text-gray-500 text-center">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: settings.periodsPerDay }, (_, pIdx) => {
                  const period = pIdx + 1;
                  return (
                    <tr key={period}>
                      <td className="text-xs text-gray-400 text-right pr-2">{period}限</td>
                      {settings.days.map((_, day) => {
                        const blocked = hasSlot(selected.unavailable, day, period);
                        return (
                          <td key={day} className="p-0.5">
                            <button
                              onClick={() => toggleSlot(day, period)}
                              className={`w-14 h-9 rounded-md border text-xs font-medium transition ${
                                blocked
                                  ? 'bg-red-100 border-red-300 text-red-600'
                                  : 'bg-gray-50 border-gray-200 text-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              {blocked ? '不可' : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};
