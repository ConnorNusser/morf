import { useTheme } from '@/contexts/ThemeContext';
import { getWorkoutById } from '@/lib/workouts';
import { GeneratedWorkout, Workout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '../Button';
import ExerciseOptionsModal from '../inputs/ExerciseOptionsModal';
import ExerciseSelectionModal from './ExerciseSelectionModal';

interface BrowseWorkoutEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (workoutData: Partial<GeneratedWorkout>) => void;
  workout: GeneratedWorkout | null;
}

export default function BrowseWorkoutEditModal({
  visible,
  onClose,
  onSave,
  workout
}: BrowseWorkoutEditModalProps) {
  const { currentTheme } = useTheme();
  const isCreating = !workout;
  
  // Form state
  const [title, setTitle] = useState(workout?.title || '');
  const [description, setDescription] = useState(workout?.description || '');
  const [estimatedDuration, setEstimatedDuration] = useState((workout?.estimatedDuration || 45).toString());
  const [exercises, setExercises] = useState(workout?.exercises || []);
  
  // Modal states
  const [isExerciseSelectionModalVisible, setIsExerciseSelectionModalVisible] = useState(false);
  const [isExerciseOptionsModalVisible, setIsExerciseOptionsModalVisible] = useState(false);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a workout title');
      return;
    }

    const workoutData: Partial<GeneratedWorkout> = {
      title: title.trim(),
      description: description.trim(),
      estimatedDuration: parseInt(estimatedDuration) || 45,
      exercises,
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
          
          <Text style={[styles.headerTitle, { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_700Bold',
          }]}>
            {isCreating ? 'Create Workout' : 'Edit Workout'}
          </Text>
          
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={[styles.saveButtonText, { 
              color: currentTheme.colors.primary,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              {isCreating ? 'Create' : 'Save'}
            </Text>
          </TouchableOpacity>
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
                value={title}
                onChangeText={setTitle}
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
                Estimated Duration (minutes)
              </Text>
              <TextInput
                style={[styles.textInput, styles.numberInput, { 
                  backgroundColor: currentTheme.colors.background,
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                }]}
                placeholder="45"
                placeholderTextColor={currentTheme.colors.text + '60'}
                value={estimatedDuration}
                onChangeText={setEstimatedDuration}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Exercises Section */}
          <View style={[styles.section, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Exercises ({exercises.length})
              </Text>
              
              <Button
                title="Add Exercise"
                onPress={handleAddExercise}
                variant="primary"
                size="small"
                hapticType="light"
              />
            </View>

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
                          <Ionicons name="pencil" size={16} color={currentTheme.colors.text} style={{ opacity: 0.7 }} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteExercise(index)}
                          style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '60' }]}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="trash-outline" size={16} color={currentTheme.colors.text} style={{ opacity: 0.7 }} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
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
    justifyContent: 'space-between',
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  exerciseDetails: {
    fontSize: 12,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 