// Custom number pad editing for the workout tab: which set field is open, the
// open-time snapshot the live target cascade recomputes from, and Next/Done/Close.
import { DEFAULT_REST_SECONDS, useRestTimer } from "@/hooks/useRestTimer";
import playHapticFeedback from "@/lib/utils/haptic";
import {
  mirroredReps,
  type NumberPadField,
} from "@/lib/workout/numberPadEdit";
import type { DraftSet, WorkoutDraft } from "@/lib/workout/workoutDraft";
import { useCallback, useRef, useState } from "react";
import { Keyboard } from "react-native";

export interface NumberPadTarget {
  key: string;
  index: number;
  field: NumberPadField;
}

interface UseSetNumberPadParams {
  draft: WorkoutDraft;
  editSet: (key: string, index: number, patch: Partial<DraftSet>) => void;
  applyLiveSet: (
    key: string,
    index: number,
    originalSets: DraftSet[],
    weight: number,
    reps: number,
  ) => void;
  startRestTimer: ReturnType<typeof useRestTimer>["startTimer"];
}

export function useSetNumberPad({
  draft,
  editSet,
  applyLiveSet,
  startRestTimer,
}: UseSetNumberPadParams) {
  // Always-current draft, so imperative handlers (number pad) can read the latest
  // sets without stale-closure surprises.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Which set field the custom number pad is editing.
  const [editing, setEditing] = useState<NumberPadTarget | null>(null);
  // Snapshot of the exercise's sets when editing began, plus the in-progress
  // weight/reps — so each keystroke recomputes the live target cascade from the
  // original values (see handlePadLiveChange → applyLiveSet).
  const editOrigin = useRef<{
    key: string;
    index: number;
    sets: DraftSet[];
  } | null>(null);
  const liveEdit = useRef<{ weight: number; reps: number }>({
    weight: 0,
    reps: 0,
  });
  const openNumberPad = useCallback(
    (key: string, index: number, field: "weight" | "reps" | "duration") => {
      Keyboard.dismiss();
      playHapticFeedback("light", false);
      // Snapshot once per set (weight → Next → reps keeps the same origin); tapping a
      // different set — or re-tapping after its value changed — refreshes it.
      const o = editOrigin.current;
      if (!o || o.key !== key || o.index !== index) {
        const sets = (
          draftRef.current.find((e) => e.key === key)?.sets ?? []
        ).map((s) => ({ ...s }));
        editOrigin.current = { key, index, sets };
        const s = sets[index];
        liveEdit.current = { weight: s?.weight ?? 0, reps: s?.reps ?? 0 };
      }
      setEditing({ key, index, field });
    },
    [],
  );

  // Each keystroke in the pad updates the in-progress value and re-applies the live
  // target cascade, recomputed from the open-time snapshot so following sets that
  // still match the original "drag" along as you type (customized rows stay put).
  const handlePadLiveChange = useCallback(
    (key: string, index: number, field: "weight" | "reps" | "duration", n: number) => {
      if (field === "duration") {
        editSet(key, index, { duration: Math.max(0, Math.round(n)) });
        return;
      }
      const o = editOrigin.current;
      if (!o || o.key !== key || o.index !== index) return;
      liveEdit.current = { ...liveEdit.current, [field]: n };
      applyLiveSet(
        key,
        index,
        o.sets,
        liveEdit.current.weight,
        liveEdit.current.reps,
      );
    },
    [applyLiveSet, editSet],
  );

  // Hevy-style rep mirroring: when a set's weight settles, tie its reps to the set
  // directly above IFF the weights match (same working load) or the weight is 0
  // (bodyweight / not-yet-entered). Matching → mirror the row above's reps; diverging
  // → clear the reps that were merely auto-copied from that row. Routed through the
  // live snapshot so the change (and its downward cascade) is reflected immediately.
  const mirrorRepsToWeight = useCallback(
    (key: string, index: number) => {
      const o = editOrigin.current;
      if (index <= 0 || !o || o.key !== key || o.index !== index) return;
      const above = o.sets[index - 1];
      if (!above) return;
      const { weight, reps } = liveEdit.current;
      const nextReps = mirroredReps(above, weight, reps);
      if (nextReps !== null) {
        liveEdit.current = { ...liveEdit.current, reps: nextReps };
        applyLiveSet(key, index, o.sets, liveEdit.current.weight, nextReps);
      }
    },
    [applyLiveSet],
  );

  // Tapping "Done" on the number pad finalizes the set: check it off (starting
  // rest) and close the pad. The value + downward cascade already landed live as
  // the user typed (handlePadLiveChange), so Done just commits and completes.
  const handleNumberPadDone = useCallback(() => {
    if (!editing) return;
    if (editing.field === "weight")
      mirrorRepsToWeight(editing.key, editing.index);
    const ex = draft.find((e) => e.key === editing.key);
    const set = ex?.sets[editing.index];
    if (set && !set.done) {
      editSet(editing.key, editing.index, { done: true });
      startRestTimer(DEFAULT_REST_SECONDS, { exerciseName: ex?.name });
    }
    editOrigin.current = null;
    setEditing(null);
  }, [editing, draft, editSet, startRestTimer, mirrorRepsToWeight]);

  // Weight → "Next" settles the weight (mirroring reps) and moves on to reps.
  const handleNumberPadNext = () => {
    if (!editing) return;
    mirrorRepsToWeight(editing.key, editing.index);
    setEditing((e) => (e ? { ...e, field: "reps" } : e));
  };

  // Dismissed (backdrop / hardware back) — drop the snapshot, no complete.
  const closeNumberPad = () => {
    editOrigin.current = null;
    setEditing(null);
  };

  return {
    editing,
    openNumberPad,
    handlePadLiveChange,
    handleNumberPadNext,
    handleNumberPadDone,
    closeNumberPad,
  };
}
