import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { ChatMessage, SchoolClass, Teacher, Subject, Lesson, Placement, TimetableSettings } from '../types';
import { generateId } from '../utils';
import { sendMessageToAI, TimetableAIContext } from '../services/geminiService';
import { computeUnplaced } from './TimetableGrid';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  lessons: Lesson[];
  placements: Placement[];
}

export const AIAssistant: React.FC<Props> = ({
  isOpen, onClose, settings, classes, teachers, subjects, lessons, placements,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: generateId(), role: 'model', text: 'こんにちは。時間割の未配置授業や駒の調整について、何でも聞いてください。' },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const buildContext = (): TimetableAIContext => {
    const unplaced = computeUnplaced(lessons, placements);
    return {
      schoolName: settings.schoolName,
      days: settings.days,
      periodsPerDay: settings.periodsPerDay,
      classes: classes.map(c => ({ name: c.name })),
      teachers: teachers.map(t => ({ name: t.name, unavailableCount: t.unavailable.length })),
      subjects: subjects.map(s => ({ name: s.name })),
      unplaced: unplaced.map(({ lesson, remaining }) => ({
        subjectName: subjects.find(s => s.id === lesson.subjectId)?.name ?? '?',
        classNames: lesson.classIds.map(id => classes.find(c => c.id === id)?.name).join('・'),
        teacherNames: lesson.teacherIds.map(id => teachers.find(t => t.id === id)?.name).join('・'),
        remaining,
      })),
      totalLessons: lessons.reduce((s, l) => s + l.weeklyCount, 0),
      totalPlacements: placements.length,
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const userMsg: ChatMessage = { id: generateId(), role: 'user', text: input.trim() };
    const history = messages;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);
    try {
      const res = await sendMessageToAI(userMsg.text, history, buildContext());
      setMessages(prev => [...prev, { id: generateId(), role: 'model', text: res.text || '(応答がありませんでした)' }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { id: generateId(), role: 'model', text: `エラーが発生しました: ${e.message}` }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div
      className={`no-print fixed top-0 right-0 h-full w-full sm:w-96 bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
            <Sparkles size={18} />
          </div>
          <h3 className="font-semibold text-gray-900">AI手直しアシスタント</h3>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-sm text-sm">考え中...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="未配置の授業について相談する..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button onClick={handleSend} disabled={isThinking} className="text-indigo-600 disabled:text-gray-300">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
