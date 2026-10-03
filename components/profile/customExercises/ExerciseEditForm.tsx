import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space } from '@/lib/ui/tokens';
import { EQUIPMENT_OPTIONS, generateExerciseId, generateFullExerciseName } from '@/lib/workout/customExercises';
import { Equipment } from '@/types';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';

interface ExerciseEditFormProps {
  editedName: string;
  setEditedName: (v: string) => void;
  selectedEquipment: Equipment;
  setSelectedEquipment: (v: Equipment) => void;
  onCancel: () => void;
  onSave: () => void;
  placeholder: string;
  saveLabel: string;
  hint?: string;
  saving?: boolean;
}

// Custom-exercise name/equipment form with a live full-name + id preview; shared by add and edit flows.
export default function ExerciseEditForm({
  editedName, setEditedName, selectedEquipment, setSelectedEquipment,
  onCancel, onSave, placeholder, saveLabel, hint, saving = false,
}: ExerciseEditFormProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const fullNamePreview = editedName.trim()
    ? generateFullExerciseName(editedName, selectedEquipment)
    : '';
  const previewId = fullNamePreview ? generateExerciseId(fullNamePreview) : 'exercise-id';

  return (
    <View style={styles.editForm}>
      <Text variant="meta" tone="secondary" weight="medium" style={styles.editLabel}>
        Exercise Name (without equipment)
      </Text>
      <TextInput
        style={[
          styles.editInput,
          {
            backgroundColor: currentTheme.colors.background,
            color: currentTheme.colors.text,
            borderColor: currentTheme.colors.border,
          }
        ]}
        value={editedName}
        onChangeText={setEditedName}
        placeholder={placeholder}
        placeholderTextColor={ink.faint}
        autoFocus
      />

      <Text variant="meta" tone="secondary" weight="medium" style={[styles.editLabel, { marginTop: space.md }]}>
        Equipment Type
      </Text>
      <View style={styles.equipmentRow}>
        {EQUIPMENT_OPTIONS.map((eq) => (
          <TouchableOpacity
            key={eq.value}
            style={[
              styles.equipmentChip,
              {
                backgroundColor: selectedEquipment === eq.value
                  ? currentTheme.colors.primary
                  : currentTheme.colors.background,
                borderColor: selectedEquipment === eq.value
                  ? currentTheme.colors.primary
                  : currentTheme.colors.border,
              }
            ]}
            onPress={() => setSelectedEquipment(eq.value)}
          >
            <Text
              variant="meta"
              style={[
                styles.equipmentChipText,
                {
                  color: selectedEquipment === eq.value ? '#FFFFFF' : currentTheme.colors.text,
                }
              ]}
            >
              {eq.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {fullNamePreview && (
        <View style={[styles.previewBox, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}>
          <Text variant="meta" tone="faint" weight="regular" style={styles.previewLabel}>
            Full Name:
          </Text>
          <Text variant="meta" tone="primary" weight="semiBold" style={styles.previewValue}>
            {fullNamePreview}
          </Text>
          <Text variant="meta" tone="faint" weight="regular" style={[styles.previewLabel, { marginTop: space.xs }]}>
            ID:
          </Text>
          <Text variant="meta" tone="secondary" weight="regular" style={styles.previewValue}>
            {previewId}
          </Text>
        </View>
      )}

      {hint && (
        <Text variant="meta" tone="faint" weight="regular" style={styles.hintText}>
          {hint}
        </Text>
      )}

      <View style={styles.editActions}>
        <TouchableOpacity
          style={[styles.editActionButton, { backgroundColor: currentTheme.colors.background }]}
          onPress={onCancel}
          disabled={saving}
        >
          <Text variant="meta" tone="primary" weight="semiBold" style={styles.editActionText}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.editActionButton,
            { backgroundColor: currentTheme.colors.primary },
            (!editedName.trim() || saving) && styles.disabledButton
          ]}
          onPress={onSave}
          disabled={!editedName.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text variant="meta" weight="semiBold" style={[styles.editActionText, { color: '#FFFFFF' }]}>
              {saveLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editForm: {
    flex: 1,
  },
  editLabel: {
    marginBottom: space.sm,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: radius.control,
    padding: space.md,
    fontSize: 15,
  },
  equipmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  equipmentChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  equipmentChipText: {
  },
  previewBox: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  previewLabel: {
  },
  previewValue: {
  },
  hintText: {
    marginTop: space.sm,
    fontStyle: 'italic',
  },
  editActions: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.lg,
  },
  editActionButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionText: {
  },
  disabledButton: {
    opacity: 0.5,
  },
});
