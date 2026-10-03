import type {
  LiveActivityContent,
  SnapshotSet,
} from "@/lib/liveActivity/types";
import type { WorkoutDraft } from "@/lib/workout/workoutDraft";

// Flat, ordered list of every working set — drives the "current set" shown and
// the native "complete → next not-done set" advance (mirrored to the App Group
// so the Lock Screen can jump exercises with the app suspended).
export function buildSetSnapshot(draft: WorkoutDraft): SnapshotSet[] {
  return draft.flatMap((ex) =>
    ex.sets.map((s, i) => ({
      exerciseKey: ex.key,
      exerciseName: ex.name || "Exercise",
      setNumber: i + 1,
      totalSets: ex.sets.length,
      reps: s.reps,
      weight: s.weight,
      unit: s.unit,
      done: !!s.done,
    })),
  );
}

// The first not-done set, or null when everything is checked off.
export function currentSnapshotSet(snapshot: SnapshotSet[]): SnapshotSet | null {
  return snapshot.find((s) => !s.done) ?? null;
}

// SET-mode Live Activity payload for the current set. Field order is stable: the
// caller dedupes updates on the JSON-stringified content.
export function setActivityContent(currentSet: SnapshotSet): LiveActivityContent {
  return {
    mode: "set",
    workoutTitle: "Workout",
    set: {
      exerciseKey: currentSet.exerciseKey,
      exerciseName: currentSet.exerciseName,
      setNumber: currentSet.setNumber,
      totalSets: currentSet.totalSets,
      reps: currentSet.reps,
      weight: currentSet.weight,
      unit: currentSet.unit,
    },
  };
}
