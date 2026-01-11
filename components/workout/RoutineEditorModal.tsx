import { useAlert } from '@/components/CustomAlert';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage/storage';
import { ALL_WORKOUTS } from '@/lib/workout/workouts';
import { Routine, RoutineExercise, RoutineSet, Workout } from '@/types';
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
  onClose: () => void;
  onSave: () => void;
}

interface ExercisePickerProps {
  visible: boolean;
  onSelect: (exercises: Workout[]) => void;
  onClose: () => void;
  excludeIds?: string[];
}

// Exercise Picker Modal Component (Multi-select)
const ExercisePicker: React.FC<ExercisePickerProps> = ({
  visible,
  onSelect,
  onClose,
  excludeIds = [],
}) => {
  const { currentTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [visible]);

  // Filter out already added exercises
  const allExercises = useMemo(() => {
    return ALL_WORKOUTS.filter(e => !excludeIds.includes(e.id));
  }, [excludeIds]);

  // Filter exercises based on search
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
    const selectedExercises = ALL_WORKOUTS.filter(e => selectedIds.has(e.id));
    onSelect(selectedExercises);
    onClose();
  }, [selectedIds, onSelect, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
        <RNView style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
            Add Exercises
          </Text>
          <TouchableOpacity onPress={handleDone} disabled={selectedIds.size === 0}>
            <Text style={[
              styles.saveButton,
              { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold },
              selectedIds.size === 0 && { opacity: 0.4 }
            ]}>
              Add{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Text>
          </TouchableOpacity>
        </RNView>

        <RNView style={[styles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
          <Ionicons name="search" size={18} color={currentTheme.colors.text + '50'} />
          <TextInput
            style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}
            placeholder="Search exercises..."
            placeholderTextColor={currentTheme.colors.text + '40'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={currentTheme.colors.text + '40'} />
            </TouchableOpacity>
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
                    backgroundColor: isSelected ? currentTheme.colors.primary + '12' : 'transparent',
                    borderLeftWidth: isSelected ? 3 : 0,
                    borderLeftColor: currentTheme.colors.primary,
                  }
                ]}
                onPress={() => toggleSelection(item.id)}
                activeOpacity={0.6}
              >
                <RNView style={styles.exerciseItemContent}>
                  <Text style={[
                    styles.exerciseName,
                    { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }
                  ]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.exerciseMuscles, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                    {item.primaryMuscles.join(', ')}
                  </Text>
                </RNView>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSelected ? currentTheme.colors.primary : currentTheme.colors.text + '30'}
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

// Main Routine Editor Modal
const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
  visible,
  routine,
  onClose,
  onSave,
}) => {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  // Reset state when modal opens
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

  const handleAddExercises = useCallback((workouts: Workout[]) => {
    const newExercises: RoutineExercise[] = workouts.map(workout => ({
      exerciseId: workout.id,
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
        id: routine?.id || `routine_${Date.now()}`,
        name: name.trim(),
        exercises,
        createdAt: routine?.createdAt || new Date(),
        lastUsed: routine?.lastUsed,
      };

      await storageService.saveRoutine(routineToSave);
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
  }, [name, exercises, routine, onSave, onClose, showAlert]);

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

  // Get exercise name from ID
  const getExerciseName = useCallback((exerciseId: string) => {
    const exercise = ALL_WORKOUTS.find(w => w.id === exerciseId);
    return exercise?.name || exerciseId;
  }, []);

  const excludeIds = useMemo(() => exercises.map(e => e.exerciseId), [exercises]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <RNView style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={28} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              {routine ? 'Edit Routine' : 'New Routine'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              <Text style={[
                styles.saveButton,
                { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold },
                isSaving && { opacity: 0.5 }
              ]}>
                Save
              </Text>
            </TouchableOpacity>
          </RNView>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Name Input */}
            <Text style={[styles.label, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.medium }]}>
              Routine Name
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: currentTheme.colors.surface, color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Push Day, Leg Day"
              placeholderTextColor={currentTheme.colors.text + '40'}
            />

            {/* Exercises */}
            <Text style={[styles.label, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.medium, marginTop: 16 }]}>
              Exercises
            </Text>

            {exercises.map((exercise, exerciseIndex) => (
              <View key={`${exercise.exerciseId}-${exerciseIndex}`} style={[styles.exerciseCard, { backgroundColor: currentTheme.colors.surface }]}>
                <RNView style={styles.exerciseCardHeader}>
                  <Text style={[styles.exerciseCardName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                    {getExerciseName(exercise.exerciseId)}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveExercise(exerciseIndex)}>
                    <Ionicons name="trash-outline" size={20} color={currentTheme.colors.text + '60'} />
                  </TouchableOpacity>
                </RNView>

                {/* Individual Sets */}
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
                      {/* Set number and warmup badge */}
                      <RNView style={styles.setLabelContainer}>
                        <Text style={[styles.setLabel, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                          {setIndex + 1}
                        </Text>
                        {set.isWarmup && (
                          <RNView style={[styles.warmupBadge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                            <Text style={[styles.warmupBadgeText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
                              W
                            </Text>
                          </RNView>
                        )}
                      </RNView>

                      {/* Warmup toggle */}
                      <TouchableOpacity
                        style={[
                          styles.warmupToggle,
                          { backgroundColor: set.isWarmup ? currentTheme.colors.primary + '15' : currentTheme.colors.background }
                        ]}
                        onPress={() => handleUpdateSet(exerciseIndex, setIndex, { isWarmup: !set.isWarmup })}
                      >
                        <Ionicons
                          name={set.isWarmup ? 'flame' : 'flame-outline'}
                          size={16}
                          color={set.isWarmup ? currentTheme.colors.primary : currentTheme.colors.text + '40'}
                        />
                      </TouchableOpacity>

                      {/* Reps control */}
                      <RNView style={styles.repsControl}>
                        <TouchableOpacity
                          style={[styles.smallButton, { backgroundColor: currentTheme.colors.background }]}
                          onPress={() => handleUpdateSet(exerciseIndex, setIndex, { reps: Math.max(1, set.reps - 1) })}
                        >
                          <Ionicons name="remove" size={14} color={currentTheme.colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.repsValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                          {set.reps}
                        </Text>
                        <TouchableOpacity
                          style={[styles.smallButton, { backgroundColor: currentTheme.colors.background }]}
                          onPress={() => handleUpdateSet(exerciseIndex, setIndex, { reps: set.reps + 1 })}
                        >
                          <Ionicons name="add" size={14} color={currentTheme.colors.text} />
                        </TouchableOpacity>
                      </RNView>

                      {/* Remove set button */}
                      <TouchableOpacity
                        style={[styles.removeSetButton, { opacity: exercise.sets.length > 1 ? 1 : 0.3 }]}
                        onPress={() => handleRemoveSet(exerciseIndex, setIndex)}
                        disabled={exercise.sets.length <= 1}
                      >
                        <Ionicons name="close" size={16} color={currentTheme.colors.text + '50'} />
                      </TouchableOpacity>
                    </RNView>
                  ))}
                </RNView>

                {/* Add set buttons */}
                <RNView style={styles.addSetRow}>
                  <TouchableOpacity
                    style={[styles.addSetButton, { backgroundColor: currentTheme.colors.background }]}
                    onPress={() => handleAddSet(exerciseIndex, false)}
                  >
                    <Ionicons name="add" size={16} color={currentTheme.colors.text} />
                    <Text style={[styles.addSetText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                      Set
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addSetButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
                    onPress={() => handleAddSet(exerciseIndex, true)}
                  >
                    <Ionicons name="flame-outline" size={16} color={currentTheme.colors.primary} />
                    <Text style={[styles.addSetText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
                      Warmup
                    </Text>
                  </TouchableOpacity>
                </RNView>
              </View>
            ))}

            {/* Add Exercise Button */}
            <TouchableOpacity
              style={[styles.addExerciseButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => setShowExercisePicker(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={[styles.addExerciseText, { color: '#fff', fontFamily: currentTheme.fonts.semiBold }]}>
                Add Exercise
              </Text>
            </TouchableOpacity>

            <RNView style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Exercise Picker Modal */}
      <ExercisePicker
        visible={showExercisePicker}
        onSelect={handleAddExercises}
        onClose={() => setShowExercisePicker(false)}
        excludeIds={excludeIds}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
  },
  saveButton: {
    fontSize: 17,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  exerciseCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exerciseCardName: {
    fontSize: 16,
    flex: 1,
  },
  setsContainer: {
    marginTop: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  setLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    gap: 4,
  },
  setLabel: {
    fontSize: 14,
    width: 18,
  },
  warmupBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupBadgeText: {
    fontSize: 10,
  },
  warmupToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repsControl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  smallButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repsValue: {
    fontSize: 16,
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
    gap: 8,
    marginTop: 12,
  },
  addSetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addSetText: {
    fontSize: 13,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addExerciseText: {
    fontSize: 15,
  },
  // Exercise Picker styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  exerciseList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseItemContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    marginBottom: 2,
  },
  exerciseMuscles: {
    fontSize: 13,
  },
});

export default RoutineEditorModal;
