import { storageService } from '@/lib/storage/storage';
import { Routine } from '@/types';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface RoutineContextType {
  // State
  routines: Routine[];
  currentRoutine: Routine | null;
  isLoading: boolean;
  
  // Actions
  loadRoutines: () => Promise<void>;
  createRoutine: (routine: Routine) => Promise<void>;
  updateRoutine: (routine: Routine) => Promise<void>;
  deleteRoutine: (routineId: string) => Promise<void>;
  setCurrentRoutine: (routine: Routine | null) => Promise<void>;
  refreshRoutines: () => Promise<void>;
}

const RoutineContext = createContext<RoutineContextType | undefined>(undefined);

export function RoutineProvider({ children }: { children: React.ReactNode }) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [currentRoutine, setCurrentRoutineState] = useState<Routine | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoutines = async () => {
    try {
      setIsLoading(true);
      const [storedRoutines, storedCurrentRoutine] = await Promise.all([
        storageService.getRoutines(),
        storageService.getCurrentRoutine()
      ]);
      
      setRoutines(storedRoutines);
      setCurrentRoutineState(storedCurrentRoutine);
    } catch (error) {
      console.error('❌ RoutineContext: Error loading routines:', error);
      setRoutines([]);
      setCurrentRoutineState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const createRoutine = async (routine: Routine) => {
    try {
      await storageService.saveRoutine(routine);
      await loadRoutines(); // Reload to ensure consistency
    } catch (error) {
      console.error('❌ RoutineContext: Error creating routine:', error);
      throw error;
    }
  };

  const updateRoutine = async (routine: Routine) => {
    try {
      await storageService.saveRoutine(routine);
      
      // Update current routine if it's the one being updated
      if (currentRoutine?.id === routine.id) {
        await storageService.setCurrentRoutine(routine);
      }
      
      await loadRoutines(); // Reload to ensure consistency
    } catch (error) {
      console.error('❌ RoutineContext: Error updating routine:', error);
      throw error;
    }
  };

  const deleteRoutine = async (routineId: string) => {
    try {
      await storageService.deleteRoutine(routineId);
      
      // Clear current routine if it's the one being deleted
      if (currentRoutine?.id === routineId) {
        setCurrentRoutineState(null);
        // Clear from storage as well
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await storageService.setCurrentRoutine(null as any);
        } catch (storageError) {
          console.warn('Warning: Could not clear current routine from storage:', storageError);
        }
      }
      
      await loadRoutines(); // Reload to ensure consistency
    } catch (error) {
      console.error('❌ RoutineContext: Error deleting routine:', error);
      throw error;
    }
  };

  const setCurrentRoutine = async (routine: Routine | null) => {
    try {
      if (routine) {
        await storageService.setCurrentRoutine(routine);
      } else {
        // Handle clearing current routine
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await storageService.setCurrentRoutine(null as any);
        } catch (error) {
          console.warn('Warning: Could not clear current routine from storage:', error);
        }
      }
      setCurrentRoutineState(routine);
    } catch (error) {
      console.error('❌ RoutineContext: Error setting current routine:', error);
      throw error;
    }
  };

  const refreshRoutines = async () => {
    await loadRoutines();
  };

  // Load routines on mount
  useEffect(() => {
    loadRoutines();
  }, []);

  const value: RoutineContextType = {
    routines,
    currentRoutine,
    isLoading,
    loadRoutines,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    setCurrentRoutine,
    refreshRoutines,
  };

  return (
    <RoutineContext.Provider value={value}>
      {children}
    </RoutineContext.Provider>
  );
}

export function useRoutine() {
  const context = useContext(RoutineContext);
  if (context === undefined) {
    throw new Error('useRoutine must be used within a RoutineProvider');
  }
  return context;
} 