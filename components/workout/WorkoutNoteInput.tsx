import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View as RNView,
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

const WorkoutNoteInput = forwardRef<WorkoutNoteInputRef, WorkoutNoteInputProps>(
  ({ value, onChangeText, placeholder = "Start typing your workout...\n\nExamples:\nBench 135x8, 155x6\nSquats 225 for 5 reps\nPullups bodyweight x 10, 8, 6", ...props }, ref) => {
    const { currentTheme } = useTheme();
    const inputRef = useRef<TextInput>(null);
    const inputAccessoryViewID = 'workoutNoteAccessory';

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      appendText: (text: string) => {
        const newValue = value ? `${value}\n${text}` : text;
        onChangeText(newValue);
      },
    }));

    return (
      <>
        <RNView style={styles.container}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
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
            inputAccessoryViewID={inputAccessoryViewID}
            {...props}
          />
        </RNView>
        {/* Keyboard accessory with Done button */}
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={inputAccessoryViewID}>
            <RNView style={[styles.accessoryContainer, { backgroundColor: currentTheme.colors.surface, borderTopColor: currentTheme.colors.border }]}>
              <RNView style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => Keyboard.dismiss()}
                style={styles.doneButton}
              >
                <Text style={[styles.doneButtonText, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
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
    padding: 20,
    paddingTop: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 200,
  },
  accessoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneButtonText: {
    fontSize: 16,
  },
});

export default WorkoutNoteInput;
