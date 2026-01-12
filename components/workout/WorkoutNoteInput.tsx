import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  GestureResponderEvent,
  InputAccessoryView,
  Keyboard,
  Platform,
  View as RNView,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';

interface WorkoutNoteInputProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export interface WorkoutNoteInputRef {
  focus: () => void;
  blur: () => void;
  appendText: (text: string) => void;
}

const FOCUS_DELAY_MS = 75;
const MOVE_THRESHOLD = 10;

const WorkoutNoteInput = forwardRef<WorkoutNoteInputRef, WorkoutNoteInputProps>(
  ({ value, onChangeText, placeholder = "Start typing your workout...\n\nExamples:\nBench 135x8, 155x6\nSquats 225 for 5 reps\nPullups bodyweight x 10, 8, 6", ...props }, ref) => {
    const { currentTheme } = useTheme();
    const _colorScheme = useColorScheme();
    const inputRef = useRef<TextInput>(null);
    const inputAccessoryViewID = 'workoutNoteAccessory';

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
      <>
        <RNView style={styles.container}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: currentTheme.colors.text,
              }
            ]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={currentTheme.colors.text + '40'}
            multiline
            scrollEnabled
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect={false}
            showSoftInputOnFocus={true}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            inputAccessoryViewID={inputAccessoryViewID}
            {...props}
          />
        </RNView>
        {/* Keyboard accessory with Done button - only when keyboard is visible */}
        {Platform.OS === 'ios' && isKeyboardVisible && (
          <InputAccessoryView nativeID={inputAccessoryViewID}>
              <RNView style={[styles.accessoryContainer, { borderTopColor: currentTheme.colors.border }]}>
                <RNView style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => Keyboard.dismiss()}
                  style={[styles.doneButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border, borderWidth: 1 }]}
                >
                  <Text style={[styles.doneButtonText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </RNView>
          </InputAccessoryView>
        )}
      </>
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
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 200,
  },
  accessoryBlur: {
    overflow: 'hidden',
  },
  accessoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 15,
  },
});

export default WorkoutNoteInput;
