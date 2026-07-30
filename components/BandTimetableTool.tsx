import React, { useMemo, useState } from 'react';
import { Wand2, RefreshCw, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import {
  Lesson, Placement, SchoolClass, Teacher, Subject, Room, TimetableSettings, SchedulerOptions,
  SUBJECT_COLOR_CLASSES,
} from '../types';
import { generateId } from '../utils';
import { runScheduler, SchedulerContext } from '../services/scheduler';
import { createBandSettings, sliceBandToWeek, weeklyKomaOf } from '../services/bandService';

interface Props {
  settings: TimetableSettings;
  setSettings: React.Dispatch<React.SetStateAction<TimetableSettings>>;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  lessons: Lesson[];
  bandPlacements: Placement[];
  setBandPlacements: React.Dispatch<React.SetStateAction<Placement[]>>;
  bandWeekOffset: number;
  setBandWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  activeOption: SchedulerOptions;
}

export const BandTimetableTool: React.FC<Props> = ({
  settings, setSettings, classes, teachers, subjects, rooms, lessons,
  bandPlacements, setBandPlacements, bandWeekOffset, setBandWeekOffset, activeOption,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [viewClassId, setViewClassId] = useState<string | null>(classes[0]?.id ?? null);
  const currentClassId = viewClassId && classes.some(c => c.id === viewClassId) ? viewClassId : classes[0]?.id ?? null;

  const weeklyKoma = weeklyKomaOf(settings);
  const bandTotalKoma = settings.bandTotalKoma || weeklyKoma;
  const lessonById = useMemo(() => new Map(lessons.map(l => [l.id, l])), [lessons]);

  const handleRunBand = () => {
    setIsRunning(true);
    setTimeout(() => {
      const bandCtx: SchedulerContext = {
        settings: createBandSettings(settings),
        classes, teachers, subjects, rooms, lessons,
        options: activeOption,
        isBandMode: true,
      };
      const result = runScheduler(bandCtx, bandPlacements);
      setBandPlacements(result.placements);
      setIsRunning(false);
    }, 50);
  };

  const toggleConfirm = (placementId: string) => {
    setBandPlacements(prev => prev.map(p => p.id === placementId ? { ...p, confirmed: !p.confirmed } : p));
  };

  const positionsPerRow = settings.periodsPerDay;
  const bandRows = Math.ceil(bandTotalKoma / positionsPerRow);

  const slicedWeek = useMemo(
    () => currentClassId ? sliceBandToWeek(bandPlacements, lessons, settings, bandWeekOffset)
      .filter(c => c.lesson.classIds.includes(currentClassId)) : [],
    [bandPlacements, lessons, settings, bandWeekOffset, currentClassId],
  );

  if (!settings.bandEnabled) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-xl">
        <p className="text-sm text-gray-600 mb-4">
          帯時間割（スライド時間割）は、1週間より長い基本枠を作成し、毎週スライドさせて運用する時間割です。
          中学校などで、授業時数の偏りを抑えたい場合に利用します。
        </p>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={!!settings.bandEnabled}
            onChange={e => setSettings(s => ({ ...s, bandEnabled: e.target.checked, bandTotalKoma: s.bandTotalKoma || weeklyKomaOf(s) }))}
            className="accent-indigo-600"
          />
          帯・スライド時間割を使用する
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
        帯時間割は「先生・クラス・教室・科目の重複」と「連続授業」のみをチェックして作成します。
        曜日ごとの個別条件（禁制）や1日あたりの上限は、帯全体に対しては適用されません。
        作成後に週へスライドした結果を見ながら、必要に応じて条件を調整してください。
      </div>

      <div className="flex items-center gap-4 flex-wrap bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.bandEnabled}
            onChange={e => setSettings(s => ({ ...s, bandEnabled: e.target.checked }))}
            className="accent-indigo-600"
          />
          使用する
        </label>
        <label className="flex items-center gap-2 text-sm">
          帯の総コマ数：
          <input
            type="number"
            min={weeklyKoma}
            value={bandTotalKoma}
            onChange={e => setSettings(s => ({ ...s, bandTotalKoma: Number(e.target.value) }))}
            className="w-20 px-2 py-1 rounded border border-gray-200"
          />
          <span className="text-xs text-gray-400">（週あたり{weeklyKoma}コマ以上を推奨）</span>
        </label>
        <button
          onClick={handleRunBand}
          disabled={isRunning}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md shadow-indigo-200"
        >
          {isRunning ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
          <span>{isRunning ? '駒入れ中...' : '帯の自動駒入れ'}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-auto">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">帯（{bandTotalKoma}コマ、1番から順に配置）</h4>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${positionsPerRow}, minmax(0, 1fr))` }}>
          {Array.from({ length: bandRows * positionsPerRow }, (_, i) => i + 1).map(pos => {
            if (pos > bandTotalKoma) return <div key={pos} />;
            const placement = bandPlacements.find(p => p.period === pos);
            const lesson = placement ? lessonById.get(placement.lessonId) : null;
            const subject = lesson ? subjects.find(s => s.id === lesson.subjectId) : null;
            return (
              <div
                key={pos}
                onContextMenu={e => { e.preventDefault(); if (placement) toggleConfirm(placement.id); }}
                title={placement ? '右クリックで確定/解除' : undefined}
                className={`h-12 rounded-md border text-[10px] flex flex-col items-center justify-center px-0.5 ${
                  lesson ? SUBJECT_COLOR_CLASSES[subject?.color ?? 'blue'] : 'bg-gray-50 border-dashed border-gray-200 text-gray-300'
                }`}
              >
                <div className="text-[9px] opacity-60">{pos}</div>
                {lesson ? (
                  <div className="font-semibold flex items-center gap-0.5 truncate w-full justify-center">
                    {placement?.confirmed && <Lock size={9} />}
                    {subject?.name ?? '?'}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-gray-500">週へスライドして確認</h4>
            <select
              value={currentClassId ?? ''}
              onChange={e => setViewClassId(e.target.value)}
              className="px-2 py-1 text-xs rounded-lg border border-gray-200 bg-white"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBandWeekOffset(o => Math.max(0, o - 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium">第{bandWeekOffset + 1}週</span>
            <button
              onClick={() => setBandWeekOffset(o => o + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-12"></th>
              {settings.days.map((d, i) => (
                <th key={i} className="px-2 py-1 text-xs font-medium text-gray-500 text-center">{d}</th>
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
                    const cell = slicedWeek.find(c => c.day === day && c.period === period);
                    const subject = cell ? subjects.find(s => s.id === cell.lesson.subjectId) : null;
                    return (
                      <td key={day} className="p-0.5">
                        <div className={`w-20 h-10 rounded-md border text-[10px] flex items-center justify-center text-center ${
                          cell ? SUBJECT_COLOR_CLASSES[subject?.color ?? 'blue'] : 'bg-gray-50 border-dashed border-gray-200 text-gray-300'
                        }`}>
                          {subject?.name ?? ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
