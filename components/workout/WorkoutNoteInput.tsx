import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      appendText: (text: string) => {
        const newValue = value ? `${value}\n${text}` : text;
        onChangeText(newValue);
      },
    }));

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect={false}
            scrollEnabled={false}
            {...props}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
);

WorkoutNoteInput.displayName = 'WorkoutNoteInput';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    lineHeight: 28,
    minHeight: 200,
  },
});

export default WorkoutNoteInput;
