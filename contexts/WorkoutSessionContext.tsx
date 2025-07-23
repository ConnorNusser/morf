import { useWorkoutSession } from '@/hooks/useWorkoutSessionV2';
import { ActiveWorkoutSession, GeneratedWorkout, WeightUnit } from '@/types';
import React, { createContext, useContext, useState } from 'react';

interface WorkoutSessionContextType {
  activeSession: ActiveWorkoutSession | null;
  isModalVisible: boolean;
  generatedWorkout: GeneratedWorkout | null;
  openWorkoutModal: (workout: GeneratedWorkout) => void;
  closeWorkoutModal: () => void;
  
  // Expose workout session functionality
  currentWeight: { value: number; unit: WeightUnit };
  currentReps: number;
  progressExpanded: boolean;
  statsExpanded: boolean;
  setCurrentWeight: (weight: { value: number; unit: WeightUnit }) => void;
  setCurrentReps: (reps: number) => void;
  setProgressExpanded: (expanded: boolean) => void;
  setStatsExpanded: (expanded: boolean) => void;
  initializeWorkout: (workout: GeneratedWorkout) => Promise<void>;
  completeSet: () => Promise<void>;
  updateSet: (exerciseIndex: number, setIndex: number, weight: { value: number; unit: WeightUnit }, reps: number) => Promise<void>;
  deleteSet: (exerciseIndex: number, setIndex: number) => Promise<void>;
  addSet: (exerciseIndex: number) => Promise<void>;
  addExercise: (exercise?: { id: string; name?: string }, options?: { sets: number; reps: string }) => Promise<void>;
  deleteExercise: (exerciseIndex: number) => Promise<void>;
  finishWorkout: () => Promise<any>;
  cancelWorkout: () => Promise<boolean>;
}

const WorkoutSessionContext = createContext<WorkoutSessionContextType | undefined>(undefined);

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  
  // Use the existing workout session hook
  const workoutSession = useWorkoutSession();

  const openWorkoutModal = (workout: GeneratedWorkout) => {
    setGeneratedWorkout(workout);
    setIsModalVisible(true);
  };

  const closeWorkoutModal = () => {
    setIsModalVisible(false);
    setGeneratedWorkout(null);
  };

  const finishWorkout = async () => {
    try {
      const result = await workoutSession.finishWorkout();
      return result;
    } catch (error) {
      console.error('Error finishing workout:', error);
      throw error;
    }
  };

  // Enhanced cancel workout that closes modal only if successfully cancelled
  const cancelWorkout = async () => {
    const wasCancelled = await workoutSession.cancelWorkout();
    if (wasCancelled) {
      setIsModalVisible(false);
      setGeneratedWorkout(null);
    }
    return wasCancelled;
  };

  const value = {
    activeSession: workoutSession.activeSession,
    isModalVisible,
    generatedWorkout,
    openWorkoutModal,
    closeWorkoutModal,
    
    // Expose all workout session functionality
    currentWeight: workoutSession.currentWeight,
    currentReps: workoutSession.currentReps,
    progressExpanded: workoutSession.progressExpanded,
    statsExpanded: workoutSession.statsExpanded,
    setCurrentWeight: workoutSession.setCurrentWeight,
    setCurrentReps: workoutSession.setCurrentReps,
    setProgressExpanded: workoutSession.setProgressExpanded,
    setStatsExpanded: workoutSession.setStatsExpanded,
    initializeWorkout: workoutSession.initializeWorkout,
    completeSet: workoutSession.completeSet,
    updateSet: workoutSession.updateSet,
    deleteSet: workoutSession.deleteSet,
    addSet: workoutSession.addSet,
    addExercise: workoutSession.addExercise,
    deleteExercise: workoutSession.deleteExercise,
    finishWorkout, // Use our enhanced version
    cancelWorkout, // Use our enhanced version
  };

  return (
    <WorkoutSessionContext.Provider value={value}>
      {children}
    </WorkoutSessionContext.Provider>
  );
}

export function useWorkoutSessionContext() {
  const context = useContext(WorkoutSessionContext);
  if (context === undefined) {
    throw new Error('useWorkoutSessionContext must be used within a WorkoutSessionProvider');
  }
  return context;
} 