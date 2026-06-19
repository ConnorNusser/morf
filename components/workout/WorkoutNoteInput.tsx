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
  useColorScheme,
} from 'react-native';

interface WorkoutNoteInputProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  // Composer mode: shrinks the box so the synthesized workout can be the hero.
  compact?: boolean;
  // Auto-grow mode: the field hugs its content (min→max) and scrolls past max.
  autoGrow?: boolean;
}

export interface WorkoutNoteInputRef {
  focus: () => void;
  blur: () => void;
  appendText: (text: string) => void;
}

const FOCUS_DELAY_MS = 75;
const MOVE_THRESHOLD = 10;

// Auto-grow bounds. Single line == AUTO_MIN_HEIGHT so the field lines up with the
// 40pt composer buttons (38 + 1pt border top/bottom); it grows with content up to
// AUTO_MAX_HEIGHT, then scrolls. Driving the height off onContentSizeChange — not
// just min/maxHeight styles — is what keeps the text inside the rounded box: iOS
// doesn't reliably clamp a multiline TextInput by style alone, so the glyphs spill
// past the border. Measuring the content and setting an explicit height fixes that.
const AUTO_MIN_HEIGHT = 38;
const AUTO_MAX_HEIGHT = 120;

const WorkoutNoteInput = forwardRef<WorkoutNoteInputRef, WorkoutNoteInputProps>(
  ({ value, onChangeText, placeholder = "Start typing your workout...\n\nExamples:\nBench 135x8, 155x6\nSquats 225 for 5 reps\nPullups bodyweight x 10, 8, 6", compact = false, autoGrow = false, ...props }, ref) => {
    const { currentTheme } = useTheme();
    const _colorScheme = useColorScheme();
    const inputRef = useRef<TextInput>(null);

    // Track actual keyboard visibility via event listeners (not local state that can get corrupted)
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const pressStartPosition = useRef<{ x: number; y: number } | null>(null);
    const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Measured height for auto-grow mode (clamped). See AUTO_MIN/MAX_HEIGHT.
    const [autoHeight, setAutoHeight] = useState(AUTO_MIN_HEIGHT);
    const handleContentSizeChange = useCallback((e: { nativeEvent: { contentSize: { height: number } } }) => {
      const h = e.nativeEvent.contentSize.height;
      setAutoHeight(Math.min(AUTO_MAX_HEIGHT, Math.max(AUTO_MIN_HEIGHT, h)));
    }, []);
    // Collapse straight back to one line when the text is cleared (e.g. after send),
    // since an empty field can skip firing onContentSizeChange.
    useEffect(() => {
      if (autoGrow && value === '') setAutoHeight(AUTO_MIN_HEIGHT);
    }, [autoGrow, value]);

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
      appendText: (text: string) => {
        const newValue = value ? `${value}\n${text}` : text;
        onChangeText(newValue);
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
      <RNView style={[styles.container, compact && styles.containerCompact, autoGrow && styles.containerAuto]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            compact && styles.inputCompact,
            autoGrow && styles.inputAuto,
            autoGrow && { height: autoHeight },
            {
              color: currentTheme.colors.text,
            }
          ]}
          value={value}
          onChangeText={onChangeText}
          onContentSizeChange={autoGrow ? handleContentSizeChange : props.onContentSizeChange}
          placeholder={placeholder}
          placeholderTextColor={currentTheme.colors.text + '40'}
          multiline
          // Only let it scroll once it's hit the max height; below that the box
          // hugs the content so there's nothing to scroll (and no jitter).
          scrollEnabled={!autoGrow || autoHeight >= AUTO_MAX_HEIGHT}
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
  containerCompact: {
    paddingTop: 6,
    paddingBottom: 6,
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
  inputCompact: {
    minHeight: 0,
  },
  inputAuto: {
    // Height is driven explicitly by onContentSizeChange (see autoHeight).
    // minHeight: 0 is required to cancel the base `input` minHeight (200) — that
    // would otherwise win over the measured height and pin the box ~200pt tall.
    flex: 0,
    minHeight: 0,
    paddingTop: 9,
    paddingBottom: 9,
  },
});

export default WorkoutNoteInput;
