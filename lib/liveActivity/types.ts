// Shared shape of the Live Activity content, mirrored 1:1 by the Swift
// `MorfLiveActivityAttributes.ContentState`. Keep these in sync — the native
// widget decodes exactly these fields.

export type WeightUnit = 'lbs' | 'kg';

// The activity is one of two modes at a time:
//  - 'rest'  : a self-ticking countdown (the rest timer)
//  - 'set'   : the current working set, editable from the Lock Screen
export type LiveActivityMode = 'rest' | 'set';

export interface RestContent {
  /** Epoch ms when the rest countdown ends — the widget self-ticks to this. */
  endTime: number;
  /** What they just finished (e.g. "Bench Press"). */
  exerciseName: string;
  /** Optional hint for what's next (e.g. "Next: Squat · Set 1"). */
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

// The ordered working sets handed to the native side so a "complete set" tap on
// the Lock Screen can advance to the next not-done set without the app running.
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

// One action the user took on the Lock Screen (via an App Intent), pulled back
// into JS on resume so we can reconcile the workout draft.
export type PendingAction =
  | { type: 'completeSet'; exerciseKey: string; setIndex: number; reps: number; weight: number }
  | { type: 'adjustReps'; exerciseKey: string; setIndex: number; reps: number }
  | { type: 'adjustWeight'; exerciseKey: string; setIndex: number; weight: number }
  | { type: 'addRest'; seconds: number }
  | { type: 'skipRest' };
