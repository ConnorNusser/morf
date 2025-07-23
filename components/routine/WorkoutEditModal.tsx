import { useTheme } from '@/contexts/ThemeContext';
import { DAY_NAMES_DISPLAY, DAY_NAMES_INTERNAL, DAY_NAMES_SHORT } from '@/lib/day';
import { getWorkoutById } from '@/lib/workouts';
import { DayOfWeek, GeneratedWorkout, Workout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '../Button';
import ExerciseSelectionModal from './ExerciseSelectionModal';

interface WorkoutEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updatedWorkout: Partial<GeneratedWorkout>) => void;
  onDelete?: () => void;
  workout: GeneratedWorkout | null;
}

const DAYS_OF_WEEK = DAY_NAMES_INTERNAL.map((key, index) => ({
  key,
  label: DAY_NAMES_DISPLAY[index],
  short: DAY_NAMES_SHORT[index],
}));

export default function WorkoutEditModal({ visible, onClose, onSave, onDelete, workout }: WorkoutEditModalProps) {
  const { currentTheme } = useTheme();
  const [title, setTitle] = useState(workout?.title || '');
  const [description, setDescription] = useState(workout?.description || '');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(workout?.dayOfWeek || 'monday');
  const [exercises, setExercises] = useState(workout?.exercises || []);
  
  // Modal states
  const [isExerciseSelectionModalVisible, setIsExerciseSelectionModalVisible] = useState(false);

  React.useEffect(() => {
    if (workout) {
      setTitle(workout.title);
      setDescription(workout.description);
      setSelectedDay(workout.dayOfWeek || 'monday');
      setExercises(workout.exercises || []);
    }
  }, [workout]);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a workout title');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a workout description');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    const updatedWorkout: Partial<GeneratedWorkout> = {
      title: title.trim(),
      description: description.trim(),
      dayOfWeek: selectedDay,
      exercises: exercises,
    };

    onSave(updatedWorkout);
    onClose();
  };

  const handleClose = () => {
    if (workout) {
      setTitle(workout.title);
      setDescription(workout.description);
      setSelectedDay(workout.dayOfWeek || 'monday');
      setExercises(workout.exercises || []);
    }
    onClose();
  };

  const handleDeleteWorkout = () => {
    if (!onDelete) return;
    
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this entire workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          }
        }
      ]
    );
  };

  const handleAddExercise = (exercise: Workout, options: { sets: number; reps: string; weight?: string }) => {
    const newExercise = {
      id: exercise.id,
      sets: options.sets,
      reps: options.reps,
      completedSets: [],
      isCompleted: false,
    };

    setExercises([...exercises, newExercise]);
    setIsExerciseSelectionModalVisible(false);
  };

  const handleUpdateExercise = (index: number, field: 'sets' | 'reps', value: number | string) => {
    const updatedExercises = exercises.map((exercise, i) => {
      if (i === index) {
        return {
          ...exercise,
          [field]: value
        };
      }
      return exercise;
    });

    setExercises(updatedExercises);
  };

  const handleDeleteExercise = (index: number) => {
    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedExercises = exercises.filter((_, i) => i !== index);
            setExercises(updatedExercises);
          }
        }
      ]
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
            
            <Text style={[styles.headerTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_700Bold',
            }]}>
              Edit Workout
            </Text>
            
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              <Text style={[styles.saveButtonText, { 
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Title Input */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Workout Title
              </Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter workout title"
                placeholderTextColor={currentTheme.colors.text + '60'}
                maxLength={50}
              />
            </View>

            {/* Description Input */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Description
              </Text>
              <TextInput
                style={[styles.textAreaInput, { 
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter workout description"
                placeholderTextColor={currentTheme.colors.text + '60'}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>

            {/* Day Selection */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Day of Week
              </Text>
              
              <View style={styles.daysContainer}>
                {DAYS_OF_WEEK.map((day) => (
                  <TouchableOpacity
                    key={day.key}
                    onPress={() => setSelectedDay(day.key as DayOfWeek)}
                    style={[
                      styles.dayButton,
                      {
                        backgroundColor: selectedDay === day.key 
                          ? currentTheme.colors.primary
                          : currentTheme.colors.surface,
                        borderColor: selectedDay === day.key 
                          ? currentTheme.colors.primary
                          : currentTheme.colors.border,
                      }
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      {
                        color: selectedDay === day.key 
                          ? currentTheme.colors.background
                          : currentTheme.colors.text,
                        fontFamily: 'Raleway_600SemiBold',
                      }
                    ]}>
                      {day.short}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Exercises Section */}
            <View style={styles.inputSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.inputLabel, { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }]}>
                  Exercises ({exercises.length})
                </Text>
                
                <TouchableOpacity
                  onPress={() => setIsExerciseSelectionModalVisible(true)}
                  style={[styles.addButton, { backgroundColor: currentTheme.colors.primary }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={currentTheme.colors.background} />
                  <Text style={[styles.addButtonText, { 
                    color: currentTheme.colors.background,
                    fontFamily: 'Raleway_600SemiBold',
                  }]}>
                    Add
                  </Text>
                </TouchableOpacity>
              </View>

              {exercises.length === 0 ? (
                <View style={[styles.emptyExercises, { backgroundColor: currentTheme.colors.surface }]}>
                  <Ionicons name="fitness-outline" size={24} color={currentTheme.colors.text + '40'} />
                  <Text style={[styles.emptyExercisesText, { 
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                  }]}>
                    No exercises added yet
                  </Text>
                </View>
              ) : (
                <View style={[styles.exerciseList, { backgroundColor: currentTheme.colors.surface }]}>
                  {exercises.map((exercise, index) => {
                    const exerciseDetails = getWorkoutById(exercise.id);
                    const exerciseName = exerciseDetails?.name || `Unknown Exercise (${exercise.id})`;
                    
                    return (
                      <View key={index}>
                        <View style={styles.exerciseRow}>
                          <View style={styles.exerciseName}>
                            <Text 
                              style={[styles.exerciseNameText, { 
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_500Medium',
                              }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {exerciseName}
                            </Text>
                          </View>
                          
                          <View style={styles.exerciseInputs}>
                            <TextInput
                              style={[styles.input, { 
                                backgroundColor: currentTheme.colors.background,
                                borderColor: currentTheme.colors.border,
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_600SemiBold',
                              }]}
                              value={exercise.sets.toString()}
                              onChangeText={(value) => {
                                const numValue = parseInt(value) || 0;
                                handleUpdateExercise(index, 'sets', numValue);
                              }}
                              placeholder="0"
                              placeholderTextColor={currentTheme.colors.text + '40'}
                              keyboardType="numeric"
                              maxLength={2}
                              selectTextOnFocus
                            />
                            
                            <Text style={[styles.separator, { color: currentTheme.colors.text }]}>×</Text>
                            
                            <TextInput
                              style={[styles.input, { 
                                backgroundColor: currentTheme.colors.background,
                                borderColor: currentTheme.colors.border,
                                color: currentTheme.colors.text,
                                fontFamily: 'Raleway_600SemiBold',
                              }]}
                              value={exercise.reps}
                              onChangeText={(value) => handleUpdateExercise(index, 'reps', value)}
                              placeholder="8-12"
                              placeholderTextColor={currentTheme.colors.text + '40'}
                              maxLength={10}
                              selectTextOnFocus
                            />
                          </View>

                          <TouchableOpacity
                            onPress={() => handleDeleteExercise(index)}
                            style={[styles.deleteButton, { backgroundColor: currentTheme.colors.background + '40' }]}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="close" size={14} color={currentTheme.colors.text} style={{ opacity: 0.6 }} />
                          </TouchableOpacity>
                        </View>
                        
                        {index < exercises.length - 1 && (
                          <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Delete Workout Button */}
            {onDelete && (
              <View style={styles.dangerSection}>
                <Button
                  title="Delete Workout"
                  onPress={handleDeleteWorkout}
                  variant="secondary"
                  size="medium"
                  hapticType="medium"
                />
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Exercise Selection Modal */}
      <ExerciseSelectionModal
        visible={isExerciseSelectionModalVisible}
        onClose={() => setIsExerciseSelectionModalVisible(false)}
        onSelectExercise={handleAddExercise}
      />
    </>
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
    paddingVertical: 16,
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
  saveButton: {
    padding: 8,
    marginRight: -8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 50,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 100,
  },
  daysContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
     addButton: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 6,
     paddingVertical: 8,
     paddingHorizontal: 12,
     borderRadius: 8,
   },
   addButtonText: {
     fontSize: 13,
     fontWeight: '600',
   },
  emptyExercises: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyExercisesText: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 8,
  },
     
  dangerSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  exerciseList: {
    borderRadius: 12,
    overflow: 'hidden',
  },
     exerciseRow: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 12,
     paddingHorizontal: 16,
   },
   exerciseName: {
     flex: 1,
     marginRight: 12,
   },
   exerciseNameText: {
     fontSize: 15,
     fontWeight: '500',
   },
   exerciseInputs: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 8,
   },
   input: {
     borderWidth: 1,
     borderRadius: 6,
     paddingHorizontal: 8,
     paddingVertical: 6,
     fontSize: 14,
     width: 50,
     textAlign: 'center',
   },
   separator: {
     fontSize: 14,
     opacity: 0.5,
   },
   divider: {
     height: 1,
     opacity: 0.3,
   },
   deleteButton: {
     padding: 8,
     borderRadius: 6,
     marginLeft: 12,
     width: 32,
     height: 32,
     alignItems: 'center',
     justifyContent: 'center',
   },
}); 