// A tiny push-based notifier so a routine change anywhere (edit, pause, delete,
// generate, mark-used) immediately refreshes every surface that shows routines —
// the dashboard "Up Next" and the Notes list — instead of relying only on screen
// focus. storageService emits on every routine mutation; screens subscribe.
import { useEffect, useRef } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();

// Called by storageService after any routine-mutating write.
export function emitRoutinesChanged(): void {
  listeners.forEach(l => {
    try {
      l();
    } catch (err) {
      console.error('routineEvents listener failed:', err);
    }
  });
}

export function subscribeRoutinesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Run `onChange` whenever routines change. Uses a ref so the latest callback is
// always invoked without re-subscribing on every render.
export function useRoutinesChanged(onChange: () => void): void {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => subscribeRoutinesChanged(() => ref.current()), []);
}
