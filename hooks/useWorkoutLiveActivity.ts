// Live Activity: the current-set card (Lock Screen / Dynamic Island) for the
// workout tab, plus folding Lock-Screen taps back into the draft on resume.
import {
  endLiveActivity,
  isLiveActivitySupported,
  pullPendingActions,
  saveWorkoutSnapshot,
  startLiveActivity,
  updateLiveActivity,
} from "@/lib/liveActivity/liveActivity";
import type {
  LiveActivityContent,
  PendingAction,
  SnapshotSet,
} from "@/lib/liveActivity/types";
import {
  buildSetSnapshot,
  currentSnapshotSet,
  setActivityContent,
} from "@/lib/workout/liveSetSnapshot";
import type { DraftSet, WorkoutDraft } from "@/lib/workout/workoutDraft";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";

interface UseWorkoutLiveActivityParams {
  draft: WorkoutDraft;
  isResting: boolean;
  hasWorkoutStarted: boolean;
  editSet: (key: string, index: number, patch: Partial<DraftSet>) => void;
  addSetTo: (key: string) => void;
  addRestTime: (seconds: number) => void;
  skipRestTimer: () => void;
  startRestTimer: (seconds: number) => void;
}

export function useWorkoutLiveActivity({
  draft,
  isResting,
  hasWorkoutStarted,
  editSet,
  addSetTo,
  addRestTime,
  skipRestTimer,
  startRestTimer,
}: UseWorkoutLiveActivityParams) {
  // Flat, ordered list of every working set — drives the "current set" shown and
  // the native "complete → next not-done set" advance (mirrored to the App Group
  // so the Lock Screen can jump exercises with the app suspended).
  const snapshot: SnapshotSet[] = useMemo(
    () => buildSetSnapshot(draft),
    [draft],
  );
  const currentSet = useMemo(() => currentSnapshotSet(snapshot), [snapshot]);

  // We own the SET-mode activity; useRestTimer owns REST-mode. While resting it
  // takes over the single activity, so we stand down and re-publish the current
  // set once rest ends.
  const setActivityLive = useRef(false);
  const lastSetKey = useRef("");
  useEffect(() => {
    if (!isLiveActivitySupported()) return;
    if (isResting) {
      setActivityLive.current = false;
      lastSetKey.current = "";
      return;
    }

    if (!hasWorkoutStarted || !currentSet) {
      if (setActivityLive.current) {
        endLiveActivity();
        setActivityLive.current = false;
      }
      lastSetKey.current = "";
      return;
    }

    const content: LiveActivityContent = setActivityContent(currentSet);
    saveWorkoutSnapshot(snapshot); // keep the App Group fresh for the intents
    const key = JSON.stringify(content);
    if (setActivityLive.current && key === lastSetKey.current) return;
    lastSetKey.current = key;
    if (setActivityLive.current) updateLiveActivity(content);
    else {
      setActivityLive.current = true;
      startLiveActivity(content);
    }
  }, [isResting, hasWorkoutStarted, currentSet, snapshot]);

  // Fold Lock-Screen taps (queued by the App Intents) back into the draft when we
  // return to the foreground.
  const applyPending = useCallback(
    (a: PendingAction) => {
      if (a.type === "completeSet")
        editSet(a.exerciseKey, a.setIndex, { done: true });
      else if (a.type === "adjustReps")
        editSet(a.exerciseKey, a.setIndex, { reps: a.reps });
      else if (a.type === "adjustWeight")
        editSet(a.exerciseKey, a.setIndex, { weight: a.weight });
      else if (a.type === "addRest") addRestTime(a.seconds);
      else if (a.type === "addBonusSet") addSetTo(a.exerciseKey);
      else if (a.type === "skipRest") skipRestTimer();
      else if (a.type === "startRest") {
        // A set was completed on the Lock Screen — resume its rest with the time
        // that's actually left (the countdown started when they tapped).
        const remaining = Math.round((a.endTime - Date.now()) / 1000);
        if (remaining > 1) startRestTimer(remaining);
      }
    },
    [editSet, addRestTime, skipRestTimer, startRestTimer, addSetTo],
  );
  useEffect(() => {
    const drain = async () => {
      (await pullPendingActions()).forEach(applyPending);
    };
    drain();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") drain();
    });
    return () => sub.remove();
  }, [applyPending]);
}
