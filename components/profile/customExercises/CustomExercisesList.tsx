import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { danger, radius, screenGutter, space } from '@/lib/ui/tokens';
import { CustomExercise } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import CustomExerciseRow from '@/components/profile/customExercises/CustomExerciseRow';
import ExerciseEditForm from '@/components/profile/customExercises/ExerciseEditForm';
import { itemStyles } from '@/components/profile/customExercises/itemStyles';
import { CustomExerciseForm } from '@/components/profile/customExercises/useCustomExerciseForm';

interface CustomExercisesListProps {
  exercises: CustomExercise[];
  totalCount: number;
  searchQuery: string;
  form: CustomExerciseForm;
  onDelete: (exercise: CustomExercise) => void;
  onClearAll: () => void;
}

// Scrollable body of the manager: inline add form, empty state, filtered rows, and Clear All.
export default function CustomExercisesList({
  exercises, totalCount, searchQuery, form, onDelete, onClearAll,
}: CustomExercisesListProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { isAdding, editingExercise } = form;

  return (
    <ScrollView
      style={styles.exercisesList}
      contentContainerStyle={styles.exercisesListContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {isAdding ? (
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
            onSave={form.handleSaveAdd}
            placeholder="e.g., Super Horizontal Press"
            saveLabel="Add"
            hint="AI will generate muscle group metadata"
            saving={form.isGenerating}
          />
        </View>
      ) : null}

      {exercises.length === 0 && !isAdding ? (
        <View style={[styles.emptyState, { backgroundColor: currentTheme.colors.surface }]}>
          <Ionicons
            name={searchQuery ? "search-outline" : "barbell-outline"}
            size={32}
            color={ink.faint}
          />
          <Text variant="body" tone="muted" weight="medium" style={styles.emptyText}>
            {searchQuery ? 'No exercises found' : 'No custom exercises yet'}
          </Text>
          <Text variant="meta" tone="faint" weight="regular" style={styles.emptySubtext}>
            {searchQuery
              ? 'Try a different search term'
              : 'Log workouts with new exercises and they\'ll appear here'}
          </Text>
        </View>
      ) : (
        <>
          {searchQuery && (
            <Text variant="meta" tone="muted" weight="regular" style={styles.resultsCount}>
              {exercises.length} result{exercises.length !== 1 ? 's' : ''}
            </Text>
          )}

          {exercises.map((exercise) => (
            <CustomExerciseRow
              key={exercise.id}
              exercise={exercise}
              form={form}
              onDelete={onDelete}
            />
          ))}

          {totalCount > 0 && !searchQuery && !isAdding && !editingExercise && (
            <TouchableOpacity
              style={[styles.clearAllButton, { backgroundColor: currentTheme.colors.surface, borderWidth: 1, borderColor: danger + '30' }]}
              onPress={onClearAll}
              activeOpacity={0.7}
            >
              <Text variant="meta" weight="semiBold" style={styles.clearAllText}>
                Clear All Custom Exercises
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  exercisesList: {
    flex: 1,
  },
  exercisesListContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: 40,
  },
  resultsCount: {
    marginBottom: space.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: radius.card,
    gap: space.sm,
    marginTop: space.xl,
  },
  emptyText: {
    marginTop: space.xs,
  },
  emptySubtext: {
    textAlign: 'center',
  },
  clearAllButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.control,
    marginTop: space.md,
  },
  clearAllText: {
    color: danger,
  },
});
