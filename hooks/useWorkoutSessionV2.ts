import { storageService } from '@/lib/storage';
import { OneRMCalculator } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { getRecommendedWeight } from '@/lib/utils';
import { getWorkoutById } from '@/lib/workouts';
import {
  ActiveWorkoutSession,
  GeneratedWorkout,
  isMainLift,
  WeightUnit,
  WorkoutSetCompletion
} from '@/types';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export const useWorkoutSession = () => {
  const [activeSession, setActiveSession] = useState<ActiveWorkoutSession | null>(null);
  const [currentWeight, setCurrentWeight] = useState<{ value: number; unit: WeightUnit }>({ 
    value: 0, 
    unit: 'lbs' 
  });
  const [currentReps, setCurrentReps] = useState<number>(0);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);

  // Auto-save session whenever it changes
  useEffect(() => {
    if (activeSession && !activeSession.isCompleted) {
      storageService.saveActiveWorkoutSession(activeSession);
    }
  }, [activeSession]);
  const initializeWorkout = async (generatedWorkout: GeneratedWorkout) => {
    try {
      // Check if there's an existing session for this workout
      const existingSession = await storageService.getActiveWorkoutSession();
      
      if (existingSession && existingSession.workoutId === generatedWorkout.id) {
        // Resume existing session
        setActiveSession(existingSession);
      } else {
        // Create new workout session
        // First create exercises with default weights
        const exercises = await Promise.all(
          generatedWorkout.exercises.map(async (exercise) => {
            const recommendedWeight = await getRecommendedWeight(exercise.id, exercise.reps);
            return {
              id: exercise.id,
              sets: exercise.sets,
              reps: exercise.reps,
                             completedSets: [...Array(exercise.sets)].map((_, index) => ({
                setNumber: index + 1,
                weight: recommendedWeight,
                reps: parseInt(exercise.reps),
                unit: 'lbs' as WeightUnit,
                completed: false,
                restStartTime: undefined,
              })),
              isCompleted: false,
            };
          })
        );

        const session: ActiveWorkoutSession = {
          id: `session_${Date.now()}`,
          workoutId: generatedWorkout.id,
          title: generatedWorkout.title,
          exercises,
          startTime: new Date(),
          currentExerciseIndex: 0,
          currentSetIndex: 0,
          isCompleted: false,
          totalRestTime: 0,
        };

        setActiveSession(session);
      }
      
    } catch (error) {
      console.error('Error initializing workout:', error);
      throw error;
    }
  };

  const completeSet = async () => {
    if (!activeSession || !currentReps) return;

    const currentExercise = activeSession.exercises[activeSession.currentExerciseIndex];
    const currentExerciseDetails = getWorkoutById(currentExercise.id);
    const isBodyweightExercise = currentExerciseDetails?.equipment?.includes('bodyweight') || false;
    
    // For non-bodyweight exercises, require weight > 0
    if (!isBodyweightExercise && currentWeight.value <= 0) return;

    const setNumber = currentExercise.completedSets.length + 1;
    
    const newSet: WorkoutSetCompletion = {
      setNumber,
      weight: currentWeight.value,
      reps: parseInt(currentReps.toString()),
      unit: currentWeight.unit,
      completed: true,
      restStartTime: new Date(),
    };

    const updatedExercises = [...activeSession.exercises];
    updatedExercises[activeSession.currentExerciseIndex].completedSets.push(newSet);
    
    // Check if exercise is completed
    if (newSet.setNumber >= currentExercise.sets) {
      updatedExercises[activeSession.currentExerciseIndex].isCompleted = true;
    }

    const updatedSession: ActiveWorkoutSession = {
      ...activeSession,
      exercises: updatedExercises,
      currentSetIndex: newSet.setNumber >= currentExercise.sets ? 0 : newSet.setNumber,
    };

    setActiveSession(updatedSession);
    setCurrentReps(0);
  };

  const updateSet = async (exerciseIndex: number, setIndex: number, weight: { value: number; unit: WeightUnit }, reps: number) => {
    if (!activeSession || !reps) return;

    const currentExercise = activeSession.exercises[exerciseIndex];
    const currentExerciseDetails = getWorkoutById(currentExercise.id);
    const isBodyweightExercise = currentExerciseDetails?.equipment?.includes('bodyweight') || false;
    
    // For non-bodyweight exercises, require weight > 0
    if (!isBodyweightExercise && weight.value <= 0) return;
    
    if (setIndex >= currentExercise.completedSets.length) return;

    const updatedSet: WorkoutSetCompletion = {
      ...currentExercise.completedSets[setIndex],
      weight: weight.value,
      reps: parseInt(reps.toString()),
      unit: weight.unit,
      completed: true,
    };

    const updatedExercises = [...activeSession.exercises];
    updatedExercises[exerciseIndex].completedSets[setIndex] = updatedSet;

    const updatedSession: ActiveWorkoutSession = {
      ...activeSession,
      exercises: updatedExercises,
    };

    setActiveSession(updatedSession);
  };

  const deleteSet = async (exerciseIndex: number, setIndex: number) => {
    if (!activeSession) return;
    const updatedExercises = [...activeSession.exercises];
    const exercise = updatedExercises[exerciseIndex];
    
    // Remove the set from completedSets array
    exercise.completedSets.splice(setIndex, 1);
    
    // Update set numbers for remaining sets
    exercise.completedSets.forEach((set, index) => {
      set.setNumber = index + 1;
    });
    
    // Decrease the total sets count
    exercise.sets--;
    
    setActiveSession({
      ...activeSession,
      exercises: updatedExercises,
    });
  };

  const addSet = async (exerciseIndex: number) => {
    if (!activeSession) return;
    
    const updatedExercises = [...activeSession.exercises];
    const exercise = updatedExercises[exerciseIndex];
    
    // Add a new empty set to the completedSets array
    const newSet: WorkoutSetCompletion = {
      setNumber: exercise.completedSets.length + 1,
      weight: 0,
      reps: parseInt(exercise.reps),
      unit: 'lbs' as WeightUnit,
      completed: false,
      restStartTime: undefined,
    };
    
    exercise.completedSets.push(newSet);
    exercise.sets++;
    
    setActiveSession({
      ...activeSession,
      exercises: updatedExercises,
    });
  };

  const addExercise = async (exercise?: { id: string; name?: string }, options?: { sets: number; reps: string }) => {
    if (!activeSession) return;
    
    const updatedExercises = [...activeSession.exercises];
    
    // Create new exercise with provided parameters or defaults
    const sets = options?.sets || 3;
    const reps = options?.reps || '8';
    
    // Initialize completedSets array with empty sets
    const completedSets: WorkoutSetCompletion[] = [];
    for (let i = 0; i < sets; i++) {
      completedSets.push({
        setNumber: i + 1,
        weight: 0,
        reps: parseInt(reps),
        unit: 'lbs' as WeightUnit,
        completed: false,
        restStartTime: undefined,
      });
    }
    
    const newExercise = {
      id: exercise?.id || `exercise_${Date.now()}`,
      sets: sets,
      reps: reps,
      completedSets: completedSets,
      isCompleted: false,
    };
    
    updatedExercises.push(newExercise);
    
    setActiveSession({
      ...activeSession,
      exercises: updatedExercises,
    });
  };

  const deleteExercise = async (exerciseIndex: number) => {
    if (!activeSession) return;
    const updatedExercises = [...activeSession.exercises];
    updatedExercises.splice(exerciseIndex, 1);
    setActiveSession({
      ...activeSession,
      exercises: updatedExercises,
    });
  };

  const finishWorkout = async () => {
    if (!activeSession) return;

    try {      
      // Calculate workout statistics
      const workoutDuration = Math.round((Date.now() - activeSession.startTime.getTime()) / (1000 * 60));
      const totalSetsCompleted = activeSession.exercises.reduce((total, ex) => total + ex.completedSets.length, 0);
      const totalVolume = activeSession.exercises.reduce((total, ex) => {
        return total + ex.completedSets.reduce((setTotal, set) => {
          return setTotal + (set.weight * set.reps);
        }, 0);
      }, 0);

      // Save completed workout to history
      await storageService.saveWorkout({
        id: activeSession.workoutId + new Date().getTime().toString(),
        title: activeSession.title,
        exercises: activeSession.exercises.map(ex => ({
          id: ex.id,
          sets: ex.sets,
          reps: ex.reps,
          completedSets: ex.completedSets,
          isCompleted: ex.isCompleted,
        })),
        estimatedDuration: workoutDuration,
        difficulty: 'Completed',
        description: `Completed workout: ${totalSetsCompleted} sets, ${Math.round(totalVolume)} lbs total volume`,
        createdAt: new Date(),
      });

      // Update user progress for primary lifts that were performed
      let progressUpdates = 0;
      
      for (const exercise of activeSession.exercises) {
        if (exercise.completedSets.length > 0) {
          const bestSet = exercise.completedSets.reduce((best, current) => {
            const currentScore = OneRMCalculator.estimate(current.weight, current.reps);
            const bestScore = OneRMCalculator.estimate(best.weight, best.reps);
            return currentScore > bestScore ? current : best;
          });

          await userService.recordLift({
            parentId: activeSession.id,
            id: exercise.id,
            weight: bestSet.weight,
            reps: bestSet.reps,
            unit: bestSet.unit,
          }, isMainLift(exercise.id) ? 'main' : 'secondary');
          
          progressUpdates++;
          console.log(`✅ Updated progress for ${exercise.id}: ${bestSet.weight}${bestSet.unit} x ${bestSet.reps}`);
        }
      }

      // Clear active session since workout is complete
      await storageService.clearActiveWorkoutSession();
      setActiveSession(null);

      // Return workout stats for the completion modal
      const workoutStats = {
        duration: workoutDuration,
        totalSets: totalSetsCompleted,
        totalVolume: totalVolume,
        progressUpdates: progressUpdates,
      };

      const result = { session: activeSession, stats: workoutStats };

      return result;

    } catch (error) {
      console.error('Error finishing workout:', error);
      throw error;
    }
  };

  const cancelWorkout = async () => {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Cancel Workout?',
        'Are you sure you want to cancel this workout? All progress will be lost.',
        [
          { 
            text: 'Continue Workout', 
            style: 'cancel',
            onPress: () => resolve(false)
          },
          { 
            text: 'Cancel Workout', 
            style: 'destructive',
            onPress: async () => {
              await storageService.clearActiveWorkoutSession();
              // Reset state
              setActiveSession(null);
              setCurrentWeight({ value: 0, unit: 'lbs' });
              setCurrentReps(0);
              resolve(true);
            }
          }
        ]
      );
    });
  };

  return {
    // State
    activeSession,
    currentWeight,
    currentReps,
    progressExpanded,
    statsExpanded,
    
    // Setters
    setCurrentWeight,
    setCurrentReps,
    setProgressExpanded,
    setStatsExpanded,
    
    // Actions
    initializeWorkout,
    completeSet,
    updateSet,
    deleteSet,
    addSet,
    addExercise,
    deleteExercise,
    finishWorkout,
    cancelWorkout,

  };
}; 