import { storageService } from '@/lib/storage';
import { GeneratedWorkout } from '@/types';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface WorkoutContextType {
  // State
  workouts: GeneratedWorkout[];
  isLoading: boolean;
  
  // Actions
  loadWorkouts: () => Promise<void>;
  createWorkout: (workout: GeneratedWorkout) => Promise<void>;
  updateWorkout: (workout: GeneratedWorkout) => Promise<void>;
  deleteWorkout: (workoutId: string) => Promise<void>;
  refreshWorkouts: () => Promise<void>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWorkouts = async () => {
    try {
      setIsLoading(true);
      const storedWorkouts = await storageService.getWorkoutRoutines();
      
      // Sort by creation date (newest first)
      storedWorkouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setWorkouts(storedWorkouts);
    } catch (error) {
      console.error('❌ WorkoutContext: Error loading workouts:', error);
      setWorkouts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createWorkout = async (workout: GeneratedWorkout) => {
    try {
      await storageService.saveWorkoutRoutine(workout);
      await loadWorkouts(); // Reload to ensure consistency
    } catch (error) {
      console.error('❌ WorkoutContext: Error creating workout:', error);
      throw error;
    }
  };

  const updateWorkout = async (workout: GeneratedWorkout) => {
    try {
      await storageService.saveWorkoutRoutine(workout);
      await loadWorkouts(); // Reload to ensure consistency
    } catch (error) {
      console.error('❌ WorkoutContext: Error updating workout:', error);
      throw error;
    }
  };

  const deleteWorkout = async (workoutId: string) => {
    try {
      await storageService.deleteWorkoutRoutine(workoutId);
      await loadWorkouts(); // Reload to ensure consistency
    } catch (error) {
      console.error('❌ WorkoutContext: Error deleting workout:', error);
      throw error;
    }
  };

  const refreshWorkouts = async () => {
    await loadWorkouts();
  };

  // Load workouts on mount
  useEffect(() => {
    loadWorkouts();
  }, []);

  const value: WorkoutContextType = {
    workouts,
    isLoading,
    loadWorkouts,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    refreshWorkouts,
  };

  return (
    <WorkoutContext.Provider value={value}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
} 