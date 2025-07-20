import { useTheme } from '@/contexts/ThemeContext';
import exercisesData from '@/lib/exercises.json';
import { GeneratedWorkout } from '@/types';
import React from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface PreviousWorkoutDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  workout: GeneratedWorkout | null;
  onDelete?: (workoutId: string) => void;
}

export default function PreviousWorkoutDetailsModal({
  visible,
  onClose,
  workout,
  onDelete,
}: PreviousWorkoutDetailsModalProps) {
  const { currentTheme } = useTheme();

  if (!workout) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return '#10B981'; // Green
      case 'intermediate':
        return '#F59E0B'; // Yellow
      case 'advanced':
        return '#EF4444'; // Red
      case 'elite':
        return '#8B5CF6'; // Purple
      default:
        return currentTheme.colors.primary;
    }
  };

  const getExerciseDetails = (exerciseId: string) => {
    // Handle undefined/null exerciseId
    if (!exerciseId || typeof exerciseId !== 'string') {
      return {
        id: 'unknown',
        name: 'Unknown Exercise',
        category: 'compound',
        primaryMuscles: ['unknown'],
        secondaryMuscles: [],
        equipment: ['unknown'],
        description: 'Exercise details not available',
        isMainLift: false,
        themeLevel: 'beginner'
      };
    }

    return exercisesData.find(ex => ex.id === exerciseId) || {
      id: exerciseId,
      name: exerciseId.charAt(0).toUpperCase() + exerciseId.slice(1).replace(/-/g, ' '),
      category: 'compound',
      primaryMuscles: ['unknown'],
      secondaryMuscles: [],
      equipment: ['unknown'],
      description: 'Exercise details not available',
      isMainLift: false,
      themeLevel: 'beginner'
    };
  };

  // Calculate total volume (sets × reps for all exercises)
  const totalVolume = workout.exercises.reduce((total, exercise) => {
    const repsNumber = typeof exercise.reps === 'string' 
      ? parseInt(exercise.reps.split('-')[0]) || 0 
      : exercise.reps;
    return total + (exercise.sets * repsNumber);
  }, 0);

  const totalSets = workout.exercises.reduce((total, exercise) => total + exercise.sets, 0);

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workout.title}"? This will also remove any recorded lifts from this workout.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete?.(workout.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: currentTheme.colors.surface }]}>
          <ScrollView 
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleSection}>
                <Text style={[
                  styles.title, 
                  { 
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_700Bold',
                  }
                ]}>
                  {workout.title}
                </Text>
                <Text style={[
                  styles.date, 
                  { 
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                  }
                ]}>
                  {formatDate(workout.createdAt)} • {formatTime(workout.createdAt)}
                </Text>
              </View>
              
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={[styles.closeButtonText, { color: currentTheme.colors.text }]}>✕</Text>
              </Pressable>
            </View>

            {/* Workout Summary */}
            <View style={[styles.summaryCard, { backgroundColor: currentTheme.colors.secondary }]}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[
                    styles.summaryValue, 
                    { 
                      color: currentTheme.colors.primary,
                      fontFamily: 'Raleway_700Bold',
                    }
                  ]}>
                    {workout.exercises.length}
                  </Text>
                  <Text style={[
                    styles.summaryLabel, 
                    { 
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    Exercises
                  </Text>
                </View>
                
                <View style={styles.summaryItem}>
                  <Text style={[
                    styles.summaryValue, 
                    { 
                      color: currentTheme.colors.primary,
                      fontFamily: 'Raleway_700Bold',
                    }
                  ]}>
                    {totalSets}
                  </Text>
                  <Text style={[
                    styles.summaryLabel, 
                    { 
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    Total Sets
                  </Text>
                </View>
                
                <View style={styles.summaryItem}>
                  <Text style={[
                    styles.summaryValue, 
                    { 
                      color: currentTheme.colors.primary,
                      fontFamily: 'Raleway_700Bold',
                    }
                  ]}>
                    {totalVolume}
                  </Text>
                  <Text style={[
                    styles.summaryLabel, 
                    { 
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    Est. Reps
                  </Text>
                </View>
                
                <View style={styles.summaryItem}>
                  <Text style={[
                    styles.summaryValue, 
                    { 
                      color: currentTheme.colors.primary,
                      fontFamily: 'Raleway_700Bold',
                    }
                  ]}>
                    {workout.estimatedDuration}m
                  </Text>
                  <Text style={[
                    styles.summaryLabel, 
                    { 
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    Duration
                  </Text>
                </View>
              </View>
              
              <View style={styles.difficultyRow}>
                <View style={[
                  styles.difficultyBadge, 
                  { backgroundColor: getDifficultyColor(workout.difficulty) }
                ]}>
                  <Text style={[
                    styles.difficultyText,
                    { fontFamily: 'Raleway_500Medium' }
                  ]}>
                    {workout.difficulty}
                  </Text>
                </View>
              </View>
            </View>

            {/* Description */}
            <Text style={[
              styles.description, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              {workout.description || 'No description available'}
            </Text>

            {/* Exercises List */}
            <View style={styles.exercisesList}>
              <Text style={[
                styles.exercisesTitle, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Exercise Details
              </Text>
              
              {workout.exercises.map((exercise: any, index) => {
                const details = getExerciseDetails(exercise.id);
                const hasCompletedSets = exercise.completedSets && Array.isArray(exercise.completedSets) && exercise.completedSets.length > 0;
                
                return (
                  <View key={`exercise-${index}`} style={[styles.exerciseItem, { borderBottomColor: currentTheme.colors.border }]}>
                    <View style={styles.exerciseHeader}>
                      <View style={[styles.exerciseNumberBadge, { backgroundColor: currentTheme.colors.primary }]}>
                        <Text style={[
                          styles.exerciseNumberText,
                          { 
                            color: 'white',
                            fontFamily: 'Raleway_600SemiBold',
                          }
                        ]}>
                          {index + 1}
                        </Text>
                      </View>
                      
                                              <View style={styles.exerciseTitleSection}>
                          <View style={styles.exerciseNameRow}>
                            <Text style={[
                              styles.exerciseName, 
                              { 
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_700Bold',
                              }
                            ]}>
                              {details.name}
                            </Text>
                            
                            {/* Inline muscle tags */}
                            <View style={styles.muscleTagsRow}>
                              {details.primaryMuscles.slice(0, 2).map((muscle, idx) => (
                                <View key={idx} style={[styles.muscleTag, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                                  <Text style={[
                                    styles.muscleTagText,
                                    { 
                                      color: currentTheme.colors.primary,
                                      fontFamily: 'Raleway_500Medium',
                                    }
                                  ]}>
                                    {muscle}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                          
                          <Text style={[
                            styles.exerciseCategory, 
                            { 
                              color: currentTheme.colors.text,
                              fontFamily: 'Raleway_500Medium',
                            }
                          ]}>
                            {details.category} • Planned: {exercise.sets} sets × {exercise.reps} reps
                          </Text>
                        </View>
                    </View>

                    {/* Show completion data if available */}
                    {hasCompletedSets && (
                      <View style={styles.completedSection}>
                        <Text style={[styles.completedTitle, { color: currentTheme.colors.accent }]}>
                          Actual Performance:
                        </Text>
                        <Text style={[styles.completionSummary, { color: currentTheme.colors.text }]}>
                          Completed {exercise.completedSets.filter((set: any) => set.completed).length} out of {exercise.completedSets.length} sets
                        </Text>
                        
                        {exercise.completedSets.map((set: any, setIndex: number) => (
                          <View key={`set-${index}-${setIndex}`} style={styles.setRow}>
                            <Text style={[styles.setInfo, { color: currentTheme.colors.text }]}>
                              Set {set.setNumber}: 
                            </Text>
                            <Text style={[
                              styles.setDetails, 
                              { 
                                color: set.completed ? currentTheme.colors.text : currentTheme.colors.text + '60',
                                fontWeight: set.completed ? '600' : '400'
                              }
                            ]}>
                              {set.completed ? 
                                `${set.weight}${set.unit} × ${set.reps} reps` : 
                                'Skipped'
                              }
                            </Text>
                          </View>
                        ))}
                        
                        {/* Show max weight if available */}
                        {exercise.completedSets.some((set: any) => set.completed) && (
                          <Text style={[styles.maxWeight, { color: currentTheme.colors.accent }]}>
                            Max weight: {Math.max(...exercise.completedSets
                              .filter((set: any) => set.completed)
                              .map((set: any) => set.weight))}
                            {exercise.completedSets.find((set: any) => set.completed)?.unit || 'lbs'}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            
            {/* Delete Button */}
            {onDelete && (
              <Pressable 
                style={[styles.deleteWorkoutButton, { backgroundColor: '#EF4444' }]}
                onPress={handleDelete}
              >
                <Text style={[
                  styles.deleteWorkoutButtonText,
                  { 
                    color: 'white',
                    fontFamily: 'Raleway_600SemiBold',
                  }
                ]}>
                  Delete Workout
                </Text>
              </Pressable>
            )}
            
            {/* Bottom spacing */}
            <View style={styles.bottomSpacing} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    paddingTop: 60, // Account for status bar
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleSection: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    opacity: 0.7,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.8,
  },
  difficultyRow: {
    alignItems: 'center',
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    marginBottom: 20,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  exerciseItem: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseNumberBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseNumberText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseTitleSection: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  muscleTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  muscleTag: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
  },
  muscleTagText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  exerciseCategory: {
    fontSize: 13,
    opacity: 0.7,
    textTransform: 'capitalize',
  },
  exerciseDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exerciseDetail: {
    alignItems: 'center',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 10,
    opacity: 0.7,
  },
  detailSeparator: {
    fontSize: 16,
    fontWeight: 'bold',
    opacity: 0.5,
    marginHorizontal: 8,
  },
  muscleGroups: {
    marginBottom: 12,
  },
  muscleGroupsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  muscleGroupsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  muscleChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
  },
  muscleChipText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  exerciseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  equipmentSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentLabel: {
    fontSize: 12,
    opacity: 0.8,
    textTransform: 'capitalize',
  },
  exerciseDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  completedSection: {
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 12,
    borderRadius: 8,
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  completionSummary: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  setInfo: {
    fontSize: 14,
    opacity: 0.8,
    marginRight: 8,
  },
  setDetails: {
    fontSize: 14,
    flex: 1,
  },
  maxWeight: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  bottomSpacing: {
    height: 20,
  },

  deleteWorkoutButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  deleteWorkoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
}); 