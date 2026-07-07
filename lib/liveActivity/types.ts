// Mirrored 1:1 by the Swift `MorfLiveActivityAttributes.ContentState` — keep in
// sync; the native widget decodes exactly these fields.

export type WeightUnit = 'lbs' | 'kg';

export type LiveActivityMode = 'rest' | 'set';

export interface RestContent {
  /** Epoch ms when the rest countdown ends — the widget self-ticks to this. */
  endTime: number;
  exerciseName: string;
  nextLabel?: string;
}

export interface SetContent {
  /** Draft row key — lets a Lock-Screen tap reconcile back to the right set. */
  exerciseKey: string;
  exerciseName: string;
  /** 1-based index of this set within the exercise. */
  setNumber: number;
  totalSets: number;
  reps: number;
  weight: number;
  unit: WeightUnit;
}

export interface LiveActivityContent {
  mode: LiveActivityMode;
  workoutTitle: string;
  rest?: RestContent;
  set?: SetContent;
}

// Ordered working sets handed to native so a Lock-Screen "complete set" tap can
// advance to the next not-done set without the app running.
export interface SnapshotSet {
  exerciseKey: string;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  reps: number;
  weight: number;
  unit: WeightUnit;
  done: boolean;
}

// A Lock-Screen action (via an App Intent), pulled back into JS on resume to
// reconcile the workout draft.
export type PendingAction =
  | { type: 'completeSet'; exerciseKey: string; setIndex: number; reps: number; weight: number }
  | { type: 'adjustReps'; exerciseKey: string; setIndex: number; reps: number }
  | { type: 'adjustWeight'; exerciseKey: string; setIndex: number; weight: number }
  | { type: 'addRest'; seconds: number }
  | { type: 'startRest'; endTime: number }
  | { type: 'skipRest' }
  // Final-set completion spawned a bonus set; mirror it by copying the last set.
  | { type: 'addBonusSet'; exerciseKey: string };
