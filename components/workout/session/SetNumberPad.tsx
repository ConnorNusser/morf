import NumberPad from "@/components/workout/NumberPad";
import type { NumberPadTarget } from "@/hooks/useSetNumberPad";
import {
  numberPadConfig,
  type NumberPadField,
} from "@/lib/workout/numberPadEdit";
import type { DraftSet, WorkoutDraft } from "@/lib/workout/workoutDraft";
import type { WeightUnit } from "@/types";
import React from "react";

interface SetNumberPadProps {
  editing: NumberPadTarget | null;
  draft: WorkoutDraft;
  weightUnit: WeightUnit;
  editSet: (key: string, index: number, patch: Partial<DraftSet>) => void;
  onLiveChange: (
    key: string,
    index: number,
    field: NumberPadField,
    n: number,
  ) => void;
  onNext: () => void;
  onDone: () => void;
  onClose: () => void;
}

// Custom number pad for editing a set's weight / reps
export default function SetNumberPad({
  editing,
  draft,
  weightUnit,
  editSet,
  onLiveChange,
  onNext,
  onDone,
  onClose,
}: SetNumberPadProps) {
  if (!editing) return null;
  const set = draft.find((e) => e.key === editing.key)?.sets[editing.index];
  if (!set) return null;
  const config = numberPadConfig(editing.field, set, weightUnit);
  return (
    <NumberPad
      visible
      seedKey={`${editing.key}-${editing.index}-${editing.field}`}
      label={config.label}
      unit={config.unit}
      value={config.value}
      allowDecimal={config.allowDecimal}
      increments={config.increments}
      hasNext={config.hasNext}
      onChange={(n) =>
        editSet(
          editing.key,
          editing.index,
          editing.field === "duration"
            ? { duration: Math.max(0, Math.round(n)) }
            : { [editing.field]: n },
        )
      }
      onLiveChange={(n) =>
        onLiveChange(editing.key, editing.index, editing.field, n)
      }
      onNext={onNext}
      onDone={onDone}
      onClose={onClose}
    />
  );
}
