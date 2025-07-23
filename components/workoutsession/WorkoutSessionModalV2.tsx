import Button from '@/components/Button';
import Card from '@/components/Card';
import RestTimer from '@/components/RestTimer';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkoutSessionContext } from '@/contexts/WorkoutSessionContext';
import { useRestTimer } from '@/hooks/useRestTimer';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { getRecommendedWeight } from '@/lib/utils';
import { getWorkoutById } from '@/lib/workouts';
import { ActiveWorkoutSession, GeneratedWorkout, WeightUnit } from '@/types';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import ExerciseCard from './ExerciseCard';
import WorkoutHeader from './WorkoutHeader';

interface WorkoutSessionModalV2Props {
  visible: boolean;
  onClose: () => void;
  workout: GeneratedWorkout | null;
  onWorkoutComplete?: (result?: { session: ActiveWorkoutSession; stats: { duration: number; totalSets: number; totalVolume: number; progressUpdates: number; } }) => void;
}

interface ExerciseSetInputs {
  [exerciseIndex: number]: {
    [setIndex: number]: {
      weight: { value: number; unit: 'lbs' | 'kg' };
      reps: number;
    };
  };
}

export default function WorkoutSessionModalV2({
  visible,
  onClose,
  workout,
  onWorkoutComplete
}: WorkoutSessionModalV2Props) {
  const { currentTheme } = useTheme();
  
  // Global display unit for the entire workout
  const [displayUnit, setDisplayUnit] = useState<WeightUnit>('lbs');
  
  // Use the persistent rest timer hook
  const { isResting, formattedTime, startTimer, skipTimer } = useRestTimer();
  
  // Use the context
  const {
    activeSession,
    initializeWorkout,
    deleteSet,
    addSet,
    addExercise,
    deleteExercise,
    finishWorkout,
    cancelWorkout,
    updateSet,
    completeSet,
  } = useWorkoutSessionContext();

  // Add workout timer
  const { formattedTime: workoutTime } = useWorkoutTimer(activeSession?.startTime || null);

  // Local state for set inputs that your ExerciseCard expects
  const [setInputs, setSetInputs] = useState<ExerciseSetInputs>({});

  const toggleUnit = () => {
    setDisplayUnit(prev => prev === 'lbs' ? 'kg' : 'lbs');
  };

  useEffect(() => {
    if (visible && workout) {
      initializeWorkout(workout).catch(() => {
        onClose();
      });
    }
  }, [visible, workout]);

  // Initialize set inputs when session starts - properly sync with context
  useEffect(() => {
    const initializeSetInputs = async () => {
      if (activeSession) {
        const inputs: ExerciseSetInputs = {};
        
        for (let exerciseIndex = 0; exerciseIndex < activeSession.exercises.length; exerciseIndex++) {
          const exercise = activeSession.exercises[exerciseIndex];
          const exerciseDetails = getWorkoutById(exercise.id);
          const isBodyweight = exerciseDetails?.equipment?.includes('bodyweight') || false;
          
          inputs[exerciseIndex] = {};
          
          // Initialize inputs for all sets
          for (let setIndex = 0; setIndex < exercise.sets; setIndex++) {
            const completedSet = exercise.completedSets[setIndex];
            
            if (completedSet && completedSet.completed) {
              // Use completed set data
              inputs[exerciseIndex][setIndex] = {
                weight: { value: completedSet.weight, unit: completedSet.unit },
                reps: completedSet.reps
              };
            } else {
              // Use recommended/default values
              const recommendedWeight = isBodyweight ? 0 : await getRecommendedWeight(exercise.id, exercise.reps);
              inputs[exerciseIndex][setIndex] = {
                weight: { value: recommendedWeight, unit: 'lbs' },
                reps: parseInt(exercise.reps) // Use target reps as default
              };
            }
          }
        }
        
        setSetInputs(inputs);
      }
    };
    
    initializeSetInputs();
  }, [activeSession?.id]); // Use session ID to avoid too frequent updates

  const updateSetInput = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: any) => {
    setSetInputs(prev => ({
      ...prev,
      [exerciseIndex]: {
        ...prev[exerciseIndex],
        [setIndex]: {
          ...prev[exerciseIndex]?.[setIndex],
          [field]: value
        }
      }
    }));
  };

  const handleCompleteSet = async (exerciseIndex: number, setIndex: number) => {
    if (!activeSession) return;
    
    const inputs = setInputs[exerciseIndex]?.[setIndex];
    if (!inputs || inputs.reps <= 0) return;

    const exercise = activeSession.exercises[exerciseIndex];
    const exerciseDetails = getWorkoutById(exercise.id);
    const isBodyweight = exerciseDetails?.equipment?.includes('bodyweight') || false;

    if (!isBodyweight && inputs.weight.value <= 0) return;

    try {
      await updateSet(exerciseIndex, setIndex, inputs.weight, inputs.reps);
    } catch {
      // If not updating existing, complete new set
      await completeSet();
    }
    
    // Start rest timer after completing a set
    startTimer(90);
  };

  const handleDeleteExercise = async (exerciseIndex: number) => {
    // Simplified - just don't allow this for now
    console.log('Delete exercise not implemented in V2');
  };

  const handleAddSet = async (exerciseIndex: number) => {
    // Simplified - just don't allow this for now
    console.log('Add set not implemented in V2');
  };

  const handleFinishWorkout = async () => {
    try {
      const result = await finishWorkout();
      
      if (result) {
        onWorkoutComplete?.(result);
      }
    } catch (error) {
      console.error('Error finishing workout:', error);
      onClose();
    }
  };

  if (!activeSession) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
          <Text style={[styles.loadingText, { color: currentTheme.colors.text }]}>
            Loading workout...
          </Text>
        </View>
      </Modal>
    );
  }

  const isAllExercisesComplete = activeSession.exercises.every(ex => ex.isCompleted);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
        {/* Swipe Indicator */}
        <View style={styles.swipeIndicator}>
          <View style={[styles.swipeHandle, { backgroundColor: currentTheme.colors.border }]} />
        </View>
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <Button
            title="Cancel"
            onPress={() => cancelWorkout()}
            variant="ghost"
            size="small"
          />
          
          {/* Unit Toggle */}
          <TouchableOpacity
            style={[styles.unitToggle, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
            onPress={toggleUnit}
          >
            <Text style={[styles.unitToggleText, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_500Medium',
            }]}>
              {displayUnit}
            </Text>
          </TouchableOpacity>
          
          <Button
            title="Finish"
            onPress={handleFinishWorkout}
            variant="primary"
            size="small"
            hapticType="light"
            disabled={!isAllExercisesComplete}
          />
        </View>

        {/* Workout Info */}
        <WorkoutHeader 
          title={activeSession.title}
          workoutTime={workoutTime}
          themeColors={currentTheme.colors}
        />

        {/* Rest Timer */}
        <RestTimer 
          isResting={isResting}
          formattedTime={formattedTime}
          onSkip={skipTimer}
        />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.contentPadding, { backgroundColor: 'transparent' }]}>
            {activeSession.exercises.map((exercise, index) => (
              <ExerciseCard
                key={index}
                exercise={exercise}
                exerciseIndex={index}
                setInputs={setInputs[index] || {}}
                // Special-Tag: we might want to change this behavior to not auto complete the set when the input changes
                onSetInputChange={(setIndex, field, value) => updateSetInput(index, setIndex, field, value)}
                onCompleteSet={(setIndex) => handleCompleteSet(index, setIndex)}
                onDeleteSet={(setIndex) => deleteSet(index, setIndex)}
                onDeleteExercise={() => deleteExercise(index)}
                onAddSet={() => addSet(index)}
                themeColors={currentTheme.colors}
                displayUnit={displayUnit}
              />
            ))}
            
            {/* Finish Button */}
            {isAllExercisesComplete && (
              <Card style={styles.finishCard} variant="elevated">
                <Text style={[styles.completeText, { color: currentTheme.colors.accent }]}>
                  🎉 Workout Complete!
                </Text>
                <Button
                  title="Finish Workout"
                  onPress={handleFinishWorkout}
                  variant="primary"
                  size="large"
                />
              </Card>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    marginTop: -40,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  swipeHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 20,
    paddingTop: 0,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  finishCard: {
    marginTop: 20,
    padding: 20,
    alignItems: 'center',
  },
  completeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  unitToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent', // Will be overridden by borderColor
  },
  unitToggleText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
}); 