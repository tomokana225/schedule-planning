import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { TimetableSettings } from '../types';

interface Props {
  settings: TimetableSettings;
  onSave: (settings: TimetableSettings) => void;
}

export const SetupWizard: React.FC<Props> = ({ settings, onSave }) => {
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [dayCount, setDayCount] = useState(settings.days.length);
  const [periodsPerDay, setPeriodsPerDay] = useState(settings.periodsPerDay);
  const [lunchAfterPeriod, setLunchAfterPeriod] = useState(settings.lunchAfterPeriod ?? 4);

  const allDayNames = ['月', '火', '水', '木', '金', '土', '日'];

  const handleSave = () => {
    onSave({
      schoolName,
      days: allDayNames.slice(0, dayCount),
      periodsPerDay,
      lunchAfterPeriod,
    });
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-600 rounded-xl text-white">
          <CalendarDays size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">基本設定</h2>
          <p className="text-xs text-gray-500">時間割の最大の枠組みを決定します</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学校名</label>
          <input
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            placeholder="例：イデア学園"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">週の日数</label>
            <select
              value={dayCount}
              onChange={e => setDayCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value={5}>5日制（月〜金）</option>
              <option value={6}>6日制（月〜土）</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">1日の時限数</label>
            <input
              type="number"
              min={1}
              max={10}
              value={periodsPerDay}
              onChange={e => setPeriodsPerDay(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">昼休みの位置（何限の後か）</label>
          <input
            type="number"
            min={0}
            max={periodsPerDay}
            value={lunchAfterPeriod}
            onChange={e => setLunchAfterPeriod(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg shadow-md shadow-indigo-200 transition"
      >
        この設定で次へ進む
      </button>
    </div>
  );
};
