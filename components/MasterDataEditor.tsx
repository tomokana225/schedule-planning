import React, { useState } from 'react';
import { Plus, Trash2, Users, BookOpen, DoorOpen, GraduationCap } from 'lucide-react';
import { SchoolClass, Teacher, Subject, Room, SUBJECT_COLORS, SUBJECT_COLOR_CLASSES } from '../types';
import { generateId } from '../utils';

type Tab = 'classes' | 'teachers' | 'subjects' | 'rooms';

interface Props {
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  setClasses: React.Dispatch<React.SetStateAction<SchoolClass[]>>;
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  setSubjects: React.Dispatch<React.SetStateAction<Subject[]>>;
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
}

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'classes', label: 'クラス', icon: <GraduationCap size={16} /> },
  { key: 'teachers', label: '先生', icon: <Users size={16} /> },
  { key: 'subjects', label: '科目', icon: <BookOpen size={16} /> },
  { key: 'rooms', label: '教室', icon: <DoorOpen size={16} /> },
];

export const MasterDataEditor: React.FC<Props> = ({
  classes, teachers, subjects, rooms, setClasses, setTeachers, setSubjects, setRooms,
}) => {
  const [tab, setTab] = useState<Tab>('classes');

  const addRow = () => {
    if (tab === 'classes') {
      setClasses(prev => [...prev, { id: generateId(), name: `新しいクラス${prev.length + 1}` }]);
    } else if (tab === 'teachers') {
      setTeachers(prev => [...prev, { id: generateId(), name: `先生${prev.length + 1}`, unavailable: [] }]);
    } else if (tab === 'subjects') {
      setSubjects(prev => [...prev, {
        id: generateId(),
        name: `科目${prev.length + 1}`,
        color: SUBJECT_COLORS[prev.length % SUBJECT_COLORS.length],
        maxPerDayPerClass: 1,
      }]);
    } else {
      setRooms(prev => [...prev, { id: generateId(), name: `教室${prev.length + 1}` }]);
    }
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

      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 text-left text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">名称</th>
              {tab === 'teachers' && <th className="px-4 py-2 font-medium">略称</th>}
              {tab === 'teachers' && <th className="px-4 py-2 font-medium">1日の最大授業数</th>}
              {tab === 'subjects' && <th className="px-4 py-2 font-medium">色</th>}
              {tab === 'subjects' && <th className="px-4 py-2 font-medium">1日の最大回数（同クラス）</th>}
              {tab === 'classes' && <th className="px-4 py-2 font-medium">学年</th>}
              <th className="px-4 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tab === 'classes' && classes.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-1.5">
                  <input
                    className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    value={c.name}
                    onChange={e => setClasses(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))}
                  />
                </td>
                <td className="px-4 py-1.5">
                  <input
                    className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    value={c.grade || ''}
                    placeholder="例: 1年"
                    onChange={e => setClasses(prev => prev.map(x => x.id === c.id ? { ...x, grade: e.target.value } : x))}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => setClasses(prev => prev.filter(x => x.id !== c.id))} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}

            {tab === 'teachers' && teachers.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-1.5">
                  <input
                    className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    value={t.name}
                    onChange={e => setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))}
                  />
                </td>
                <td className="px-4 py-1.5">
                  <input
                    className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    value={t.short || ''}
                    onChange={e => setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, short: e.target.value } : x))}
                  />
                </td>
                <td className="px-4 py-1.5">
                  <input
                    type="number"
                    min={0}
                    className="w-24 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    value={t.maxPerDay ?? ''}
                    placeholder="制限なし"
                    onChange={e => setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, maxPerDay: e.target.value ? Number(e.target.value) : undefined } : x))}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => setTeachers(prev => prev.filter(x => x.id !== t.id))} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}

            {tab === 'subjects' && subjects.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-1.5">
                  <input
                    className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    value={s.name}
                    onChange={e => setSubjects(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                  />
                </td>
                <td className="px-4 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {SUBJECT_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setSubjects(prev => prev.map(x => x.id === s.id ? { ...x, color: c } : x))}
                        className={`w-6 h-6 rounded-full border-2 ${SUBJECT_COLOR_CLASSES[c]} ${s.color === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-1.5">
                  <input
                    type="number"
                    min={1}
                    className="w-24 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    value={s.maxPerDayPerClass ?? 1}
                    onChange={e => setSubjects(prev => prev.map(x => x.id === s.id ? { ...x, maxPerDayPerClass: Number(e.target.value) } : x))}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => setSubjects(prev => prev.filter(x => x.id !== s.id))} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}

            {tab === 'rooms' && rooms.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-1.5">
                  <input
                    className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none"
                    value={r.name}
                    onChange={e => setRooms(prev => prev.map(x => x.id === r.id ? { ...x, name: e.target.value } : x))}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => setRooms(prev => prev.filter(x => x.id !== r.id))} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addRow}
        className="mt-3 flex items-center space-x-1.5 self-start text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
      >
        <Plus size={16} />
        <span>追加</span>
      </button>
    </div>
  );
};
