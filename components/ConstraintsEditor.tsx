import React, { useState } from 'react';
import { Ban, Users, GraduationCap, BookOpen, DoorOpen, SlidersHorizontal, Plus, Copy, Trash2 } from 'lucide-react';
import {
  Teacher, SchoolClass, Subject, Room, TimetableSettings, SlotKey, SchedulerOptions, DEFAULT_SCHEDULER_OPTIONS,
} from '../types';
import { hasSlot, periodsForDay, maxPeriodsAcrossDays } from '../utils';

type Tab = 'teachers' | 'classes' | 'subjects' | 'rooms' | 'options';

interface Props {
  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  classes: SchoolClass[];
  setClasses: React.Dispatch<React.SetStateAction<SchoolClass[]>>;
  subjects: Subject[];
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  settings: TimetableSettings;
  optionPresets: SchedulerOptions[];
  setOptionPresets: React.Dispatch<React.SetStateAction<SchedulerOptions[]>>;
  activeOptionId: string;
  setActiveOptionId: (id: string) => void;
}

const UnavailableGrid: React.FC<{
  settings: TimetableSettings;
  unavailable: SlotKey[];
  onToggle: (day: number, period: number) => void;
}> = ({ settings, unavailable, onToggle }) => (
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
      {Array.from({ length: maxPeriodsAcrossDays(settings) }, (_, pIdx) => {
        const period = pIdx + 1;
        return (
          <tr key={period}>
            <td className="text-xs text-gray-400 text-right pr-2">{period}限</td>
            {settings.days.map((_, day) => {
              if (period > periodsForDay(settings, day)) {
                return <td key={day} className="p-0.5"><div className="w-14 h-9 rounded-md bg-gray-100/60" /></td>;
              }
              const blocked = hasSlot(unavailable, day, period);
              return (
                <td key={day} className="p-0.5">
                  <button
                    onClick={() => onToggle(day, period)}
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
);

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'teachers', label: '先生', icon: <Users size={16} /> },
  { key: 'classes', label: 'クラス', icon: <GraduationCap size={16} /> },
  { key: 'subjects', label: '科目', icon: <BookOpen size={16} /> },
  { key: 'rooms', label: '教室', icon: <DoorOpen size={16} /> },
  { key: 'options', label: '全体オプション', icon: <SlidersHorizontal size={16} /> },
];

export const ConstraintsEditor: React.FC<Props> = ({
  teachers, setTeachers, classes, setClasses, subjects, setSubjects, rooms, setRooms, settings,
  optionPresets, setOptionPresets, activeOptionId, setActiveOptionId,
}) => {
  const [tab, setTab] = useState<Tab>('teachers');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entityList = tab === 'teachers' ? teachers : tab === 'classes' ? classes : tab === 'subjects' ? subjects : tab === 'rooms' ? rooms : [];
  const currentId = selectedId && entityList.some(e => e.id === selectedId) ? selectedId : entityList[0]?.id ?? null;

  const toggleSlot = (day: number, period: number) => {
    if (!currentId) return;
    const update = <T extends { id: string; unavailable: SlotKey[] }>(prev: T[]): T[] => prev.map(t => {
      if (t.id !== currentId) return t;
      const exists = hasSlot(t.unavailable, day, period);
      return {
        ...t,
        unavailable: exists
          ? t.unavailable.filter(s => !(s.day === day && s.period === period))
          : [...t.unavailable, { day, period }],
      };
    });
    if (tab === 'teachers') setTeachers(update);
    else if (tab === 'classes') setClasses(update);
    else if (tab === 'subjects') setSubjects(update);
    else if (tab === 'rooms') setRooms(update);
  };

  const activeOption = optionPresets.find(o => o.id === activeOptionId) ?? optionPresets[0];

  const updateOption = (id: string, patch: Partial<SchedulerOptions>) => {
    setOptionPresets(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  };

  const addPreset = () => {
    const preset = DEFAULT_SCHEDULER_OPTIONS(`オプション${optionPresets.length + 1}`);
    setOptionPresets(prev => [...prev, preset]);
    setActiveOptionId(preset.id);
  };

  const duplicatePreset = (id: string) => {
    const src = optionPresets.find(o => o.id === id);
    if (!src) return;
    const preset: SchedulerOptions = { ...src, id: DEFAULT_SCHEDULER_OPTIONS().id, name: `${src.name}のコピー` };
    setOptionPresets(prev => [...prev, preset]);
  };

  const removePreset = (id: string) => {
    if (optionPresets.length <= 1) return;
    setOptionPresets(prev => prev.filter(o => o.id !== id));
    if (activeOptionId === id) setActiveOptionId(optionPresets.find(o => o.id !== id)!.id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 w-fit mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.key ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab !== 'options' ? (
        <div className="flex h-full gap-4 flex-1 overflow-hidden">
          <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">対象を選択</div>
            {entityList.map(e => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 flex items-center justify-between ${
                  currentId === e.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50'
                }`}
              >
                <span>{e.name}</span>
                {(e as any).unavailable?.length > 0 && <Ban size={13} className="text-red-400" />}
              </button>
            ))}
            {entityList.length === 0 && <div className="px-3 py-6 text-center text-xs text-gray-400">データが登録されていません</div>}
          </div>

          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-auto">
            {!currentId ? (
              <div className="text-gray-400 text-sm">左の一覧から対象を選択して、個別条件を設定してください。</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">
                    {entityList.find(e => e.id === currentId)?.name} の禁制設定
                  </h3>
                  <span className="text-xs text-gray-400">クリックした時限を「配置不可」に設定します</span>
                </div>

                {tab === 'teachers' && (
                  <div className="mb-4 flex items-center gap-2 text-sm">
                    <label className="text-gray-600">1日の最大授業数：</label>
                    <input
                      type="number"
                      min={0}
                      className="w-24 px-2 py-1 rounded border border-gray-200"
                      value={(teachers.find(t => t.id === currentId)?.maxPerDay) ?? ''}
                      placeholder="制限なし"
                      onChange={e => setTeachers(prev => prev.map(t => t.id === currentId ? { ...t, maxPerDay: e.target.value ? Number(e.target.value) : undefined } : t))}
                    />
                  </div>
                )}
                {tab === 'subjects' && (
                  <div className="mb-4 flex items-center gap-2 text-sm">
                    <label className="text-gray-600">1日の最大回数（同クラス）：</label>
                    <input
                      type="number"
                      min={1}
                      className="w-24 px-2 py-1 rounded border border-gray-200"
                      value={(subjects.find(s => s.id === currentId)?.maxPerDayPerClass) ?? 1}
                      onChange={e => setSubjects(prev => prev.map(s => s.id === currentId ? { ...s, maxPerDayPerClass: Number(e.target.value) } : s))}
                    />
                  </div>
                )}

                <UnavailableGrid
                  settings={settings}
                  unavailable={(entityList.find(e => e.id === currentId) as any)?.unavailable ?? []}
                  onToggle={toggleSlot}
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <p className="text-xs text-gray-500 mb-3">
            駒入れ（自動作成）の動作条件をプリセットとして複数保存し、状況に応じて切り替えられます。
            「時間割作成」画面の自動駒入れは、ここで選択中のオプションを使用します。
          </p>
          <div className="space-y-3">
            {optionPresets.map(opt => (
              <div
                key={opt.id}
                className={`bg-white rounded-xl border shadow-sm p-4 ${activeOptionId === opt.id ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="active-option"
                      checked={activeOptionId === opt.id}
                      onChange={() => setActiveOptionId(opt.id)}
                      className="accent-indigo-600"
                    />
                    <input
                      value={opt.name}
                      onChange={e => updateOption(opt.id, { name: e.target.value })}
                      className="font-semibold text-gray-800 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    />
                    {activeOptionId === opt.id && (
                      <span className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">使用中</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => duplicatePreset(opt.id)} title="複製" className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-gray-50">
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => removePreset(opt.id)}
                      title="削除"
                      disabled={optionPresets.length <= 1}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-50 disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={opt.avoidConsecutiveSameSubject}
                      onChange={e => updateOption(opt.id, { avoidConsecutiveSameSubject: e.target.checked })}
                      className="accent-indigo-600"
                    />
                    <span>同じ科目を連続時限に置かない</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={opt.spreadEvenly}
                      onChange={e => updateOption(opt.id, { spreadEvenly: e.target.checked })}
                      className="accent-indigo-600"
                    />
                    <span>曜日ごとに均等分散させる</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-600">試行回数：</span>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={opt.maxAttempts}
                      onChange={e => updateOption(opt.id, { maxAttempts: Math.min(200, Math.max(1, Number(e.target.value) || 1)) })}
                      className="w-20 px-2 py-1 rounded border border-gray-200"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addPreset}
            className="mt-3 flex items-center space-x-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
          >
            <Plus size={16} />
            <span>プリセットを追加</span>
          </button>
        </div>
      )}
    </div>
  );
};
