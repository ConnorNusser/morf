import { storageService } from '@/lib/storage';
import { OneRMCalculator } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
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
        const session: ActiveWorkoutSession = {
          id: `session_${Date.now()}`,
          workoutId: generatedWorkout.id,
          title: generatedWorkout.title,
          exercises: generatedWorkout.exercises.map(exercise => ({
            id: exercise.id,
            sets: exercise.sets,
            reps: exercise.reps,
            completedSets: [],
            isCompleted: false,
          })),
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
    if (!activeSession || !currentReps || currentWeight.value <= 0) return;

    const currentExercise = activeSession.exercises[activeSession.currentExerciseIndex];
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

  const updateSet = async (setIndex: number, weight: { value: number; unit: WeightUnit }, reps: number) => {
    if (!activeSession || !reps || weight.value <= 0) return;

    const currentExercise = activeSession.exercises[activeSession.currentExerciseIndex];
    if (setIndex >= currentExercise.completedSets.length) return;

    const updatedSet: WorkoutSetCompletion = {
      ...currentExercise.completedSets[setIndex],
      weight: weight.value,
      reps: parseInt(reps.toString()),
      unit: weight.unit,
    };

    const updatedExercises = [...activeSession.exercises];
    updatedExercises[activeSession.currentExerciseIndex].completedSets[setIndex] = updatedSet;

    const updatedSession: ActiveWorkoutSession = {
      ...activeSession,
      exercises: updatedExercises,
    };

    setActiveSession(updatedSession);
  };

  const jumpToExercise = (exerciseIndex: number) => {
    if (!activeSession || exerciseIndex === activeSession.currentExerciseIndex) return;

    const updatedSession: ActiveWorkoutSession = {
      ...activeSession,
      currentExerciseIndex: exerciseIndex,
      currentSetIndex: 0,
    };

    setActiveSession(updatedSession);
    setCurrentReps(0);
  };

  const nextExercise = () => {
    if (!activeSession) return;

    const nextIndex = activeSession.currentExerciseIndex + 1;
    if (nextIndex >= activeSession.exercises.length) {
      finishWorkout();
      return;
    }

    const updatedSession: ActiveWorkoutSession = {
      ...activeSession,
      currentExerciseIndex: nextIndex,
      currentSetIndex: 0,
    };

    setActiveSession(updatedSession);
    setCurrentReps(0);
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
        id: activeSession.workoutId,
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
    jumpToExercise,
    nextExercise,
    finishWorkout,
    cancelWorkout,
  };
}; 