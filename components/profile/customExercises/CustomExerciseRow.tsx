import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatFullDate as formatDate } from '@/lib/ui/formatters';
import { danger, radius, space, tint } from '@/lib/ui/tokens';
import { CustomExercise } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import ExerciseEditForm from '@/components/profile/customExercises/ExerciseEditForm';
import { itemStyles } from '@/components/profile/customExercises/itemStyles';
import { CustomExerciseForm } from '@/components/profile/customExercises/useCustomExerciseForm';

interface CustomExerciseRowProps {
  exercise: CustomExercise;
  form: CustomExerciseForm;
  onDelete: (exercise: CustomExercise) => void;
}

// One custom exercise in the manager list; swaps to the inline edit form while being edited.
export default function CustomExerciseRow({ exercise, form, onDelete }: CustomExerciseRowProps) {
  const { currentTheme } = useTheme();
  const isEditing = form.editingExercise?.id === exercise.id;

  if (isEditing) {
    return (
      <View
        style={[
          itemStyles.exerciseItem,
          itemStyles.editingItem,
          {
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.primary,
          }
        ]}
      >
        <ExerciseEditForm
          editedName={form.editedName}
          setEditedName={form.setEditedName}
          selectedEquipment={form.selectedEquipment}
          setSelectedEquipment={form.setSelectedEquipment}
          onCancel={form.handleCancelEditAdd}
          onSave={form.handleSaveEdit}
          placeholder="Enter exercise name"
          saveLabel="Save"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        itemStyles.exerciseItem,
        {
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }
      ]}
    >
      <View style={styles.exerciseInfo}>
        <Text variant="body" tone="primary" style={styles.exerciseName}>
          {exercise.name}
        </Text>

        <View style={styles.metadataRow}>
          {exercise.equipment && exercise.equipment.length > 0 && (
            <View style={[styles.metadataChip, { backgroundColor: tint(currentTheme.colors.primary) }]}>
              <Text variant="meta" weight="medium" style={styles.metadataChipText}>
                {exercise.equipment[0]}
              </Text>
            </View>
          )}
          {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
            <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.text + '10' }]}>
              <Text variant="meta" tone="secondary" weight="medium" style={styles.metadataChipText}>
                {exercise.primaryMuscles.join(', ')}
              </Text>
            </View>
          )}
          {exercise.category && (
            <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.text + '10' }]}>
              <Text variant="meta" tone="secondary" weight="medium" style={styles.metadataChipText}>
                {exercise.category}
              </Text>
            </View>
          )}
        </View>

        <Text variant="meta" tone="faint" style={styles.exerciseId} numberOfLines={1}>
          ID: {exercise.id}
        </Text>
        <Text variant="meta" tone="faint" style={styles.exerciseDate}>
          Created {formatDate(exercise.createdAt)}
        </Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={() => form.handleStartEdit(exercise)}
          style={[styles.actionButton, { backgroundColor: tint(currentTheme.colors.primary) }]}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil" size={16} color={currentTheme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(exercise)}
          style={[styles.actionButton, { backgroundColor: danger + '15' }]}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle" size={18} color={danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseInfo: {
    flex: 1,
    marginRight: space.md,
  },
  exerciseName: {
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  metadataChip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
  },
  metadataChipText: {
    textTransform: 'capitalize',
  },
  exerciseId: {
    marginTop: 2,
  },
  exerciseDate: {
    marginTop: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
