import React, { useMemo, useState } from 'react';
import { Lock, Unlock, X, Wand2, RefreshCw } from 'lucide-react';
import {
  Lesson, Placement, SchoolClass, Teacher, Room, Subject, TimetableSettings, SchedulerOptions, SUBJECT_COLOR_CLASSES,
} from '../types';
import { generateId } from '../utils';
import { isValidPlacement, SchedulerContext } from '../services/scheduler';

type ViewBy = 'class' | 'teacher' | 'room';

interface Props {
  settings: TimetableSettings;
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  lessons: Lesson[];
  placements: Placement[];
  setPlacements: React.Dispatch<React.SetStateAction<Placement[]>>;
  onRunScheduler: () => void;
  isRunning: boolean;
  activeOption: SchedulerOptions;
}

interface Menu {
  x: number;
  y: number;
  placementId: string;
}

export const computeUnplaced = (lessons: Lesson[], placements: Placement[]) => {
  return lessons
    .map(l => {
      const placedCount = placements.filter(p => p.lessonId === l.id).length;
      return { lesson: l, remaining: l.weeklyCount - placedCount };
    })
    .filter(x => x.remaining > 0);
};

export const TimetableGrid: React.FC<Props> = ({
  settings, classes, teachers, subjects, rooms, lessons, placements, setPlacements, onRunScheduler, isRunning, activeOption,
}) => {
  const [viewBy, setViewBy] = useState<ViewBy>('class');
  const [entityId, setEntityId] = useState<string | null>(classes[0]?.id ?? null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [dragPayload, setDragPayload] = useState<{ kind: 'placement' | 'new'; id: string } | null>(null);

  const entities = viewBy === 'class' ? classes : viewBy === 'teacher' ? teachers : rooms;
  const currentEntityId = entityId && entities.some(e => e.id === entityId) ? entityId : entities[0]?.id ?? null;

  const lessonById = useMemo(() => new Map(lessons.map(l => [l.id, l])), [lessons]);
  const ctx: SchedulerContext = { settings, classes, teachers, subjects, rooms, lessons, options: activeOption };

  const relevantPlacements = useMemo(() => {
    if (!currentEntityId) return [];
    return placements.filter(p => {
      const l = lessonById.get(p.lessonId);
      if (!l) return false;
      if (viewBy === 'class') return l.classIds.includes(currentEntityId);
      if (viewBy === 'teacher') return l.teacherIds.includes(currentEntityId);
      return l.roomIds.includes(currentEntityId);
    });
  }, [placements, lessonById, viewBy, currentEntityId]);

  const unplaced = useMemo(() => {
    const all = computeUnplaced(lessons, placements);
    if (!currentEntityId) return all;
    return all.filter(({ lesson }) => {
      if (viewBy === 'class') return lesson.classIds.includes(currentEntityId);
      if (viewBy === 'teacher') return lesson.teacherIds.includes(currentEntityId);
      return lesson.roomIds.includes(currentEntityId);
    });
  }, [lessons, placements, viewBy, currentEntityId]);

  // cell occupied if any placement covers (day, period)
  const cellAt = (day: number, period: number) => {
    return relevantPlacements.find(p => {
      const l = lessonById.get(p.lessonId);
      const span = l?.consecutive ?? 1;
      return p.day === day && period >= p.period && period < p.period + span;
    });
  };

  const label = (lesson: Lesson) => {
    const subject = subjects.find(s => s.id === lesson.subjectId);
    const teacherNames = lesson.teacherIds.map(id => teachers.find(t => t.id === id)?.short || teachers.find(t => t.id === id)?.name).filter(Boolean);
    const classNames = lesson.classIds.map(id => classes.find(c => c.id === id)?.name).filter(Boolean);
    return {
      subjectName: subject?.name ?? '?',
      color: subject?.color ?? 'blue',
      sub: viewBy === 'class' ? teacherNames.join('・') : classNames.join('・'),
    };
  };

  const tryPlace = (lesson: Lesson, day: number, period: number, excludeIds: Set<string>) => {
    return isValidPlacement(ctx, placements, lesson, day, period, excludeIds);
  };

  const handleDropOnCell = (day: number, period: number) => {
    if (!dragPayload) return;
    const targetOccupant = cellAt(day, period);

    if (dragPayload.kind === 'new') {
      const lesson = lessonById.get(dragPayload.id);
      if (!lesson) return;
      if (targetOccupant) return; // don't drop new lesson onto occupied cell
      if (!tryPlace(lesson, day, period, new Set())) return;
      setPlacements(prev => [...prev, { id: generateId(), lessonId: lesson.id, day, period, confirmed: false }]);
      setDragPayload(null);
      return;
    }

    // dragging an existing placement
    const source = placements.find(p => p.id === dragPayload.id);
    if (!source || source.confirmed) { setDragPayload(null); return; }
    const sourceLesson = lessonById.get(source.lessonId);
    if (!sourceLesson) { setDragPayload(null); return; }

    if (!targetOccupant) {
      const exclude = new Set([source.id]);
      if (!tryPlace(sourceLesson, day, period, exclude)) { setDragPayload(null); return; }
      setPlacements(prev => prev.map(p => p.id === source.id ? { ...p, day, period } : p));
    } else {
      if (targetOccupant.id === source.id) { setDragPayload(null); return; }
      if (targetOccupant.confirmed) { setDragPayload(null); return; }
      const targetLesson = lessonById.get(targetOccupant.lessonId);
      if (!targetLesson) { setDragPayload(null); return; }
      const exclude = new Set([source.id, targetOccupant.id]);
      const sourceCanGoToTarget = tryPlace(sourceLesson, targetOccupant.day, targetOccupant.period, exclude);
      const targetCanGoToSource = tryPlace(targetLesson, source.day, source.period, exclude);
      if (!sourceCanGoToTarget || !targetCanGoToSource) { setDragPayload(null); return; }
      setPlacements(prev => prev.map(p => {
        if (p.id === source.id) return { ...p, day: targetOccupant.day, period: targetOccupant.period };
        if (p.id === targetOccupant.id) return { ...p, day: source.day, period: source.period };
        return p;
      }));
    }
    setDragPayload(null);
  };

  const toggleConfirm = (placementId: string) => {
    setPlacements(prev => prev.map(p => p.id === placementId ? { ...p, confirmed: !p.confirmed } : p));
    setMenu(null);
  };

  const removePlacement = (placementId: string) => {
    setPlacements(prev => prev.filter(p => p.id !== placementId));
    setMenu(null);
  };

  return (
    <div className="flex flex-col h-full gap-3" onClick={() => setMenu(null)}>
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['class', 'teacher', 'room'] as ViewBy[]).map(v => (
              <button
                key={v}
                onClick={() => { setViewBy(v); setEntityId(null); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewBy === v ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
              >
                {v === 'class' ? 'クラス別' : v === 'teacher' ? '先生別' : '教室別'}
              </button>
            ))}
          </div>
          <select
            value={currentEntityId ?? ''}
            onChange={e => setEntityId(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white"
          >
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <button
          onClick={onRunScheduler}
          disabled={isRunning}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md shadow-indigo-200"
        >
          {isRunning ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
          <span>{isRunning ? '駒入れ中...' : 'AIで自動駒入れ'}</span>
        </button>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          {!currentEntityId ? (
            <div className="text-gray-400 text-sm">表示する対象がありません。マスターデータを登録してください。</div>
          ) : (
            <table className="border-collapse w-full">
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
                    <tr key={period} className={settings.lunchAfterPeriod === period ? 'border-b-4 border-amber-100' : ''}>
                      <td className="text-xs text-gray-400 text-right pr-2 align-middle">{period}限</td>
                      {settings.days.map((_, day) => {
                        const placement = cellAt(day, period);
                        const isStart = placement && placement.period === period;
                        if (placement && !isStart) return null; // covered by rowSpan above
                        const lesson = placement ? lessonById.get(placement.lessonId) : null;
                        const span = lesson?.consecutive ?? 1;
                        return (
                          <td key={day} className="p-0.5 align-top" rowSpan={placement ? span : 1}>
                            <div
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => { e.stopPropagation(); handleDropOnCell(day, period); }}
                              onClick={e => e.stopPropagation()}
                              onContextMenu={e => {
                                if (!placement) return;
                                e.preventDefault();
                                setMenu({ x: e.clientX, y: e.clientY, placementId: placement.id });
                              }}
                              draggable={!!placement && !placement.confirmed}
                              onDragStart={() => placement && setDragPayload({ kind: 'placement', id: placement.id })}
                              className={`w-24 rounded-md border text-[11px] leading-tight flex flex-col items-center justify-center text-center px-1 select-none ${
                                span === 2 ? 'h-[4.75rem]' : 'h-11'
                              } ${
                                lesson
                                  ? `${SUBJECT_COLOR_CLASSES[label(lesson).color]} ${placement?.confirmed ? 'ring-2 ring-offset-1 ring-gray-500' : 'cursor-move'}`
                                  : 'bg-gray-50 border-dashed border-gray-200 text-gray-300'
                              }`}
                            >
                              {lesson ? (
                                <>
                                  <div className="font-semibold flex items-center gap-1">
                                    {placement?.confirmed && <Lock size={10} />}
                                    {label(lesson).subjectName}
                                  </div>
                                  <div className="opacity-80">{label(lesson).sub}</div>
                                </>
                              ) : (
                                <span>&nbsp;</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm p-3 overflow-auto no-print">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">残り駒（未配置） {unplaced.reduce((s, u) => s + u.remaining, 0)}</h4>
          <div className="space-y-1.5">
            {unplaced.map(({ lesson, remaining }) => {
              const info = label(lesson);
              return Array.from({ length: remaining }, (_, i) => (
                <div
                  key={`${lesson.id}-${i}`}
                  draggable
                  onDragStart={() => setDragPayload({ kind: 'new', id: lesson.id })}
                  className={`px-2 py-1.5 rounded-md border text-xs cursor-move ${SUBJECT_COLOR_CLASSES[info.color]}`}
                >
                  <div className="font-semibold">{info.subjectName}</div>
                  <div className="opacity-80 text-[11px]">
                    {lesson.classIds.map(id => classes.find(c => c.id === id)?.name).join('・')} / {lesson.teacherIds.map(id => teachers.find(t => t.id === id)?.name).join('・')}
                  </div>
                </div>
              ));
            })}
            {unplaced.length === 0 && <div className="text-xs text-gray-400">すべて配置済みです。</div>}
          </div>
        </div>
      </div>

      {menu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm"
          style={{ top: menu.y, left: menu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => toggleConfirm(menu.placementId)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left">
            {placements.find(p => p.id === menu.placementId)?.confirmed ? <Unlock size={14} /> : <Lock size={14} />}
            <span>{placements.find(p => p.id === menu.placementId)?.confirmed ? '確定を解除' : '確定授業にする'}</span>
          </button>
          <button onClick={() => removePlacement(menu.placementId)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left text-red-600">
            <X size={14} />
            <span>駒をはずす</span>
          </button>
        </div>
      )}
    </div>
  );
};
