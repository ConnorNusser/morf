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
import ExerciseOptionsModal from '../inputs/ExerciseOptionsModal';
import BrowseWorkoutsModal from './BrowseWorkoutsModal';
import ExerciseSelectionModal from './ExerciseSelectionModal';
import WorkoutEditModal from './WorkoutEditModal';

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
  const [isExerciseOptionsModalVisible, setIsExerciseOptionsModalVisible] = useState(false);
  const [isWorkoutEditModalVisible, setIsWorkoutEditModalVisible] = useState(false);
  const [isImportWorkoutModalVisible, setIsImportWorkoutModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<GeneratedWorkout | null>(null);
  const [editingExerciseData, setEditingExerciseData] = useState<{
    workoutId: string;
    exerciseId: string;
    currentSets: number;
    currentReps: string;
    exerciseName: string;
  } | null>(null);

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

  const handleEditExercise = (workoutId: string, exerciseId: string, currentSets: number, currentReps: string) => {
    const exerciseName = getWorkoutById(exerciseId)?.name || exerciseId;
    setEditingExerciseData({ 
      workoutId, 
      exerciseId, 
      currentSets, 
      currentReps, 
      exerciseName 
    });
    setIsExerciseOptionsModalVisible(true);
  };

  const handleSaveEditedExercise = async (options: { sets: number; reps: string; weight?: string }) => {
    if (!currentRoutine || !editingExerciseData) return;

    try {
      const updatedWorkouts = currentRoutine.exercises.map((workout: GeneratedWorkout) => {
        if (workout.id === editingExerciseData.workoutId) {
          return {
            ...workout,
            exercises: workout.exercises.map((exercise: any) => {
              if (exercise.id === editingExerciseData.exerciseId) {
                return {
                  ...exercise,
                  sets: options.sets,
                  reps: options.reps
                };
              }
              return exercise;
            })
          };
        }
        return workout;
      });

      const updatedRoutine = {
        ...currentRoutine,
        exercises: updatedWorkouts
      };

      await updateRoutineWithLoading(updatedRoutine);
      setEditingExerciseData(null);
      setIsExerciseOptionsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update exercise');
    }
  };

  const handleAddExercise = () => {
    setIsExerciseSelectionModalVisible(true);
  };

  const handleImportWorkout = async (workoutToImport: GeneratedWorkout) => {
    if (!currentRoutine) {
      Alert.alert('Error', 'No routine selected');
      return;
    }

    try {
      const currentDayName = getDayNameInternal(selectedDay);
      if (!currentDayName) {
        Alert.alert('Error', 'Invalid day selected');
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
    } catch (error) {
      Alert.alert('Error', 'Failed to import workout');
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

  const handleDeleteExercise = async (workoutId: string, exerciseId: string) => {
    if (!currentRoutine) return;

    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedWorkouts = currentRoutine.exercises.map((workout: GeneratedWorkout) => {
                if (workout.id === workoutId) {
                  return {
                    ...workout,
                    exercises: workout.exercises.filter((ex: any) => ex.id !== exerciseId)
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
          }
        }
      ]
    );
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

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!currentRoutine) return;

    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this entire workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedWorkouts = currentRoutine.exercises.filter((workout: GeneratedWorkout) => workout.id !== workoutId);

              const updatedRoutine = {
                ...currentRoutine,
                exercises: updatedWorkouts
              };

              await updateRoutineWithLoading(updatedRoutine);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete workout');
            }
          }
        }
      ]
    );
  };

  const workoutsForDay = getWorkoutsForDay();

  return (
    <View style={[styles.container]}>
      {/* Weekly Day Selector */}
      <View style={[styles.weeklySelector, { backgroundColor: 'transparent' }]}>
        {DAY_NAMES_SHORT.map((day, index) => (
          <TouchableOpacity
            key={day}
            onPress={() => handleDayChange(index)}
            style={[
              styles.weekdayButton,
              {
                backgroundColor: selectedDay === index 
                  ? currentTheme.colors.primary
                  : currentTheme.colors.surface,
                borderColor: selectedDay === index 
                  ? currentTheme.colors.primary
                  : currentTheme.colors.border,
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
            {/* Workout indicator dot */}
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
                {/* Workout Header */}
                <View style={[styles.workoutHeader, { backgroundColor: currentTheme.colors.surface }]}>
                  <View style={styles.workoutInfo}>
                    <Text style={[styles.workoutTitle, { 
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_700Bold',
                    }]}>
                      {workout.title}
                    </Text>
                  </View>
                  
                  <View style={styles.workoutActions}>
                    <TouchableOpacity
                      onPress={() => handleEditWorkout(workout)}
                      style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '40' }]}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="pencil" size={18} color={currentTheme.colors.text} style={{ opacity: 0.7 }} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteWorkout(workout.id)}
                      style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '40' }]}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="remove-circle-outline" size={18} color={currentTheme.colors.text} style={{ opacity: 0.7 }} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Exercises List */}
                <View>
                  {workout.exercises && workout.exercises.map((exercise, exerciseIndex) => {
                    if (!exercise || !exercise.id) return null;
                    
                    const exerciseDetails = getWorkoutById(exercise.id);
                    const exerciseName = exerciseDetails?.name || `Unknown Exercise (${exercise.id})`;
                    
                    if (!exercise.sets || !exercise.reps) {
                      return null;
                    }
                    
                    return (
                      <View
                        key={exercise.id || exerciseIndex}
                        style={[
                          styles.exerciseItem,
                          { 
                            backgroundColor: exerciseIndex % 2 === 0 
                              ? 'transparent' 
                              : currentTheme.colors.surface + '30'
                          }
                        ]}
                      >
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
                            onPress={() => handleEditExercise(workout.id, exercise.id, exercise.sets, exercise.reps)}
                            style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '40' }]}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="pencil" size={18} color={currentTheme.colors.text} style={{ opacity: 0.6 }} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteExercise(workout.id, exercise.id)}
                            style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '40' }]}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="remove-circle-outline" size={18} color={currentTheme.colors.text} style={{ opacity: 0.6 }} />
                          </TouchableOpacity>
                        </View>
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

      {/* Exercise Options Modal for Editing */}
      {editingExerciseData && (
        <ExerciseOptionsModal
          visible={isExerciseOptionsModalVisible}
          onClose={() => {
            setIsExerciseOptionsModalVisible(false);
            setEditingExerciseData(null);
          }}
          onSave={handleSaveEditedExercise}
          title={`Edit ${editingExerciseData.exerciseName}`}
          initialValues={{
            sets: editingExerciseData.currentSets,
            reps: editingExerciseData.currentReps,
            weight: ''
          }}
          primaryButtonText="Update Exercise"
          showWeight={false}
        />
      )}

      {/* Workout Edit Modal */}
      <WorkoutEditModal
        visible={isWorkoutEditModalVisible}
        onClose={() => {
          setIsWorkoutEditModalVisible(false);
          setEditingWorkout(null);
        }}
        onSave={handleSaveWorkout}
        workout={editingWorkout}
      />

      {/* Import Workout Modal */}
      <BrowseWorkoutsModal
        visible={isImportWorkoutModalVisible}
        onClose={() => setIsImportWorkoutModalVisible(false)}
        mode="import"
        onImportWorkout={handleImportWorkout}
        title="Import Workout"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 0,
  },
  weeklySelector: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 6,
    paddingHorizontal: 0,
  },
  weekdayButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: '600',
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
    marginTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 12,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  workoutGroup: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 0,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  workoutInfo: {
    flex: 1,
    marginRight: 12,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  workoutDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 4,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  exerciseDetails: {
    fontSize: 13,
    marginBottom: 0,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 30,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutSeparator: {
    height: 8,
    backgroundColor: 'transparent',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 16,
  },
}); 