// Composer dock state for the workout tab: open/collapsed, the input ref, and the
// measured keyboard the floating dock pads itself above.
import type { WorkoutNoteInputRef } from "@/components/workout/WorkoutNoteInput";
import playHapticFeedback from "@/lib/utils/haptic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useWorkoutComposer() {
  const noteInputRef = useRef<WorkoutNoteInputRef>(null);

  // Composer collapses to floating compose + mic buttons; opens to the full bar.
  const [composerOpen, setComposerOpen] = useState(false);
  const openComposer = useCallback(() => {
    playHapticFeedback("light", false);
    setComposerOpen(true);
    setTimeout(() => noteInputRef.current?.focus(), 60);
  }, []);
  // The composer collapses when the input loses focus. We drive this off the
  // input's own onBlur (see handleComposerBlur) rather than global keyboard
  // events: in the simulator (and during the open animation) a phantom
  // keyboardWillHide can fire even though the field is still focused, which would
  // slam the composer shut the instant you open it. The typed text lives in
  // `composerText` and is left untouched, so reopening resumes where you left off.
  const handleComposerBlur = useCallback(() => setComposerOpen(false), []);
  // Explicit collapse for scrolling the workout: keyboardDismissMode only blurs
  // the field when a software keyboard is actually up, so on the simulator (and
  // with a hardware keyboard) a scroll wouldn't fire onBlur. Drive it directly.
  const closeComposer = useCallback(() => {
    noteInputRef.current?.blur();
    Keyboard.dismiss();
    setComposerOpen(false);
  }, []);

  // Collapse the tab-bar clearance under the composer while the keyboard is up.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Measured keyboard height so the floating dock can pad itself above the
  // keyboard directly — KeyboardAvoidingView's padding doesn't reliably move an
  // absolutely-positioned child, which left the active input stuck behind it.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return {
    noteInputRef,
    composerOpen,
    openComposer,
    handleComposerBlur,
    closeComposer,
    keyboardVisible,
    keyboardHeight,
  };
}
