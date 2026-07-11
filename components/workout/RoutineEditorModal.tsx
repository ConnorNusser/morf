import { useAlert } from '@/components/CustomAlert';
import IconButton from '@/components/IconButton';
import { Text, View, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage/storage';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { type } from '@/lib/ui/typography';
import { EXERCISE_CATALOG } from '@/lib/workout/exerciseCatalog';
import { CustomExercise, Routine, RoutineExercise, RoutineSet, Exercise } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';

interface RoutineEditorModalProps {
  visible: boolean;
  routine?: Routine | null;
  // When set (no `routine` supplied), creates a new day inside this program.
  programId?: string | null;
  onClose: () => void;
  onSave: () => void;
}

interface ExercisePickerProps {
  visible: boolean;
  onSelect: (exercises: Exercise[]) => void;
  onClose: () => void;
  excludeIds?: string[];
  customExercises?: CustomExercise[];
}

const ExercisePicker: React.FC<ExercisePickerProps> = ({
  visible,
  onSelect,
  onClose,
  excludeIds = [],
  customExercises = [],
}) => {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [visible]);

  const allExercises = useMemo(() => {
    const combined: Exercise[] = [
      ...EXERCISE_CATALOG,
      ...customExercises.map(ce => ({
        ...ce,
        isCustom: true as const,
      })),
    ];
    return combined.filter(e => !excludeIds.includes(e.id));
  }, [excludeIds, customExercises]);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return allExercises.slice(0, 50);
    const query = searchQuery.toLowerCase();
    return allExercises.filter(e =>
      e.name.toLowerCase().includes(query) ||
      e.primaryMuscles.some(m => m.toLowerCase().includes(query))
    ).slice(0, 50);
  }, [allExercises, searchQuery]);

  const toggleSelection = useCallback((exerciseId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId);
      } else {
        newSet.add(exerciseId);
      }
      return newSet;
    });
  }, []);

  const handleDone = useCallback(() => {
    const selectedExercises = allExercises.filter(e => selectedIds.has(e.id));
    onSelect(selectedExercises);
    onClose();
  }, [selectedIds, allExercises, onSelect, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
        <RNView style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="close" onPress={onClose} />
          <Text variant="title" weight="semiBold" tone="primary">
            Add Exercises
          </Text>
          <TouchableOpacity onPress={handleDone} disabled={selectedIds.size === 0} hitSlop={8}>
            <Text
              variant="emphasis"
              weight="semiBold"
              style={selectedIds.size === 0 && { opacity: 0.4 }}
            >
              Add{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Text>
          </TouchableOpacity>
        </RNView>

        <RNView style={[styles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
          <Ionicons name="search" size={18} color={ink.faint} />
          <TextInput
            style={[styles.searchInput, { color: currentTheme.colors.text }]}
            placeholder="Search exercises..."
            placeholderTextColor={ink.faint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <IconButton
              icon="close-circle"
              onPress={() => setSearchQuery('')}
              iconColor={ink.faint}
            />
          )}
        </RNView>

        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                style={[
                  styles.exerciseItem,
                  {
                    borderBottomColor: currentTheme.colors.border,
                    backgroundColor: isSelected ? tint(currentTheme.colors.primary) : 'transparent',
                    borderLeftWidth: isSelected ? 3 : 0,
                    borderLeftColor: currentTheme.colors.primary,
                  }
                ]}
                onPress={() => toggleSelection(item.id)}
                activeOpacity={0.6}
              >
                <RNView style={styles.exerciseItemContent}>
                  <Text variant="body" weight="medium" tone="primary" style={styles.exerciseName}>
                    {item.name}
                  </Text>
                  <Text variant="meta" tone="muted">
                    {item.primaryMuscles.join(', ')}
                  </Text>
                </RNView>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSelected ? currentTheme.colors.primary : ink.ghost}
                />
              </TouchableOpacity>
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.exerciseList}
        />
      </SafeAreaView>
    </Modal>
  );
};

