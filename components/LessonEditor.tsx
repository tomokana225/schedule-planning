import React from 'react';
import { Plus, Trash2, Heart } from 'lucide-react';
import { Lesson, SchoolClass, Teacher, Subject, Room, SUBJECT_COLOR_CLASSES } from '../types';
import { generateId } from '../utils';
import { MultiSelect } from './MultiSelect';

interface Props {
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
}

export const LessonEditor: React.FC<Props> = ({ lessons, setLessons, classes, teachers, subjects, rooms }) => {
  const update = (id: string, patch: Partial<Lesson>) => {
    setLessons(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  const addLesson = () => {
    setLessons(prev => [...prev, {
      id: generateId(),
      type: 'basic',
      classIds: classes[0] ? [classes[0].id] : [],
      teacherIds: teachers[0] ? [teachers[0].id] : [],
      subjectId: subjects[0]?.id || '',
      roomIds: rooms[0] ? [rooms[0].id] : [],
      weeklyCount: 1,
      consecutive: 1,
    }]);
  };

  const classOptions = classes.map(c => ({ id: c.id, name: c.name }));
  const teacherOptions = teachers.map(t => ({ id: t.id, name: t.name }));
  const roomOptions = rooms.map(r => ({ id: r.id, name: r.name }));

  const specialNeedsClasses = classes.filter(c => c.isSpecialNeeds && c.exchangeClassId);

  const addJointLesson = (specialClassId: string, exchangeClassId: string) => {
    setLessons(prev => [...prev, {
      id: generateId(),
      type: 'selective',
      classIds: [specialClassId, exchangeClassId],
      teacherIds: teachers[0] ? [teachers[0].id] : [],
      subjectId: subjects[0]?.id || '',
      roomIds: rooms[0] ? [rooms[0].id] : [],
      weeklyCount: 1,
      consecutive: 1,
      label: '交流学級合同',
    }]);
  };

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs text-gray-500 mb-3">
        「基本授業」はクラス・先生・教室が1つずつの通常授業、「選択授業」は合同・展開・TTなど複数のクラスや先生が関わる授業です。
      </p>

      {specialNeedsClasses.length > 0 && (
        <div className="mb-4 bg-rose-50 border border-rose-100 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 mb-2">
            <Heart size={14} />
            <span>特別支援学級：交流学級との合同授業をすぐに登録</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {specialNeedsClasses.map(c => {
              const exchange = classes.find(x => x.id === c.exchangeClassId);
              if (!exchange) return null;
              return (
                <button
                  key={c.id}
                  onClick={() => addJointLesson(c.id, exchange.id)}
                  className="flex items-center gap-1.5 text-xs bg-white border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition"
                >
                  <Plus size={12} />
                  <span>{c.name} × {exchange.name} の合同授業を追加</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 text-left text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium w-24">種別</th>
              <th className="px-3 py-2 font-medium">クラス</th>
              <th className="px-3 py-2 font-medium w-36">科目</th>
              <th className="px-3 py-2 font-medium">先生</th>
              <th className="px-3 py-2 font-medium">教室</th>
              <th className="px-3 py-2 font-medium w-20">週コマ数</th>
              <th className="px-3 py-2 font-medium w-20">連続</th>
              <th className="px-3 py-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lessons.map(l => {
              const subject = subjects.find(s => s.id === l.subjectId);
              return (
                <tr key={l.id} className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2">
                    <select
                      value={l.type}
                      onChange={e => update(l.id, { type: e.target.value as Lesson['type'] })}
                      className="w-full px-1.5 py-1 rounded border border-gray-200 bg-white"
                    >
                      <option value="basic">基本授業</option>
                      <option value="selective">選択授業</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <MultiSelect options={classOptions} selected={l.classIds} onChange={ids => update(l.id, { classIds: ids })} placeholder="クラス選択" />
                  </td>
                  <td className="px-3 py-2 min-w-[110px]">
                    <select
                      value={l.subjectId}
                      onChange={e => update(l.id, { subjectId: e.target.value })}
                      className={`w-full px-1.5 py-1 rounded border ${subject ? SUBJECT_COLOR_CLASSES[subject.color] : 'border-gray-200'}`}
                    >
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <MultiSelect options={teacherOptions} selected={l.teacherIds} onChange={ids => update(l.id, { teacherIds: ids })} placeholder="先生選択" />
                  </td>
                  <td className="px-3 py-2 min-w-[140px]">
                    <MultiSelect options={roomOptions} selected={l.roomIds} onChange={ids => update(l.id, { roomIds: ids })} placeholder="教室選択" />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={l.weeklyCount}
                      onChange={e => update(l.id, { weeklyCount: Number(e.target.value) })}
                      className="w-16 px-1.5 py-1 rounded border border-gray-200"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={l.consecutive}
                      onChange={e => update(l.id, { consecutive: Number(e.target.value) as 1 | 2 })}
                      className="w-full px-1.5 py-1 rounded border border-gray-200 bg-white"
                    >
                      <option value={1}>1時間</option>
                      <option value={2}>2連続</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => setLessons(prev => prev.filter(x => x.id !== l.id))} className="text-gray-300 hover:text-red-500 p-1">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lessons.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">授業が登録されていません。「追加」から登録してください。</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={addLesson}
        className="mt-3 flex items-center space-x-1.5 self-start text-sm font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"
      >
        <Plus size={16} />
        <span>授業を追加</span>
      </button>
    </div>
  );
};
