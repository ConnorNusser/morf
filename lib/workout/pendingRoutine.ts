// Module-level hand-off for a routine started on another screen, picked up by the
// Workout tab on focus. Holds the STRUCTURED routine, not text — re-parsing text
// used to swap equipment variants (e.g. Overhead Press Machine → Barbell).
import type { CalculatedRoutine, GeneratedWorkout } from '@/types';

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
let pendingRepeatWorkout: GeneratedWorkout | null = null;

export function setPendingRepeatWorkout(workout: GeneratedWorkout) {
  pendingRepeatWorkout = workout;
}

export function getPendingRepeatWorkout(): GeneratedWorkout | null {
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
