import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Unlock, X, Wand2, RefreshCw, Undo2, Redo2, Lightbulb, ArrowRightLeft, MoveRight } from 'lucide-react';
import {
  Lesson, Placement, SchoolClass, Teacher, Room, Subject, TimetableSettings, SchedulerOptions, Meeting,
  SUBJECT_COLOR_CLASSES,
} from '../types';
import { generateId } from '../utils';
import { isValidPlacement, SchedulerContext } from '../services/scheduler';
import { suggestMovesForPlacement, suggestSlotsForLesson, slotLabel, Suggestion } from '../services/suggestionService';

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
  onChangeMaxAttempts: (maxAttempts: number) => void;
  meetings: Meeting[];
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  initialFocus?: { viewBy: ViewBy; entityId: string } | null;
  onFocusHandled?: () => void;
}

interface Menu {
  x: number;
  y: number;
  placementId: string;
}

interface SuggestPanel {
  x: number;
  y: number;
  source: { kind: 'placement'; placementId: string } | { kind: 'lesson'; lessonId: string };
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
  onChangeMaxAttempts, meetings,
  onUndo, onRedo, canUndo, canRedo, initialFocus, onFocusHandled,
}) => {
  const [viewBy, setViewBy] = useState<ViewBy>('class');
  const [entityId, setEntityId] = useState<string | null>(classes[0]?.id ?? null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [suggestPanel, setSuggestPanel] = useState<SuggestPanel | null>(null);
  const [dragPayload, setDragPayload] = useState<{ kind: 'placement' | 'new'; id: string } | null>(null);

  // タイル表示からのジャンプ: 指定されたクラス/先生/教室の詳細画面を直接開く
  useEffect(() => {
    if (!initialFocus) return;
    setViewBy(initialFocus.viewBy);
    setEntityId(initialFocus.entityId);
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocus]);

  // 一手戻し／一手戻しUndo: Ctrl/Cmd+Z を戻す、Ctrl/Cmd+Shift+Z または Ctrl/Cmd+Y をやり直しに割り当てる
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo(); else onUndo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onUndo, onRedo]);

  const entities = viewBy === 'class' ? classes : viewBy === 'teacher' ? teachers : rooms;
  const currentEntityId = entityId && entities.some(e => e.id === entityId) ? entityId : entities[0]?.id ?? null;

  const lessonById = useMemo(() => new Map(lessons.map(l => [l.id, l])), [lessons]);
  const ctx: SchedulerContext = { settings, classes, teachers, subjects, rooms, lessons, options: activeOption, meetings };

  const meetingAt = (day: number, period: number): Meeting | undefined => {
    if (!currentEntityId) return undefined;
    return meetings.find(m => {
      if (m.day !== day || m.period !== period) return false;
      if (viewBy === 'teacher') return m.teacherIds.includes(currentEntityId);
      if (viewBy === 'room') return m.roomId === currentEntityId;
      return false;
    });
  };

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

  // What would happen if the currently-dragged item were dropped on (day, period)?
  // Returns null when the drop would be invalid (conflict, confirmed lock, etc.) —
  // shared by both the live drag-over highlight and the actual drop handler so the
  // two never disagree about which cells are droppable.
  type DropPlan =
    | { kind: 'place'; lessonId: string; day: number; period: number }
    | { kind: 'move'; placementId: string; day: number; period: number }
    | { kind: 'swap'; aId: string; bId: string };

  const computeDropPlan = (day: number, period: number): DropPlan | null => {
    if (!dragPayload) return null;
    const targetOccupant = cellAt(day, period);

    if (dragPayload.kind === 'new') {
      const lesson = lessonById.get(dragPayload.id);
      if (!lesson) return null;
      if (targetOccupant) return null;
      if (!tryPlace(lesson, day, period, new Set())) return null;
      return { kind: 'place', lessonId: lesson.id, day, period };
    }

    const source = placements.find(p => p.id === dragPayload.id);
    if (!source || source.confirmed) return null;
    const sourceLesson = lessonById.get(source.lessonId);
    if (!sourceLesson) return null;

    if (!targetOccupant) {
      const exclude = new Set([source.id]);
      if (!tryPlace(sourceLesson, day, period, exclude)) return null;
      return { kind: 'move', placementId: source.id, day, period };
    }

    if (targetOccupant.id === source.id) return null;
    if (targetOccupant.confirmed) return null;
    const targetLesson = lessonById.get(targetOccupant.lessonId);
    if (!targetLesson) return null;
    const exclude = new Set([source.id, targetOccupant.id]);
    const sourceCanGoToTarget = tryPlace(sourceLesson, targetOccupant.day, targetOccupant.period, exclude);
    const targetCanGoToSource = tryPlace(targetLesson, source.day, source.period, exclude);
    if (!sourceCanGoToTarget || !targetCanGoToSource) return null;
    return { kind: 'swap', aId: source.id, bId: targetOccupant.id };
  };

  const labelForPlacement = (p: Placement): string => {
    const l = lessonById.get(p.lessonId);
    if (!l) return '?';
    const info = label(l);
    return `${info.subjectName}（${info.sub}）`;
  };

  const suggestions: Suggestion[] = useMemo(() => {
    if (!suggestPanel) return [];
    if (suggestPanel.source.kind === 'placement') {
      return suggestMovesForPlacement(ctx, placements, suggestPanel.source.placementId, labelForPlacement);
    }
    const lesson = lessonById.get(suggestPanel.source.lessonId);
    if (!lesson) return [];
    return suggestSlotsForLesson(ctx, placements, lesson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestPanel, placements, lessons]);

  const applySuggestion = (s: Suggestion) => {
    if (!suggestPanel) return;
    if (suggestPanel.source.kind === 'lesson') {
      const lesson = lessonById.get(suggestPanel.source.lessonId);
      if (!lesson) return;
      setPlacements(prev => [...prev, { id: generateId(), lessonId: lesson.id, day: s.day, period: s.period, confirmed: false }]);
    } else {
      const sourceId = suggestPanel.source.placementId;
      if (s.kind === 'move') {
        setPlacements(prev => prev.map(p => p.id === sourceId ? { ...p, day: s.day, period: s.period } : p));
      } else {
        const source = placements.find(p => p.id === sourceId);
        const target = placements.find(p => p.id === s.targetPlacementId);
        if (!source || !target) return;
        setPlacements(prev => prev.map(p => {
          if (p.id === source.id) return { ...p, day: target.day, period: target.period };
          if (p.id === target.id) return { ...p, day: source.day, period: source.period };
          return p;
        }));
      }
    }
    setSuggestPanel(null);
  };

  const handleDropOnCell = (day: number, period: number) => {
    const plan = computeDropPlan(day, period);
    setDragPayload(null);
    if (!plan) return;

    if (plan.kind === 'place') {
      setPlacements(prev => [...prev, { id: generateId(), lessonId: plan.lessonId, day: plan.day, period: plan.period, confirmed: false }]);
    } else if (plan.kind === 'move') {
      setPlacements(prev => prev.map(p => p.id === plan.placementId ? { ...p, day: plan.day, period: plan.period } : p));
    } else {
      const a = placements.find(p => p.id === plan.aId);
      const b = placements.find(p => p.id === plan.bId);
      if (!a || !b) return;
      setPlacements(prev => prev.map(p => {
        if (p.id === a.id) return { ...p, day: b.day, period: b.period };
        if (p.id === b.id) return { ...p, day: a.day, period: a.period };
        return p;
      }));
    }
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
    <div className="flex flex-col h-full gap-3" onClick={() => { setMenu(null); setSuggestPanel(null); }}>
      <p className="text-xs text-gray-500 no-print">
        駒をドラッグすると、移動しても競合しないマス（配置・入れ替え先）が緑色でハイライトされます。
      </p>
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
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="一手戻し (Ctrl+Z)"
              className="p-1.5 rounded-md text-gray-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-500"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="一手戻しUndo・やり直し (Ctrl+Shift+Z)"
              className="p-1.5 rounded-md text-gray-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-500"
            >
              <Redo2 size={16} />
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-500" title="残り駒が0になるまで試行を重ねる際の最低保証回数（それでも0にならない場合は安全上限まで追加で試行します）">
            <span>試行回数</span>
            <input
              type="number"
              min={1}
              max={200}
              value={activeOption.maxAttempts}
              onChange={e => onChangeMaxAttempts(Math.max(1, Number(e.target.value) || 1))}
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
                        const meeting = !placement ? meetingAt(day, period) : undefined;
                        const canDrop = dragPayload ? !!computeDropPlan(day, period) : false;
                        return (
                          <td key={day} className="p-0.5 align-top" rowSpan={placement ? span : 1}>
                            <div
                              onDragOver={e => { if (!meeting) e.preventDefault(); }}
                              onDrop={e => { e.stopPropagation(); if (!meeting) handleDropOnCell(day, period); }}
                              onClick={e => e.stopPropagation()}
                              onContextMenu={e => {
                                if (!placement) return;
                                e.preventDefault();
                                setMenu({ x: e.clientX, y: e.clientY, placementId: placement.id });
                              }}
                              draggable={!!placement && !placement.confirmed}
                              onDragStart={() => placement && setDragPayload({ kind: 'placement', id: placement.id })}
                              onDragEnd={() => setDragPayload(null)}
                              title={meeting ? `会議: ${meeting.name}` : canDrop ? 'ここに移動できます' : undefined}
                              className={`w-24 rounded-md border text-[11px] leading-tight flex flex-col items-center justify-center text-center px-1 select-none transition-colors ${
                                span === 2 ? 'h-[4.75rem]' : 'h-11'
                              } ${
                                lesson
                                  ? `${SUBJECT_COLOR_CLASSES[label(lesson).color]} ${placement?.confirmed ? 'ring-2 ring-offset-1 ring-gray-500' : 'cursor-move'} ${canDrop ? 'ring-2 ring-offset-1 ring-green-500' : ''}`
                                  : meeting
                                  ? 'bg-slate-200 border-slate-300 text-slate-500'
                                  : canDrop
                                  ? 'bg-green-100 border-green-400 border-solid text-green-600'
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
                              ) : meeting ? (
                                <>
                                  <Lock size={10} />
                                  <div className="font-semibold truncate w-full">{meeting.name}</div>
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
                  onDragEnd={() => setDragPayload(null)}
                  className={`relative px-2 py-1.5 rounded-md border text-xs cursor-move ${SUBJECT_COLOR_CLASSES[info.color]}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="font-semibold">{info.subjectName}</div>
                      <div className="opacity-80 text-[11px]">
                        {lesson.classIds.map(id => classes.find(c => c.id === id)?.name).join('・')} / {lesson.teacherIds.map(id => teachers.find(t => t.id === id)?.name).join('・')}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setSuggestPanel({ x: e.clientX, y: e.clientY, source: { kind: 'lesson', lessonId: lesson.id } }); }}
                      title="AI提案（置ける空きコマを探す）"
                      className="flex-shrink-0 p-1 rounded hover:bg-white/60 text-current"
                    >
                      <Lightbulb size={13} />
                    </button>
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
          {!placements.find(p => p.id === menu.placementId)?.confirmed && (
            <button
              onClick={() => { setSuggestPanel({ x: menu.x, y: menu.y, source: { kind: 'placement', placementId: menu.placementId } }); setMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left text-indigo-600"
            >
              <Lightbulb size={14} />
              <span>AI提案を見る（振替・移動）</span>
            </button>
          )}
          <button onClick={() => removePlacement(menu.placementId)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left text-red-600">
            <X size={14} />
            <span>駒をはずす</span>
          </button>
        </div>
      )}

      {suggestPanel && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm w-64 max-h-80 overflow-auto"
          style={{ top: suggestPanel.y, left: Math.min(suggestPanel.x, window.innerWidth - 270) }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100 flex items-center gap-1.5">
            <Lightbulb size={13} className="text-amber-500" />
            <span>AI提案</span>
          </div>
          {suggestions.length === 0 && (
            <div className="px-3 py-3 text-xs text-gray-400">提案できる空きコマが見つかりませんでした。</div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => applySuggestion(s)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-50 text-left text-xs"
            >
              {s.kind === 'move' ? <MoveRight size={13} className="text-gray-400 flex-shrink-0" /> : <ArrowRightLeft size={13} className="text-gray-400 flex-shrink-0" />}
              {s.kind === 'move' ? (
                <span>{slotLabel(settings.days, s.day, s.period)} へ移動</span>
              ) : (
                <span>{slotLabel(settings.days, s.day, s.period)} の「{s.label}」と入れ替え</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