const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  visible,
  routine,
  programId,
  onClose,
  onSave,
}) => {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { showAlert } = useAlert();
  const { customExercises } = useCustomExercises();
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      if (routine) {
        setName(routine.name);
        setExercises(routine.exercises);
      } else {
        setName('');
        setExercises([]);
      }
    }
  }, [visible, routine]);

  const handleAddExercises = useCallback((workouts: Exercise[]) => {
    const newExercises: RoutineExercise[] = workouts.map(workout => ({
      exerciseId: workout.id,
      exerciseName: workout.name,
      sets: [
        { reps: 10, isWarmup: true },
        { reps: 10 },
        { reps: 10 },
        { reps: 10 },
      ],
    }));
    setExercises(prev => [...prev, ...newExercises]);
    setShowExercisePicker(false);
  }, []);

  const handleRemoveExercise = useCallback((index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddSet = useCallback((exerciseIndex: number, isWarmup: boolean = false) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exerciseIndex) return ex;
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet: RoutineSet = { reps: lastSet?.reps || 10, isWarmup };
      return { ...ex, sets: [...ex.sets, newSet] };
    }));
  }, []);

  const handleRemoveSet = useCallback((exerciseIndex: number, setIndex: number) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exerciseIndex) return ex;
      if (ex.sets.length <= 1) return ex; // Keep at least one set
      return { ...ex, sets: ex.sets.filter((_, si) => si !== setIndex) };
    }));
  }, []);

  const handleUpdateSet = useCallback((exerciseIndex: number, setIndex: number, updates: Partial<RoutineSet>) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exerciseIndex) return ex;
      return {
        ...ex,
        sets: ex.sets.map((set, si) => si === setIndex ? { ...set, ...updates } : set),
      };
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      showAlert({
        title: 'Name Required',
        message: 'Please enter a name for your routine.',
        type: 'warning',
      });
      return;
    }

    if (exercises.length === 0) {
      showAlert({
        title: 'Exercises Required',
        message: 'Please add at least one exercise to your routine.',
        type: 'warning',
      });
      return;
    }

    setIsSaving(true);

    try {
      const routineToSave: Routine = {
        // Preserve original fields so editing a program day keeps its program link + progression.
        ...(routine ?? {}),
        id: routine?.id || `routine_${Date.now()}`,
        name: name.trim(),
        exercises,
        createdAt: routine?.createdAt || new Date(),
        lastUsed: routine?.lastUsed,
      };

      // New routine + a target program → add it as a program day.
      if (!routine && programId) {
        await storageService.addProgramDay(programId, routineToSave);
      } else {
        await storageService.saveRoutine(routineToSave);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving routine:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to save routine. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [name, exercises, routine, programId, onSave, onClose, showAlert]);

  const handleClose = useCallback(() => {
    if (name.trim() || exercises.length > 0) {
      showAlert({
        title: 'Discard Changes?',
        message: 'You have unsaved changes. Are you sure you want to discard them?',
        type: 'confirm',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ],
      });
    } else {
      onClose();
    }
  }, [name, exercises.length, onClose, showAlert]);

  const getExerciseName = useCallback((exercise: RoutineExercise) => {
    if (exercise.exerciseName) return exercise.exerciseName;
    const workout = EXERCISE_CATALOG.find(w => w.id === exercise.exerciseId);
    return workout?.name || exercise.exerciseId;
  }, []);

  const excludeIds = useMemo(() => exercises.map(e => e.exerciseId), [exercises]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <RNView style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <IconButton icon="close" onPress={handleClose} />
            <Text variant="title" weight="semiBold" tone="primary">
              {routine ? 'Edit Routine' : programId ? 'New Day' : 'New Routine'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving} hitSlop={8}>
              <Text variant="emphasis" weight="semiBold" style={isSaving && { opacity: 0.5 }}>
                Save
              </Text>
            </TouchableOpacity>
          </RNView>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <SectionLabel>Routine Name</SectionLabel>
            <TextInput
              style={[styles.textInput, { backgroundColor: currentTheme.colors.surface, color: currentTheme.colors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Push Day, Leg Day"
              placeholderTextColor={ink.faint}
            />

            <SectionLabel style={styles.exercisesLabel}>Exercises</SectionLabel>

            {exercises.map((exercise, exerciseIndex) => (
              <View key={`${exercise.exerciseId}-${exerciseIndex}`} style={[styles.exerciseCard, { backgroundColor: currentTheme.colors.surface }]}>
                <RNView style={styles.exerciseCardHeader}>
                  <Text variant="body" weight="medium" tone="primary" style={styles.exerciseCardName}>
                    {getExerciseName(exercise)}
                  </Text>
                  <IconButton
                    icon="trash-outline"
                    onPress={() => handleRemoveExercise(exerciseIndex)}
                    iconColor={ink.muted}
                  />
                </RNView>

                <RNView style={styles.setsContainer}>
                  {exercise.sets.map((set, setIndex) => (
                    <RNView
                      key={setIndex}
                      style={[
                        styles.setRow,
                        { borderBottomColor: currentTheme.colors.border },
                        setIndex === exercise.sets.length - 1 && { borderBottomWidth: 0 }
                      ]}
                    >
                      <RNView style={styles.setLabelContainer}>
                        <Text variant="meta" tone="muted" style={styles.setLabel}>
                          {setIndex + 1}
                        </Text>
                        {set.isWarmup && (
                          <RNView style={[styles.warmupBadge, { backgroundColor: tint(currentTheme.colors.primary) }]}>
                            <Text weight="medium" style={styles.warmupBadgeText}>
                              W
                            </Text>
                          </RNView>
                        )}
                      </RNView>

                      {/* Compact 32pt geometry in the dense set row; hitSlop restores ≥44pt target. */}
                      <TouchableOpacity
                        style={[
                          styles.warmupToggle,
                          { backgroundColor: set.isWarmup ? tint(currentTheme.colors.primary) : currentTheme.colors.background }
                        ]}
                        onPress={() => handleUpdateSet(exerciseIndex, setIndex, { isWarmup: !set.isWarmup })}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={set.isWarmup ? 'flame' : 'flame-outline'}
                          size={16}
                          color={set.isWarmup ? currentTheme.colors.primary : ink.faint}
                        />
                      </TouchableOpacity>

                      {/* Steppers keep 28pt geometry (dense row); hitSlop widens the target. */}
                      <RNView style={styles.repsControl}>
                        <TouchableOpacity
                          style={[styles.smallButton, { backgroundColor: currentTheme.colors.background }]}
                          onPress={() => handleUpdateSet(exerciseIndex, setIndex, { reps: Math.max(1, set.reps - 1) })}
                          hitSlop={8}
                        >
                          <Ionicons name="remove" size={14} color={currentTheme.colors.text} />
                        </TouchableOpacity>
                        <Text variant="body" weight="semiBold" tone="primary" style={styles.repsValue}>
                          {set.reps}
                        </Text>
                        <TouchableOpacity
                          style={[styles.smallButton, { backgroundColor: currentTheme.colors.background }]}
                          onPress={() => handleUpdateSet(exerciseIndex, setIndex, { reps: set.reps + 1 })}
                          hitSlop={8}
                        >
                          <Ionicons name="add" size={14} color={currentTheme.colors.text} />
                        </TouchableOpacity>
                      </RNView>

                      <TouchableOpacity
                        style={[styles.removeSetButton, { opacity: exercise.sets.length > 1 ? 1 : 0.3 }]}
                        onPress={() => handleRemoveSet(exerciseIndex, setIndex)}
                        disabled={exercise.sets.length <= 1}
                        hitSlop={8}
                      >
                        <Ionicons name="close" size={16} color={ink.faint} />
                      </TouchableOpacity>
                    </RNView>
                  ))}
                </RNView>

                <RNView style={styles.addSetRow}>
                  <TouchableOpacity
                    style={[styles.addSetButton, { backgroundColor: currentTheme.colors.background }]}
                    onPress={() => handleAddSet(exerciseIndex, false)}
                  >
                    <Ionicons name="add" size={16} color={currentTheme.colors.text} />
                    <Text variant="meta" weight="medium" tone="primary">
                      Set
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addSetButton, { backgroundColor: tint(currentTheme.colors.primary) }]}
                    onPress={() => handleAddSet(exerciseIndex, true)}
                  >
                    <Ionicons name="flame-outline" size={16} color={currentTheme.colors.primary} />
                    <Text variant="meta" weight="medium">
                      Warmup
                    </Text>
                  </TouchableOpacity>
                </RNView>
              </View>
            ))}

            {/* C1 primary CTA with icon+label, hand-pilled */}
            <TouchableOpacity
              style={[styles.addExerciseButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => setShowExercisePicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text variant="body" weight="semiBold" style={styles.addExerciseText}>
                Add Exercise
              </Text>
            </TouchableOpacity>

            <RNView style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ExercisePicker
        visible={showExercisePicker}
        onSelect={handleAddExercises}
        onClose={() => setShowExercisePicker(false)}
        excludeIds={excludeIds}
        customExercises={customExercises}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    padding: screenGutter,
  },
  exercisesLabel: {
    marginTop: space.lg,
  },
  textInput: {
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    fontSize: type.body,
    marginBottom: space.lg,
  },
  exerciseCard: {
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  exerciseCardName: {
    flex: 1,
  },
  setsContainer: {
    marginTop: space.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  setLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    gap: space.xs,
  },
  setLabel: {
    width: 18,
  },
  warmupBadge: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Named exception: micro-glyph in a fixed 18pt badge — the 14pt floor doesn't fit.
  warmupBadgeText: {
    fontSize: 10,
  },
  warmupToggle: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repsControl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  smallButton: {
    width: 28,
    height: 28,
    borderRadius: radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repsValue: {
    minWidth: 28,
    textAlign: 'center',
  },
  removeSetButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  addSetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.control,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.pill,
  },
  addExerciseText: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    height: 44,
    borderRadius: radius.control,
    marginHorizontal: screenGutter,
    marginVertical: space.md,
  },
  searchInput: {
    flex: 1,
    fontSize: type.body,
    paddingVertical: 0,
  },
  exerciseList: {
    paddingHorizontal: screenGutter,
    paddingBottom: 40,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseItemContent: {
    flex: 1,
  },
  exerciseName: {
    marginBottom: 2,
  },
});

export default RoutineEditorModal;
