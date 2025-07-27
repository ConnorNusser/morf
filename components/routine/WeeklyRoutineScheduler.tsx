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
                {/* Workout Header */}
                <View style={[styles.workoutHeader, { backgroundColor: currentTheme.colors.surface }]}>
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
                      {workout.exercises?.length || 0} exercises • {workout.description}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => handleEditWorkout(workout)}
                    style={[styles.editWorkoutButton, { backgroundColor: currentTheme.colors.primary }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil" size={16} color={currentTheme.colors.background} />
                  </TouchableOpacity>
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
                              : currentTheme.colors.surface + '60'
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
                          <View style={[styles.statBox, { backgroundColor: currentTheme.colors.surface }]}>
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
                          </View>
                          
                          <View style={[styles.statBox, { backgroundColor: currentTheme.colors.surface }]}>
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
                          </View>
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
        title="Edit Workout"
        saveButtonText="Save Changes"
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
    marginBottom: 24,
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
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  workoutInfo: {
    flex: 1,
    marginRight: 16,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 4,
  },
  workoutMeta: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 18,
  },
  editWorkoutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    marginTop: -2,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 52,
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
    marginBottom: 2,
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
  workoutSeparator: {
    height: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 32,
    opacity: 0.3,
  },
}); 