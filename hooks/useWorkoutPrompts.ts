// Confirmation prompts for the workout tab's header actions: discard, restart
// the workout clock, and the "update your routine?" offer before finishing.
import { useAlert } from "@/components/CustomAlert";
import type { WorkoutNoteInputRef } from "@/components/workout/WorkoutNoteInput";
import playHapticFeedback from "@/lib/utils/haptic";
import { useCallback, type RefObject } from "react";
import { Keyboard } from "react-native";

interface UseWorkoutPromptsParams {
  showAlert: ReturnType<typeof useAlert>["showAlert"];
  noteInputRef: RefObject<WorkoutNoteInputRef | null>;
  discardWorkout: () => Promise<void>;
  formatTime: (seconds: number) => string;
  elapsedTime: number;
  resetWorkoutTimer: () => void;
  getStartedRoutineChange: () => Promise<{ name: string } | null>;
  syncStartedRoutine: () => Promise<void>;
  handleFinishWorkout: () => void;
}

export function useWorkoutPrompts({
  showAlert,
  noteInputRef,
  discardWorkout,
  formatTime,
  elapsedTime,
  resetWorkoutTimer,
  getStartedRoutineChange,
  syncStartedRoutine,
  handleFinishWorkout,
}: UseWorkoutPromptsParams) {
  // Discard the current workout (from the Cancel button), with a confirm.
  const handleDiscard = useCallback(() => {
    // Dismiss the composer keyboard before the confirmation alert.
    noteInputRef.current?.blur();
    Keyboard.dismiss();
    showAlert({
      title: "Discard workout?",
      message:
        "This clears everything you've logged in this session. It can't be undone.",
      buttons: [
        { text: "Keep going", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => discardWorkout(),
        },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAlert, discardWorkout]);

  // Restart-workout-timer moved out of the rest UI: long-press the header clock.
  const handleTimerLongPress = useCallback(() => {
    playHapticFeedback("medium", false);
    showAlert({
      title: "Restart workout timer",
      message: `Reset the elapsed time (${formatTime(elapsedTime)}) to zero?`,
      type: "confirm",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Restart", onPress: resetWorkoutTimer },
      ],
    });
  }, [showAlert, formatTime, elapsedTime, resetWorkoutTimer]);

  // Handle finish button press. If this workout came from a routine and its shape
  // changed (exercises added/removed/reordered, set counts or reps edited), offer
  // to fold those changes back into the routine before opening the finish flow.
  const handleFinishPress = useCallback(async () => {
    playHapticFeedback("medium", false);
    const change = await getStartedRoutineChange();
    if (!change) {
      handleFinishWorkout();
      return;
    }
    showAlert({
      title: "Update your routine?",
      message: `You changed things up from “${change.name}”. Save these changes to the routine for next time?`,
      buttons: [
        {
          text: "Update routine",
          onPress: async () => {
            await syncStartedRoutine();
            handleFinishWorkout();
          },
        },
        {
          text: "Keep routine as-is",
          style: "cancel",
          onPress: () => handleFinishWorkout(),
        },
      ],
    });
  }, [
    getStartedRoutineChange,
    syncStartedRoutine,
    handleFinishWorkout,
    showAlert,
  ]);

  return { handleDiscard, handleTimerLongPress, handleFinishPress };
}
