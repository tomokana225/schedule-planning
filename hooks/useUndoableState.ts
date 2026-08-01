import { useState } from 'react';

// 一手戻し／一手戻しUndo(アンドゥ): wraps a piece of state with an undo/redo
// history. Each call to `set` pushes the previous value onto the undo stack
// and clears the redo stack, matching the "one step at a time" granularity
// used for 駒の移動・確定・自動駒入れ operations.
export function useUndoableState<T>(initial: T) {
  const [present, setPresent] = useState(initial);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const set: React.Dispatch<React.SetStateAction<T>> = (updater) => {
    setPresent(prev => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      setPast(p => [...p, prev]);
      setFuture([]);
      return next;
    });
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([present, ...future]);
    setPresent(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past, present]);
    setPresent(next);
  };

  const reset = (value: T) => {
    setPresent(value);
    setPast([]);
    setFuture([]);
  };

  return {
    value: present,
    setValue: set,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
