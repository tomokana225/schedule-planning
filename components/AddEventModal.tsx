import React, { useState, useEffect } from 'react';
import { X, Clock, AlignLeft, Calendar as CalendarIcon, Tag } from 'lucide-react';
import { CalendarEvent } from '../types';
import { generateId } from '../utils';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (event: CalendarEvent) => void;
  initialDate: Date;
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  initialDate,
}) => {
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarEvent['type']>('work');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      // Format date as YYYY-MM-DD for input[type="date"]
      const year = initialDate.getFullYear();
      const month = String(initialDate.getMonth() + 1).padStart(2, '0');
      const day = String(initialDate.getDate()).padStart(2, '0');
      setDateStr(`${year}-${month}-${day}`);
      
      setStartTime('09:00');
      setEndTime('10:00');
      setDescription('');
      setType('work');
    }
  }, [isOpen, initialDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateStr || !startTime || !endTime) return;

    const startDateTime = new Date(`${dateStr}T${startTime}`);
    const endDateTime = new Date(`${dateStr}T${endTime}`);

    // Simple validation
    if (endDateTime <= startDateTime) {
      alert('終了時刻は開始時刻より後に設定してください。');
      return;
    }

    const newEvent: CalendarEvent = {
      id: generateId(),
      title,
      start: startDateTime,
      end: endDateTime,
      description,
      type,
      color: type === 'work' ? 'blue' : type === 'personal' ? 'green' : 'purple', // Color mapping will be handled by EVENT_COLORS in utils, but keeping a fallback here just in case
      source: 'local'
    };

    onAdd(newEvent);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            新しい予定を作成
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：週次ミーティング"
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
              autoFocus
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <CalendarIcon size={14} /> 日付
            </label>
            <input
              type="date"
              required
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Clock size={14} /> 開始
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Clock size={14} /> 終了
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
              />
            </div>
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Tag size={14} /> カテゴリ
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setType('work')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  type === 'work' 
                    ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500 ring-offset-1' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                仕事
              </button>
              <button
                type="button"
                onClick={() => setType('personal')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  type === 'personal' 
                    ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500 ring-offset-1' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                プライベート
              </button>
              <button
                type="button"
                onClick={() => setType('meeting')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  type === 'meeting' 
                    ? 'bg-purple-50 border-purple-200 text-purple-700 ring-2 ring-purple-500 ring-offset-1' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                会議
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <AlignLeft size={14} /> メモ（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細を入力..."
              rows={3}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 resize-none"
            />
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm shadow-indigo-200 transition-all active:scale-[0.98]"
          >
            追加する
          </button>
        </div>

      </div>
    </div>
  );
};
