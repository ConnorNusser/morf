import type { DraftSet } from "@/lib/workout/workoutDraft";
import type { WeightUnit } from "@/types";

export type NumberPadField = "weight" | "reps" | "duration";

// Hevy-style rep mirroring: when a set's weight settles, tie its reps to the set
// directly above IFF the weights match (same working load) or the weight is 0
// (bodyweight / not-yet-entered). Matching → mirror the row above's reps; diverging
// → clear the reps that were merely auto-copied from that row. Returns the reps to
// apply, or null when the row should be left alone.
export function mirroredReps(
  above: Pick<DraftSet, "weight" | "reps">,
  weight: number,
  reps: number,
): number | null {
  let nextReps: number | null = null;
  if (weight === above.weight || weight === 0) {
    if (reps !== above.reps) nextReps = above.reps;
  } else if (reps === above.reps) {
    nextReps = 0; // stale copy of the row above, not typed — clear it
  }
  return nextReps;
}

// What the custom number pad shows for the set field being edited.
export function numberPadConfig(
  field: NumberPadField,
  set: Pick<DraftSet, "weight" | "reps" | "duration">,
  weightUnit: WeightUnit,
): {
  label: string;
  unit: string | undefined;
  value: number;
  allowDecimal: boolean;
  increments: number[];
  hasNext: boolean;
} {
  const isWeight = field === "weight";
  const isDuration = field === "duration";
  return {
    label: isDuration ? "Seconds" : isWeight ? "Weight" : "Reps",
    unit: isDuration ? "sec" : isWeight ? weightUnit : undefined,
    value: isDuration ? (set.duration ?? 0) : isWeight ? set.weight : set.reps,
    allowDecimal: isWeight,
    increments: isDuration
      ? [-15, -5, 5, 15]
      : isWeight
        ? weightUnit === "kg"
          ? [-5, -2.5, 2.5, 5]
          : [-10, -5, 5, 10]
        : [-1, 1, 2, 5],
    hasNext: isWeight,
  };
}
