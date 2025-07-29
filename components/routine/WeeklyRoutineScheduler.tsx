import { useRoutine } from '@/contexts/RoutineContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  capitalizeDayName,
  DAY_NAMES_SHORT,
  getCurrentDayIndex,
  getDayName,
  getDayNameInternal,
  validateDayIndex
} from '@/lib/day';
import { getWorkoutById } from '@/lib/workouts';
import { GeneratedWorkout, Workout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../Button';
import DirectNumberInput from '../inputs/DirectNumberInput';
import ExerciseSelectionModal from './ExerciseSelectionModal';
import UnifiedWorkoutBrowserModal from './UnifiedWorkoutBrowserModal';
import UnifiedWorkoutEditorModal from './UnifiedWorkoutEditorModal';

interface WeeklyRoutineSchedulerProps {
  onSelectedDayChange?: (day: number, dayName: string) => void;
}

export default function WeeklyRoutineScheduler({ 
  onSelectedDayChange
}: WeeklyRoutineSchedulerProps) {
  const { currentTheme } = useTheme();
  const { currentRoutine, updateRoutine } = useRoutine();
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [selectedDay, setSelectedDay] = useState(getCurrentDayIndex());
  const [isExerciseSelectionModalVisible, setIsExerciseSelectionModalVisible] = useState(false);
  const [isWorkoutEditModalVisible, setIsWorkoutEditModalVisible] = useState(false);
  const [isImportWorkoutModalVisible, setIsImportWorkoutModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<GeneratedWorkout | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{workoutId: string; exerciseId: string; type: 'sets' | 'reps'; currentValue: string | number} | null>(null);

  useEffect(() => {
    const newDay = getCurrentDayIndex();
    if (newDay >= 0 && newDay <= 6) {
      setSelectedDay(newDay);
      if (onSelectedDayChange) {
        onSelectedDayChange(newDay, getDayName(newDay));
      }
    } else {
      setSelectedDay(0);
      if (onSelectedDayChange) {
        onSelectedDayChange(0, getDayName(0));
      }
    }
  }, [currentRoutine?.id]);

  if (isUpdating || !currentRoutine) {
    return <View style={styles.container} />;
  }

  const updateRoutineWithLoading = async (updatedRoutine: any) => {
    setIsUpdating(true);
    try {
      await updateRoutine(updatedRoutine);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDayChange = (newDay: number) => {
    setSelectedDay(newDay);
    
    if (onSelectedDayChange) {
      onSelectedDayChange(newDay, getDayName(newDay));
    }
  };

  const getWorkoutsForDay = (): GeneratedWorkout[] => {
    if (!currentRoutine || !currentRoutine.exercises) return [];
    const safeSelectedDay = validateDayIndex(selectedDay);
    const currentDayName = getDayNameInternal(safeSelectedDay);
    if (!currentDayName) {
      return [];
    }
    return currentRoutine.exercises.filter((workout: GeneratedWorkout) => workout.dayOfWeek === currentDayName) || [];
  };

  const dayHasWorkouts = (dayIndex: number): boolean => {
    if (!currentRoutine || !currentRoutine.exercises) return false;
    const dayName = getDayNameInternal(dayIndex);
    if (!dayName) return false;
    return currentRoutine.exercises.some((workout: GeneratedWorkout) => workout && workout.dayOfWeek === dayName);
  };

  const handleAddExercise = () => {
    setIsExerciseSelectionModalVisible(true);
  };

  const handleImportWorkout = async (workoutToImport: GeneratedWorkout) => {
    if (!currentRoutine || isImporting) {
      if (!currentRoutine) {
        Alert.alert('Error', 'No routine selected');
      }
      return;
    }

    try {
      setIsImporting(true);
      
      const currentDayName = getDayNameInternal(selectedDay);
      if (!currentDayName) {
        Alert.alert('Error', 'Invalid day selected');
        setIsImporting(false);
        return;
      }

      const newWorkout: GeneratedWorkout = {
        ...workoutToImport,
        id: `imported-${workoutToImport.id}-${Date.now()}`,
        dayOfWeek: currentDayName,
        title: `${workoutToImport.title} (Imported)`,
        createdAt: new Date(),
        exercises: workoutToImport.exercises.map((exercise: any) => ({
          ...exercise,
          completedSets: [],
          isCompleted: false,
        }))
      };

      const updatedWorkouts = [...currentRoutine.exercises, newWorkout];

      const updatedRoutine = {
        ...currentRoutine,
        exercises: updatedWorkouts
      };

      await updateRoutineWithLoading(updatedRoutine);
      
      // Ensure import modal is closed
      setIsImportWorkoutModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to import workout');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSelectExercise = async (exercise: Workout, options: { sets: number; reps: string; weight?: string }) => {
    if (!currentRoutine) {
      Alert.alert('Error', 'No routine selected');
      return;
    }

    try {
      const newExercise = {
        id: exercise.id,
        sets: options.sets,
        reps: options.reps,
        completedSets: [],
        isCompleted: false,
      };

      const safeSelectedDay = validateDayIndex(selectedDay);
      const currentDayName = getDayNameInternal(safeSelectedDay);
      
      if (!currentDayName) {
        Alert.alert('Error', 'Invalid day selected');
        return;
      }
      
      let updatedWorkouts = [...currentRoutine.exercises];
      const existingWorkoutIndex = updatedWorkouts.findIndex(workout => workout.dayOfWeek === currentDayName);

      if (existingWorkoutIndex >= 0) {
        updatedWorkouts[existingWorkoutIndex] = {
          ...updatedWorkouts[existingWorkoutIndex],
          exercises: [...updatedWorkouts[existingWorkoutIndex].exercises, newExercise]
        };
      } else {
        const newWorkout: GeneratedWorkout = {
          id: `workout-${currentDayName}-${Date.now()}`,
          title: `${capitalizeDayName(currentDayName)} Workout`,
          description: "Custom workout",
          dayOfWeek: currentDayName,
          exercises: [newExercise],
          estimatedDuration: 60,
          difficulty: "Intermediate",
          createdAt: new Date(),
        };
        updatedWorkouts.push(newWorkout);
      }

      const updatedRoutine = {
        ...currentRoutine,
        exercises: updatedWorkouts
      };

      await updateRoutineWithLoading(updatedRoutine);
    } catch (error) {
      Alert.alert('Error', 'Failed to add exercise');
    }
  };

  const handleEditWorkout = (workout: GeneratedWorkout) => {
    setEditingWorkout(workout);
    setIsWorkoutEditModalVisible(true);
  };

  const handleSaveWorkout = async (updatedWorkoutData: Partial<GeneratedWorkout>) => {
    if (!currentRoutine || !editingWorkout) return;

    try {
      const updatedWorkouts = currentRoutine.exercises.map((workout: GeneratedWorkout) => {
        if (workout.id === editingWorkout.id) {
          return {
            ...workout,
            ...updatedWorkoutData,
          };
        }
        return workout;
      });

      const updatedRoutine = {
        ...currentRoutine,
        exercises: updatedWorkouts
      };

      await updateRoutineWithLoading(updatedRoutine);

      setEditingWorkout(null);
      setIsWorkoutEditModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update workout');
    }
  };

  const handleDeleteWorkout = async () => {
    if (!currentRoutine || !editingWorkout) return;

    try {
      const updatedWorkouts = currentRoutine.exercises.filter((workout: GeneratedWorkout) => workout.id !== editingWorkout.id);

      const updatedRoutine = {
        ...currentRoutine,
        exercises: updatedWorkouts
      };

      await updateRoutineWithLoading(updatedRoutine);
      
      setEditingWorkout(null);
      setIsWorkoutEditModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete workout');
    }
  };

  const handleDirectDeleteWorkout = async (workoutToDelete: GeneratedWorkout) => {
    if (!currentRoutine) return;

    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workoutToDelete.title}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedWorkouts = currentRoutine.exercises.filter((workout: GeneratedWorkout) => workout.id !== workoutToDelete.id);

              const updatedRoutine = {
                ...currentRoutine,
                exercises: updatedWorkouts
              };

              await updateRoutineWithLoading(updatedRoutine);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
        },
      ]
    );
  };

  const handleDeleteExercise = async (workoutId: string, exerciseId: string, exerciseName: string) => {
    if (!currentRoutine) return;

    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete "${exerciseName}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedWorkouts = currentRoutine.exercises.map((workout: GeneratedWorkout) => {
                if (workout.id === workoutId) {
                  const updatedExercises = workout.exercises.filter((exercise: any) => exercise.id !== exerciseId);
                  return {
                    ...workout,
                    exercises: updatedExercises,
                  };
                }
                return workout;
              });

              const updatedRoutine = {
                ...currentRoutine,
                exercises: updatedWorkouts
              };

              await updateRoutineWithLoading(updatedRoutine);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete exercise');
            }
          },
        },
      ]
    );
  };

  const handleEditExerciseValue = (workoutId: string, exerciseId: string, type: 'sets' | 'reps', currentValue: string | number) => {
    setEditingExercise({ workoutId, exerciseId, type, currentValue });
  };

  const handleSaveExerciseValue = (newValue: number | string) => {
    if (editingExercise) {
      updateExerciseValue(editingExercise.workoutId, editingExercise.exerciseId, editingExercise.type, newValue.toString());
      setEditingExercise(null);
    }
  };

  const handleCancelExerciseEdit = () => {
    setEditingExercise(null);
  };

  const updateExerciseValue = async (workoutId: string, exerciseId: string, type: 'sets' | 'reps', newValue: string) => {
    if (!currentRoutine) return;

    try {
      const updatedWorkouts = currentRoutine.exercises.map((workout: GeneratedWorkout) => {
        if (workout.id === workoutId) {
          const updatedExercises = workout.exercises.map((exercise: any) => {
            if (exercise.id === exerciseId) {
              return {
                ...exercise,
                [type]: type === 'sets' ? parseInt(newValue) || exercise[type] : newValue,
              };
            }
            return exercise;
          });
          
          return {
            ...workout,
            exercises: updatedExercises,
          };
        }
        return workout;
      });

      const updatedRoutine = {
        ...currentRoutine,
        exercises: updatedWorkouts
      };

      await updateRoutineWithLoading(updatedRoutine);
    } catch (error) {
      Alert.alert('Error', 'Failed to update exercise');
    }
  };

  const workoutsForDay = getWorkoutsForDay();

  return (
    <View style={styles.container}>
      {/* Weekly Day Selector */}
      <View style={[styles.weeklySelector, { 
        backgroundColor: currentTheme.colors.surface + '30',
        borderRadius: 16,
        padding: 8,
      }]}>
        <View style={styles.weekdayContainer}>
          {DAY_NAMES_SHORT.map((day, index) => (
            <TouchableOpacity
              key={day}
              onPress={() => handleDayChange(index)}
              style={[
                styles.weekdayButton,
                {
                  backgroundColor: selectedDay === index 
                    ? currentTheme.colors.primary
                    : 'transparent',
                  borderColor: selectedDay === index 
                    ? currentTheme.colors.primary 
                    : currentTheme.colors.border + '30',
                }
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.weekdayText,
                {
                  color: selectedDay === index 
                    ? currentTheme.colors.background
                    : currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                {day}
              </Text>
              {dayHasWorkouts(index) && (
                <View style={[
                  styles.workoutDot,
                  { 
                    backgroundColor: selectedDay === index 
                      ? currentTheme.colors.background
                      : currentTheme.colors.primary
                  }
                ]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Current Day Routine Builder */}
      <View style={styles.dayRoutineContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {workoutsForDay.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons 
                name="fitness-outline" 
                size={32} 
                color={currentTheme.colors.text + '40'} 
              />
              <Text style={[
                styles.emptyStateText,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                  opacity: 0.6,
                }
              ]}>
                {currentRoutine ? 'No workouts scheduled for this day' : 'Select a routine to view workouts'}
              </Text>
            </View>
          ) : (
            workoutsForDay.map((workout, workoutIndex) => (
              <View key={workout.id} style={styles.workoutGroup}>
                {/* Workout Header - Flat */}
                <View style={styles.workoutHeader}>
                  <View style={styles.workoutInfo}>
                    <Text style={[styles.workoutTitle, { 
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_700Bold',
                    }]}>
                      {workout.title}
                    </Text>
                    <Text style={[styles.workoutMeta, { 
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_400Regular',
                    }]}>
                      {workout.exercises?.length || 0} exercises
                    </Text>
                  </View>
                  
                  <View style={styles.workoutActions}>
                    <TouchableOpacity
                      onPress={() => handleEditWorkout(workout)}
                      style={[styles.actionButton, { backgroundColor: currentTheme.colors.primary }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil" size={16} color={currentTheme.colors.background} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => handleDirectDeleteWorkout(workout)}
                      style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subtle Divider */}
                <View style={[styles.workoutDivider, { backgroundColor: currentTheme.colors.border }]} />

                {/* Exercises List */}
                <View style={styles.exercisesList}>
                  {workout.exercises && workout.exercises.map((exercise, exerciseIndex) => {
                    if (!exercise || !exercise.id) return null;
                    
                    const exerciseDetails = getWorkoutById(exercise.id);
                    const exerciseName = exerciseDetails?.name || `Unknown Exercise (${exercise.id})`;
                    
                    if (!exercise.sets || !exercise.reps) {
                      return null;
                    }
                    
                    const isEditingSets = editingExercise?.workoutId === workout.id && editingExercise?.exerciseId === exercise.id && editingExercise?.type === 'sets';
                    const isEditingReps = editingExercise?.workoutId === workout.id && editingExercise?.exerciseId === exercise.id && editingExercise?.type === 'reps';
                    
                    return (
                      <View key={exercise.id || exerciseIndex}>
                        <View
                          style={[
                            styles.exerciseItem,
                            { 
                              backgroundColor: exerciseIndex % 2 === 0 
                                ? 'transparent'
                                : currentTheme.colors.surface + '20'
                            }
                          ]}
                        >
                          <View style={styles.exerciseInfo}>
                            <Text 
                              style={[styles.exerciseName, { 
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_600SemiBold',
                              }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {exerciseName}
                            </Text>
                          </View>
                          
                          <View style={styles.exerciseStats}>
                            <TouchableOpacity 
                              style={[styles.statBox, { backgroundColor: currentTheme.colors.surface }]}
                              onPress={() => handleEditExerciseValue(workout.id, exercise.id, 'sets', exercise.sets)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.statNumber, { 
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_600SemiBold',
                              }]}>
                                {exercise.sets}
                              </Text>
                              <Text style={[styles.statLabel, { 
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_400Regular',
                              }]}>
                                sets
                              </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                              style={[styles.statBox, { backgroundColor: currentTheme.colors.surface }]}
                              onPress={() => handleEditExerciseValue(workout.id, exercise.id, 'reps', exercise.reps)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.statNumber, { 
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_600SemiBold',
                              }]}>
                                {exercise.reps}
                              </Text>
                              <Text style={[styles.statLabel, { 
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_400Regular',
                              }]}>
                                reps
                              </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                              onPress={() => handleDeleteExercise(workout.id, exercise.id, exerciseName)}
                              style={[styles.exerciseDeleteButton, { backgroundColor: '#FF6B6B' }]}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="trash" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Direct editing for sets */}
                        <DirectNumberInput
                          visible={isEditingSets}
                          value={editingExercise?.currentValue || 0}
                          onClose={handleCancelExerciseEdit}
                          onChange={(value) => handleSaveExerciseValue(value)}
                          title="Enter Sets"
                          allowRange={false}
                          maxLength={2}
                        />

                        {/* Direct editing for reps */}
                        <DirectNumberInput
                          visible={isEditingReps}
                          value={editingExercise?.currentValue || 0}
                          onClose={handleCancelExerciseEdit}
                          onChange={(value) => handleSaveExerciseValue(value)}
                          title="Enter Reps (or Range)"
                          allowRange={true}
                          maxLength={5}
                        />
                      </View>
                    );
                  })}
                </View>

                {/* Add spacing between workouts */}
                {workoutIndex < workoutsForDay.length - 1 && (
                  <View style={styles.workoutSeparator} />
                )}
              </View>
            ))
          )}

          {/* Action Buttons - positioned below all exercises */}
          {currentRoutine && (
            <View style={styles.actionButtonsContainer}>
              <Button
                title="Add Exercise"
                onPress={handleAddExercise}
                variant="subtle"
                size="small"
                style={{ flex: 1 }}
                hapticType="light"
              />

              <Button
                title="Import Workout"
                onPress={() => setIsImportWorkoutModalVisible(true)}
                variant="subtle"
                size="small"
                style={{ flex: 1 }}
                hapticType="light"
              />
            </View>
          )}

          {/* Subtle divider after add exercise button */}
          <View style={[styles.sectionDivider, { backgroundColor: currentTheme.colors.border }]} />
        </ScrollView>
      </View>

      {/* Exercise Selection Modal */}
      <ExerciseSelectionModal
        visible={isExerciseSelectionModalVisible}
        onClose={() => setIsExerciseSelectionModalVisible(false)}
        onSelectExercise={handleSelectExercise}
      />

      {/* Workout Edit Modal */}
      <UnifiedWorkoutEditorModal
        visible={isWorkoutEditModalVisible}
        onClose={() => {
          setIsWorkoutEditModalVisible(false);
          setEditingWorkout(null);
        }}
        onSave={handleSaveWorkout}
        onDelete={handleDeleteWorkout}
        workout={editingWorkout}
        mode="routine-edit"
        title="Edit Routine"
        saveButtonText="Save"
        showDayOfWeekSelector={true}
      />

      {/* Import Workout Modal */}
      <UnifiedWorkoutBrowserModal
        visible={isImportWorkoutModalVisible}
        onClose={() => setIsImportWorkoutModalVisible(false)}
        onImportWorkout={handleImportWorkout}
        title="Import Workout"
        source="standalone"
        mode="import"
        showCreateNew={true}
        onCreateNew={() => {
          setIsImportWorkoutModalVisible(false);
          setEditingWorkout(null);
          setIsWorkoutEditModalVisible(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weeklySelector: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  weekdayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    gap: 4,
  },
  weekdayButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    position: 'relative',
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  workoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 6,
    right: 6,
  },
  dayRoutineContainer: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  workoutGroup: {
    marginBottom: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  workoutInfo: {
    flex: 1,
    marginRight: 16,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  workoutMeta: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 18,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  exercisesList: {
    paddingHorizontal: 0,
    paddingBottom: 4,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    minHeight: 48,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 18,
  },
  exerciseStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    minWidth: 100,
  },
  statBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
  },
  statLabel: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 1,
  },
  exerciseDeleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: 16,
  },
  workoutSeparator: {
    height: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 0,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 32,
    opacity: 0.3,
  },
  workoutDivider: {
    height: 1,
    marginVertical: 8,
    opacity: 0.3,
  },
}); 