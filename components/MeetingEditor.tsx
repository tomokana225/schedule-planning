import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Meeting, Teacher, Room, TimetableSettings } from '../types';
import { generateId, periodsForDay } from '../utils';
import { MultiSelect } from './MultiSelect';

interface Props {
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  teachers: Teacher[];
  rooms: Room[];
  settings: TimetableSettings;
}

export const MeetingEditor: React.FC<Props> = ({ meetings, setMeetings, teachers, rooms, settings }) => {
  const update = (id: string, patch: Partial<Meeting>) => {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  };

  const addMeeting = () => {
    setMeetings(prev => [...prev, {
      id: generateId(),
      name: `会議${prev.length + 1}`,
      day: 0,
      period: periodsForDay(settings, 0),
      teacherIds: [],
      roomId: undefined,
    }]);
  };

  const teacherOptions = teachers.map(t => ({ id: t.id, name: t.name }));

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs text-gray-500 mb-3">
        職員会議や学年会など、特定の曜日・時限に先生（・教室）を拘束する予定を登録します。
        登録した会議の時間は、駒入れの際にその先生・教室へ授業が配置されないよう自動的に避けられます。
      </p>
      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 text-left text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">名称</th>
              <th className="px-3 py-2 font-medium w-24">曜日</th>
              <th className="px-3 py-2 font-medium w-20">時限</th>
              <th className="px-3 py-2 font-medium">対象の先生</th>
              <th className="px-3 py-2 font-medium w-36">使用教室</th>
              <th className="px-3 py-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {meetings.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 align-top">
                <td className="px-3 py-2">
                  <input
                    value={m.name}
                    onChange={e => update(m.id, { name: e.target.value })}
                    className="w-full px-1.5 py-1 rounded border border-gray-200"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={m.day}
                    onChange={e => {
                      const day = Number(e.target.value);
                      update(m.id, { day, period: Math.min(m.period, periodsForDay(settings, day)) });
                    }}
                    className="w-full px-1.5 py-1 rounded border border-gray-200 bg-white"
                  >
                    {settings.days.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={m.period}
                    onChange={e => update(m.id, { period: Number(e.target.value) })}
                    className="w-full px-1.5 py-1 rounded border border-gray-200 bg-white"
                  >
                    {Array.from({ length: periodsForDay(settings, m.day) }, (_, i) => i + 1).map(p => (
                      <option key={p} value={p}>{p}限</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <MultiSelect options={teacherOptions} selected={m.teacherIds} onChange={ids => update(m.id, { teacherIds: ids })} placeholder="先生を選択" />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={m.roomId ?? ''}
                    onChange={e => update(m.id, { roomId: e.target.value || undefined })}
                    className="w-full px-1.5 py-1 rounded border border-gray-200 bg-white"
                  >
                    <option value="">（指定なし）</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setMeetings(prev => prev.filter(x => x.id !== m.id))} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {meetings.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">会議が登録されていません。「追加」から登録してください。</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={addMeeting}
        className="mt-3 flex items-center space-x-1.5 self-start text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
      >
        <Plus size={16} />
        <span>会議を追加</span>
      </button>
    </div>
  );
};
