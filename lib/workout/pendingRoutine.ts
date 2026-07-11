// Module-level hand-off for a routine started on another screen, picked up by the
// Workout tab on focus. Holds the STRUCTURED routine, not text — re-parsing text
// used to swap equipment variants (e.g. Overhead Press Machine → Barbell).
import type { CalculatedRoutine, LoggedWorkout } from '@/types';

let pendingRoutine: CalculatedRoutine | null = null;

export function setPendingRoutine(routine: CalculatedRoutine) {
  pendingRoutine = routine;
}

export function getPendingRoutine(): CalculatedRoutine | null {
  const routine = pendingRoutine;
  pendingRoutine = null;
  return routine;
}

// Same hand-off for repeating a past workout: the Workout tab prefills its draft.
let pendingRepeatWorkout: LoggedWorkout | null = null;

export function setPendingRepeatWorkout(workout: LoggedWorkout) {
  pendingRepeatWorkout = workout;
}

export function getPendingRepeatWorkout(): LoggedWorkout | null {
  const workout = pendingRepeatWorkout;
  pendingRepeatWorkout = null;
  return workout;
}

// Quick-start intent: the Workout tab starts an empty session and opens the composer.
let pendingQuickStart = false;

export function setPendingQuickStart() {
  pendingQuickStart = true;
}

export function getPendingQuickStart(): boolean {
  const v = pendingQuickStart;
  pendingQuickStart = false;
  return v;
}
