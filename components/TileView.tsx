import React, { useEffect, useState } from 'react';
import { Users, GraduationCap, DoorOpen, BookOpen, Table2, TableProperties, Wand2, RefreshCw } from 'lucide-react';
import {
  SchoolClass, Teacher, Room, Subject, Lesson, Placement, TimetableSettings, SchedulerOptions, SUBJECT_COLOR_CLASSES,
} from '../types';
import { AllClassesOverview } from './AllClassesOverview';
import { AllClassesMatrix } from './AllClassesMatrix';

export type TileTab = 'overview' | 'matrix' | 'teachers' | 'classes' | 'rooms' | 'subjects';

interface Props {
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  rooms: Room[];
  subjects: Subject[];
  lessons: Lesson[];
  placements: Placement[];
  onOpenEntity: (viewBy: 'class' | 'teacher' | 'room', entityId: string) => void;
  onRunScheduler: () => void;
  isRunning: boolean;
  activeOption: SchedulerOptions;
  onChangeMaxAttempts: (maxAttempts: number) => void;
  focusTab?: TileTab | null;
  onFocusTabHandled?: () => void;
}

const TABS: { key: TileTab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: '全クラス一覧', icon: <Table2 size={16} /> },
  { key: 'matrix', label: '一括表', icon: <TableProperties size={16} /> },
  { key: 'teachers', label: '先生', icon: <Users size={16} /> },
  { key: 'classes', label: 'クラス', icon: <GraduationCap size={16} /> },
  { key: 'rooms', label: '教室', icon: <DoorOpen size={16} /> },
  { key: 'subjects', label: '科目', icon: <BookOpen size={16} /> },
];

export const TileView: React.FC<Props> = ({
  settings, classes, teachers, rooms, subjects, lessons, placements, onOpenEntity,
  onRunScheduler, isRunning, activeOption, onChangeMaxAttempts, focusTab, onFocusTabHandled,
}) => {
  const [tab, setTab] = useState<TileTab>('overview');
  const lessonById = new Map(lessons.map(l => [l.id, l]));
  const totalSlots = settings.days.length * settings.periodsPerDay;

  // 自動駒入れ完了後などに、外部から特定のタブ（一括表など）へジャンプさせる
  useEffect(() => {
    if (!focusTab) return;
    setTab(focusTab);
    onFocusTabHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTab]);

  const occupancyGrid = (matches: (lesson: Lesson) => boolean) => {
    const grid = Array.from({ length: settings.days.length }, () => Array<string | null>(settings.periodsPerDay).fill(null));
    let filled = 0;
    for (const p of placements) {
      const lesson = lessonById.get(p.lessonId);
      if (!lesson || !matches(lesson)) continue;
      const subject = subjects.find(s => s.id === lesson.subjectId);
      for (let i = 0; i < lesson.consecutive; i++) {
        const period = p.period + i - 1;
        if (period < settings.periodsPerDay && grid[p.day]) {
          if (!grid[p.day][period]) filled++;
          grid[p.day][period] = subject?.color ?? 'blue';
        }
      }
    }
    return { grid, filled };
  };

  const renderMiniGrid = (grid: (string | null)[][]) => (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${settings.periodsPerDay}, minmax(0, 1fr))` }}>
      {grid.flatMap((day, dayIdx) =>
        day.map((color, periodIdx) => (
          <div
            key={`${dayIdx}-${periodIdx}`}
            className={`w-3 h-3 rounded-sm ${color ? SUBJECT_COLOR_CLASSES[color].split(' ')[0] : 'bg-gray-100'}`}
          />
        )),
      )}
    </div>
  );

  const renderEntityTiles = (
    items: { id: string; name: string }[],
    matches: (id: string, lesson: Lesson) => boolean,
    viewBy: 'class' | 'teacher' | 'room',
  ) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map(item => {
        const { grid, filled } = occupancyGrid(l => matches(item.id, l));
        return (
          <button
            key={item.id}
            onClick={() => onOpenEntity(viewBy, item.id)}
            className="text-left bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:border-indigo-300 hover:shadow-md transition"
          >
            <div className="font-semibold text-sm text-gray-800 mb-2 truncate">{item.name}</div>
            {renderMiniGrid(grid)}
            <div className="mt-2 text-[11px] text-gray-400">{filled} / {totalSlots} コマ配置済み</div>
          </button>
        );
      })}
      {items.length === 0 && <div className="col-span-full text-center text-gray-400 text-sm py-8">データがありません</div>}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs text-gray-500 mb-3">
        「全クラス一覧」ではすべてのクラス・学年の時間割を並べて確認できます。「一括表」では縦に学年・クラス、
        横に曜日・時限を並べた一つの表ですべてのコマを確認でき、空きコマがあればエラーとして一覧表示されます。
        この画面を見ながら「AIで自動駒入れ」を実行すると、コマが埋まっていく様子をそのまま確認できます。
        先生・クラス・教室・科目タブでは、配置済みコマ数と週の埋まり具合を一覧できます。
        タイルをクリックすると詳細な時間割作成画面を開きます。
      </p>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
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
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500" title="AIで自動駒入れを行う際の試行回数（多いほど残り駒0に近づきやすいが時間がかかる）">
            <span>試行回数</span>
            <input
              type="number"
              min={1}
              max={200}
              value={activeOption.maxAttempts}
              onChange={e => onChangeMaxAttempts(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
              disabled={isRunning}
              className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-50"
            />
          </label>
          <button
            onClick={onRunScheduler}
            disabled={isRunning}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md shadow-indigo-200"
          >
            {isRunning ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
            <span>{isRunning ? '駒入れ中...' : 'AIで自動駒入れ'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'overview' && (
          <AllClassesOverview
            settings={settings} classes={classes} teachers={teachers} subjects={subjects}
            lessons={lessons} placements={placements}
            onOpenClass={classId => onOpenEntity('class', classId)}
          />
        )}
        {tab === 'matrix' && (
          <AllClassesMatrix
            settings={settings} classes={classes} teachers={teachers} subjects={subjects}
            lessons={lessons} placements={placements}
            onOpenClass={classId => onOpenEntity('class', classId)}
          />
        )}
        {tab === 'teachers' && renderEntityTiles(teachers, (id, l) => l.teacherIds.includes(id), 'teacher')}
        {tab === 'classes' && renderEntityTiles(classes, (id, l) => l.classIds.includes(id), 'class')}
        {tab === 'rooms' && renderEntityTiles(rooms, (id, l) => l.roomIds.includes(id), 'room')}
        {tab === 'subjects' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {subjects.map(s => {
              const { grid, filled } = occupancyGrid(l => l.subjectId === s.id);
              return (
                <div key={s.id} className={`text-left bg-white rounded-xl border shadow-sm p-3 ${SUBJECT_COLOR_CLASSES[s.color]}`}>
                  <div className="font-semibold text-sm mb-2 truncate">{s.name}</div>
                  {renderMiniGrid(grid)}
                  <div className="mt-2 text-[11px] opacity-70">{filled} コマ配置済み（全体）</div>
                </div>
              );
            })}
            {subjects.length === 0 && <div className="col-span-full text-center text-gray-400 text-sm py-8">データがありません</div>}
          </div>
        )}
      </div>
    </div>
  );
};
