import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  GestureResponderEvent,
  Keyboard,
  View as RNView,
  StyleSheet,
  TextInput,
  TextInputProps,
} from 'react-native';

interface WorkoutNoteInputProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  // Auto-grow mode: the field hugs its content (min→max) and scrolls past max.
  autoGrow?: boolean;
}

export interface WorkoutNoteInputRef {
  focus: () => void;
  blur: () => void;
}

const FOCUS_DELAY_MS = 75;
const MOVE_THRESHOLD = 10;

// Auto-grow bounds. Single line == AUTO_MIN_HEIGHT so the field matches the 34pt
// composer buttons (32 content + 1pt border top/bottom). A multiline TextInput
// grows itself with content; minHeight/maxHeight just bound it (then it scrolls
// past the max). The parent pill clips with overflow:hidden so glyphs stay in the
// rounded box.
const AUTO_MIN_HEIGHT = 32;
const AUTO_MAX_HEIGHT = 124;

const WorkoutNoteInput = forwardRef<WorkoutNoteInputRef, WorkoutNoteInputProps>(
  ({ value, onChangeText, placeholder = "Start typing your workout...\n\nExamples:\nBench 135x8, 155x6\nSquats 225 for 5 reps\nPullups bodyweight x 10, 8, 6", autoGrow = false, ...props }, ref) => {
    const { currentTheme } = useTheme();
    const inputRef = useRef<TextInput>(null);

    // Track actual keyboard visibility via event listeners (not local state that can get corrupted)
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const pressStartPosition = useRef<{ x: number; y: number } | null>(null);
    const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Listen for actual keyboard show/hide events - this is the source of truth
    useEffect(() => {
      const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
      const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    const clearFocusTimeout = useCallback(() => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    }, []);

    // Reset touch state when app goes to background to prevent stale state
    useEffect(() => {
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState !== 'active') {
          clearFocusTimeout();
          pressStartPosition.current = null;
        }
      };

      const subscription = AppState.addEventListener('change', handleAppStateChange);
      return () => subscription.remove();
    }, [clearFocusTimeout]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      blur: () => {
        inputRef.current?.blur();
      },
    }));

    const handleTouchStart = useCallback((event: GestureResponderEvent) => {
      // If keyboard is already visible, let normal touch handling work
      if (isKeyboardVisible) return;

      pressStartPosition.current = {
        x: event.nativeEvent.pageX,
        y: event.nativeEvent.pageY,
      };

      // Start timeout for deliberate tap (distinguishes from scroll)
      focusTimeoutRef.current = setTimeout(() => {
        if (pressStartPosition.current) {
          playHapticFeedback('light', false);
          inputRef.current?.focus();
        }
      }, FOCUS_DELAY_MS);
    }, [isKeyboardVisible]);

    const handleTouchMove = useCallback((event: GestureResponderEvent) => {
      if (pressStartPosition.current) {
        const dx = Math.abs(event.nativeEvent.pageX - pressStartPosition.current.x);
        const dy = Math.abs(event.nativeEvent.pageY - pressStartPosition.current.y);
        if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
          // User is scrolling, cancel focus
          clearFocusTimeout();
          pressStartPosition.current = null;
        }
      }
    }, [clearFocusTimeout]);

    const handleTouchEnd = useCallback(() => {
      clearFocusTimeout();
      pressStartPosition.current = null;
    }, [clearFocusTimeout]);

    return (
      <RNView style={[styles.container, autoGrow && styles.containerAuto]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            autoGrow && styles.inputAuto,
            {
              color: currentTheme.colors.text,
            }
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={currentTheme.colors.text + '40'}
          multiline
          // Keep scroll enabled always: with it off, an iOS multiline TextInput
          // won't report a contentSize taller than its current frame, so
          // onContentSizeChange never sees the growth and the box stays stuck at
          // its starting height. Below the max there's nothing to scroll anyway
          // (the height hugs the content); past the max it scrolls.
          scrollEnabled
          textAlignVertical="top"
          autoCapitalize="sentences"
          autoCorrect={false}
          showSoftInputOnFocus={true}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          {...props}
        />
      </RNView>
    );
  }
);

WorkoutNoteInput.displayName = 'WorkoutNoteInput';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  containerAuto: {
    flex: 0,
    alignSelf: 'stretch',
    paddingHorizontal: 14,
    paddingVertical: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    minHeight: 200,
  },
  inputAuto: {
    // Let the multiline field grow itself between these bounds (then scroll).
    // These override the base `input` minHeight (200) which would otherwise pin
    // the box ~200pt tall.
    flex: 0,
    minHeight: AUTO_MIN_HEIGHT,
    maxHeight: AUTO_MAX_HEIGHT,
    paddingTop: 6,
    paddingBottom: 6,
  },
});

export default WorkoutNoteInput;
