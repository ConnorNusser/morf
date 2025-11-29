import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage';
import { WorkoutTemplate } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';

interface TemplateEditorModalProps {
  visible: boolean;
  template?: WorkoutTemplate | null; // If provided, we're editing; otherwise creating
  onClose: () => void;
  onSave: () => void;
}

const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({
  visible,
  template,
  onClose,
  onSave,
}) => {
  const { currentTheme } = useTheme();
  const [name, setName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      if (template) {
        setName(template.name);
        setNoteText(template.noteText);
      } else {
        setName('');
        setNoteText('');
      }
    }
  }, [visible, template]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your template.');
      return;
    }

    if (!noteText.trim()) {
      Alert.alert('Content Required', 'Please enter some workout notes for your template.');
      return;
    }

    setIsSaving(true);

    try {
      const templateToSave: WorkoutTemplate = {
        id: template?.id || `template_${Date.now()}`,
        name: name.trim(),
        noteText: noteText.trim(),
        createdAt: template?.createdAt || new Date(),
        lastUsed: template?.lastUsed,
      };

      await storageService.saveWorkoutTemplate(templateToSave);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [name, noteText, template, onSave, onClose]);

  const handleClose = useCallback(() => {
    if (name.trim() || noteText.trim()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  }, [name, noteText, onClose]);

  const isEditing = !!template;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            {isEditing ? 'Edit Template' : 'New Template'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.headerButton}
            disabled={isSaving || !name.trim() || !noteText.trim()}
          >
            <Text
              style={[
                styles.saveButton,
                {
                  color: (name.trim() && noteText.trim() && !isSaving)
                    ? currentTheme.colors.accent
                    : currentTheme.colors.text + '40',
                  fontFamily: 'Raleway_600SemiBold',
                },
              ]}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Template Name */}
          <RNView style={styles.nameContainer}>
            <TextInput
              style={[
                styles.nameInput,
                {
                  color: currentTheme.colors.text,
                  borderBottomColor: currentTheme.colors.border,
                  fontFamily: 'Raleway_600SemiBold',
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Template name..."
              placeholderTextColor={currentTheme.colors.text + '40'}
              maxLength={50}
              autoFocus={!isEditing}
            />
          </RNView>

          {/* Notes Input */}
          <RNView style={styles.notesContainer}>
            <TextInput
              style={[
                styles.notesInput,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                },
              ]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={`Enter your workout notes...

Examples:
Bench Press 135x10, 145x8, 155x6

Squats 225x8, 245x6

Dumbbell Rows 50x12, 55x10`}
              placeholderTextColor={currentTheme.colors.text + '30'}
              multiline
              textAlignVertical="top"
              autoFocus={isEditing}
            />
          </RNView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  saveButton: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  nameContainer: {
    paddingVertical: 16,
  },
  nameInput: {
    fontSize: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  notesContainer: {
    flex: 1,
    paddingTop: 8,
  },
  notesInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
});

export default TemplateEditorModal;
