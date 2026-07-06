// Module-level hand-off for a routine the user just started on another screen
// (Home / Routines) so the Workout tab can pick it up on focus. Holds the
// STRUCTURED routine — not serialized text — so the resolved exerciseIds survive
// the hop (re-parsing text used to swap equipment variants, e.g. Overhead Press
// Machine → Barbell).
import type { CalculatedRoutine, GeneratedWorkout } from '@/types';

let pendingRoutine: CalculatedRoutine | null = null;

export function setPendingRoutine(routine: CalculatedRoutine) {
  pendingRoutine = routine;
}

export function getPendingRoutine(): CalculatedRoutine | null {
  const routine = pendingRoutine;
  pendingRoutine = null; // Clear after reading
  return routine;
}

// Same hand-off for repeating a PAST workout from another screen (Home's
// recent list): the Workout tab prefills its draft from it on focus.
let pendingRepeatWorkout: GeneratedWorkout | null = null;

export function setPendingRepeatWorkout(workout: GeneratedWorkout) {
  pendingRepeatWorkout = workout;
}

export function getPendingRepeatWorkout(): GeneratedWorkout | null {
  const workout = pendingRepeatWorkout;
  pendingRepeatWorkout = null; // Clear after reading
  return workout;
}
