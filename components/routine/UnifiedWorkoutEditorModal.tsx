import { useTheme } from '@/contexts/ThemeContext';
import { DAY_NAMES_INTERNAL } from '@/lib/day';
import { getWorkoutById } from '@/lib/workouts';
import { GeneratedWorkout, Workout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '../Button';
import ExerciseOptionsModal from '../inputs/ExerciseOptionsModal';
import ExerciseSelectionModal from './ExerciseSelectionModal';

export type EditMode = 'create' | 'edit' | 'routine-create' | 'routine-edit';

interface UnifiedWorkoutEditorModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (workoutData: Partial<GeneratedWorkout>) => void;
  workout: GeneratedWorkout | null;
  mode?: EditMode;
  
  // Routine-specific props
  assignToDayOfWeek?: string;
  showDayOfWeekSelector?: boolean;
  availableDays?: string[];
  
  // Customization
  title?: string;
  saveButtonText?: string;
  showCreateNewButton?: boolean;
  onCreateNew?: () => void;
  onDelete?: () => void;
}

export default function UnifiedWorkoutEditorModal({
  visible,
  onClose,
  onSave,
  workout,
  mode = 'edit',
  assignToDayOfWeek,
  showDayOfWeekSelector = false,
  availableDays = DAY_NAMES_INTERNAL as unknown as string[],
  title,
  saveButtonText,
  showCreateNewButton = false,
  onCreateNew,
  onDelete
}: UnifiedWorkoutEditorModalProps) {
  const { currentTheme } = useTheme();
  const isCreating = mode === 'create' || mode === 'routine-create';
  const isRoutineMode = mode === 'routine-create' || mode === 'routine-edit';
  
  // Form state
  const [workoutTitle, setWorkoutTitle] = useState(() => workout?.title || '');
  const [description, setDescription] = useState(() => workout?.description || '');
  const [exercises, setExercises] = useState(() => workout?.exercises || []);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(() => assignToDayOfWeek || workout?.dayOfWeek || '');
  
  // Calculate estimated duration: total sets × 3 minutes per set
  const estimatedDuration = exercises.reduce((total, exercise) => total + (exercise?.sets || 0), 0) * 3;
  
  // Modal states
  const [isExerciseSelectionModalVisible, setIsExerciseSelectionModalVisible] = useState(false);
  const [isExerciseOptionsModalVisible, setIsExerciseOptionsModalVisible] = useState(false);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);

  // Update form state when workout prop changes
  React.useEffect(() => {
    if (workout) {
      setWorkoutTitle(workout.title || '');
      setDescription(workout.description || '');
      setExercises(workout.exercises || []);
      setSelectedDayOfWeek(assignToDayOfWeek || workout.dayOfWeek || '');
    } else {
      // Reset form for new workout
      setWorkoutTitle('');
      setDescription('');
      setExercises([]);
      setSelectedDayOfWeek(assignToDayOfWeek || '');
    }
  }, [workout?.id, assignToDayOfWeek]); // Only depend on workout ID to avoid infinite updates

  const getModalTitle = () => {
    if (title) return title;
    
    if (isCreating) {
      return isRoutineMode ? 'Create Routine Workout' : 'Create Workout';
    } else {
      return isRoutineMode ? 'Edit Routine Workout' : 'Edit Workout';
    }
  };

  const getSaveButtonText = () => {
    if (saveButtonText) return saveButtonText;
    return isCreating ? 'Create' : 'Save';
  };

  const handleSave = () => {
    if (!workoutTitle.trim()) {
      Alert.alert('Error', 'Please enter a workout title');
      return;
    }

    const workoutData: Partial<GeneratedWorkout> = {
      title: workoutTitle.trim(),
      description: description.trim(),
      estimatedDuration: estimatedDuration || 45,
      exercises,
      ...(isRoutineMode && selectedDayOfWeek && { dayOfWeek: selectedDayOfWeek as any }),
      ...(isCreating && { 
        id: Date.now().toString(),
        createdAt: new Date(),
        difficulty: 'intermediate'
      })
    };

    onSave(workoutData);
  };

  const handleAddExercise = () => {
    setIsExerciseSelectionModalVisible(true);
  };

  const handleSelectExercise = (exercise: Workout, options: { sets: number; reps: string; weight?: string }) => {
    const newExercise = {
      id: exercise.id,
      sets: options.sets,
      reps: options.reps,
      completedSets: [],
      isCompleted: false,
    };

    setExercises(prev => [...prev, newExercise]);
    setIsExerciseSelectionModalVisible(false);
  };

  const handleEditExercise = (index: number) => {
    setEditingExerciseIndex(index);
    setIsExerciseOptionsModalVisible(true);
  };

  const handleSaveEditedExercise = (options: { sets: number; reps: string; weight?: string }) => {
    if (editingExerciseIndex === null) return;

    setExercises(prev => prev.map((exercise, index) => {
      if (index === editingExerciseIndex) {
        return {
          ...exercise,
          sets: options.sets,
          reps: options.reps
        };
      }
      return exercise;
    }));

    setEditingExerciseIndex(null);
    setIsExerciseOptionsModalVisible(false);
  };

  const handleDeleteExercise = (index: number) => {
    const exercise = exercises[index];
    const exerciseName = getWorkoutById(exercise.id)?.name || 'this exercise';
    
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to remove ${exerciseName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setExercises(prev => prev.filter((_, i) => i !== index));
          }
        }
      ]
    );
  };

  const handleMoveExercise = (fromIndex: number, toIndex: number) => {
    setExercises(prev => {
      const newExercises = [...prev];
      const [movedExercise] = newExercises.splice(fromIndex, 1);
      newExercises.splice(toIndex, 0, movedExercise);
      return newExercises;
    });
  };

  const currentEditingExercise = editingExerciseIndex !== null ? exercises[editingExerciseIndex] : null;
  const currentEditingExerciseName = currentEditingExercise ? 
    getWorkoutById(currentEditingExercise.id)?.name || currentEditingExercise.id : '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { 
          borderBottomColor: currentTheme.colors.border,
          backgroundColor: currentTheme.colors.background,
        }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          
          {!isCreating && (
            <Text style={[styles.headerTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_700Bold',
            }]}>
              {getModalTitle()}
            </Text>
          )}
          {isCreating && <View style={styles.headerSpacer} />}
          
          {showCreateNewButton && onCreateNew ? (
            <TouchableOpacity onPress={onCreateNew} style={styles.createNewButton}>
              <Ionicons name="add" size={24} color={currentTheme.colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.saveButtonContainer}>
              <Button
                title={getSaveButtonText()}
                onPress={handleSave}
                variant="primary"
                size="small"
                hapticType="light"
              />
            </View>
          )}
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Basic Info Section */}
          <View style={[styles.section, { backgroundColor: currentTheme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Workout Details
            </Text>
            
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }]}>
                Title *
              </Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: currentTheme.colors.background,
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                }]}
                placeholder="Enter workout name"
                placeholderTextColor={currentTheme.colors.text + '60'}
                value={workoutTitle}
                onChangeText={setWorkoutTitle}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }]}>
                Description
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { 
                  backgroundColor: currentTheme.colors.background,
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                }]}
                placeholder="Describe this workout (optional)"
                placeholderTextColor={currentTheme.colors.text + '60'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Duration */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }]}>
                Estimated Duration (auto-calculated)
              </Text>
              <Text style={{ 
                color: currentTheme.colors.text + '70',
                fontFamily: 'Raleway_400Regular',
                fontSize: 12,
                marginBottom: 8,
              }}>
                3 minutes per set across all exercises
              </Text>
              <TextInput
                style={[styles.textInput, styles.numberInput, { 
                  backgroundColor: currentTheme.colors.background,
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                }]}
                placeholder="0"
                placeholderTextColor={currentTheme.colors.text + '60'}
                value={estimatedDuration.toString()}
                editable={false}
                keyboardType="numeric"
              />
            </View>

            {/* Day of Week Selector for Routine Mode */}
            {showDayOfWeekSelector && isRoutineMode && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }]}>
                  Day of Week
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.daySelector}>
                    {availableDays.map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayButton,
                          {
                            backgroundColor: selectedDayOfWeek === day 
                              ? currentTheme.colors.primary 
                              : currentTheme.colors.background,
                            borderColor: currentTheme.colors.border,
                          }
                        ]}
                        onPress={() => setSelectedDayOfWeek(day)}
                      >
                        <Text style={[
                          styles.dayButtonText,
                          {
                            color: selectedDayOfWeek === day 
                              ? currentTheme.colors.background 
                              : currentTheme.colors.text,
                            fontFamily: 'Raleway_500Medium',
                          }
                        ]}>
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {onDelete && !isCreating && (
                <Button
                  title="Delete Workout"
                  onPress={onDelete}
                  variant="subtle"
                  size="medium"
                  hapticType="light"
                  style={styles.fullWidthButton}
                />
              )}
          </View>

          {/* Exercises Section */}
          <View style={[styles.section, { backgroundColor: currentTheme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Exercises ({exercises.length})
            </Text>

            {exercises.length === 0 ? (
              <View style={styles.emptyExercises}>
                <Ionicons name="fitness-outline" size={32} color={currentTheme.colors.text + '40'} />
                <Text style={[styles.emptyText, { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                  opacity: 0.6,
                }]}>
                  No exercises added yet
                </Text>
                <Text style={[styles.emptySubtext, { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                  opacity: 0.5,
                }]}>
                  Tap "Add Exercise" to get started
                </Text>
              </View>
            ) : (
              <View style={styles.exercisesList}>
                {exercises.map((exercise, index) => {
                  if (!exercise || !exercise.id) return null;
                  
                  const exerciseDetails = getWorkoutById(exercise.id);
                  const exerciseName = exerciseDetails?.name || `Unknown Exercise (${exercise.id})`;
                  
                  return (
                    <View key={`${exercise.id}-${index}`} style={[styles.exerciseItem, { 
                      backgroundColor: index % 2 === 0 
                        ? 'transparent' 
                        : currentTheme.colors.background + '50'
                    }]}>
                      <View style={styles.exerciseInfo}>
                        <Text style={[styles.exerciseName, { 
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_600SemiBold',
                        }]}>
                          {exerciseName}
                        </Text>
                        
                        <Text style={[styles.exerciseDetails, { 
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_500Medium',
                          opacity: 0.8,
                        }]}>
                          {exercise.sets} sets × {exercise.reps} reps
                        </Text>
                      </View>
                      
                      <View style={styles.exerciseActions}>
                        <TouchableOpacity
                          onPress={() => handleEditExercise(index)}
                          style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '60' }]}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="create-outline" size={20} color={currentTheme.colors.text} style={{ opacity: 0.6 }} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteExercise(index)}
                          style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '60' }]}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="remove-outline" size={20} color={currentTheme.colors.text} style={{ opacity: 0.6 }} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={styles.exerciseActions}> 
              <Button
                title="Add Exercise"
                onPress={handleAddExercise}
                variant="primary"
                size="medium"
                hapticType="light"
                style={styles.fullWidthButton}
              />
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Modals */}
      <ExerciseSelectionModal
        visible={isExerciseSelectionModalVisible}
        onClose={() => setIsExerciseSelectionModalVisible(false)}
        onSelectExercise={handleSelectExercise}
      />

      {currentEditingExercise && (
        <ExerciseOptionsModal
          visible={isExerciseOptionsModalVisible}
          onClose={() => {
            setIsExerciseOptionsModalVisible(false);
            setEditingExerciseIndex(null);
          }}
          onSave={handleSaveEditedExercise}
          title={`Edit ${currentEditingExerciseName}`}
          initialValues={{
            sets: currentEditingExercise.sets,
            reps: currentEditingExercise.reps,
            weight: ''
          }}
          primaryButtonText="Update Exercise"
          showWeight={false}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    flex: 1,
  },
  saveButton: {
    padding: 8,
    marginRight: -8,
  },
  saveButtonContainer: {
    marginRight: -8,
  },
  createNewButton: {
    padding: 8,
    marginRight: -8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  fullWidthButton: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  numberInput: {
    width: 100,
  },
  daySelector: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyExercises: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  exercisesList: {
    gap: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseDetails: {
    fontSize: 11,
  },

  actionButton: {
    padding: 6,
    borderRadius: 4,
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 