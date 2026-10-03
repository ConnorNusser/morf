import { View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';

interface WorkoutCommentComposerProps {
  commentText: string;
  onChangeText: (text: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export default function WorkoutCommentComposer({
  commentText,
  onChangeText,
  isSubmitting,
  onSubmit,
}: WorkoutCommentComposerProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.inputContainer, { backgroundColor: currentTheme.colors.background }]}>
      <RNView style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.surface }]}>
        <TextInput
          style={[
            styles.input,
            {
              color: currentTheme.colors.text,
            }
          ]}
          placeholder="Add a comment..."
          placeholderTextColor={currentTheme.colors.text + '40'}
          value={commentText}
          onChangeText={onChangeText}
          multiline
          maxLength={500}
          editable={!isSubmitting}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: commentText.trim() && !isSubmitting
                ? currentTheme.colors.primary
                : 'transparent',
            }
          ]}
          onPress={onSubmit}
          disabled={!commentText.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={currentTheme.colors.primary} />
          ) : (
            <Ionicons
              name="arrow-up-circle"
              size={28}
              color={commentText.trim() ? '#fff' : currentTheme.colors.text + '30'}
            />
          )}
        </TouchableOpacity>
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
