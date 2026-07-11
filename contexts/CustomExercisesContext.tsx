import { storageService } from '@/lib/storage/storage';
import { setCustomExerciseCache } from '@/lib/workout/exerciseCatalog';
import { CustomExercise } from '@/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface CustomExercisesContextType {
  customExercises: CustomExercise[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  addExercise: (exercise: CustomExercise) => Promise<void>;
  updateExercise: (oldId: string, exercise: CustomExercise) => Promise<void>;
  deleteExercise: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  getByName: (name: string) => CustomExercise | undefined;
}

const CustomExercisesContext = createContext<CustomExercisesContextType | undefined>(undefined);

export function CustomExercisesProvider({ children }: { children: React.ReactNode }) {
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mirror into the module-level cache so the sync getExercise() resolver (used by
  // lib code outside this provider) can see custom exercises.
  useEffect(() => { setCustomExerciseCache(customExercises); }, [customExercises]);

  const refresh = useCallback(async () => {
    try {
      const exercises = await storageService.getCustomExercises();
      setCustomExercises(exercises);
    } catch (error) {
      console.error('Error loading custom exercises:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addExercise = useCallback(async (exercise: CustomExercise) => {
    await storageService.saveCustomExercise(exercise);
    setCustomExercises(prev => [...prev, exercise]);
  }, []);

  const updateExercise = useCallback(async (oldId: string, exercise: CustomExercise) => {
    // If the ID changed, migrate all references first.
    if (oldId !== exercise.id) {
      await storageService.migrateExerciseId(oldId, exercise.id);
    }
    await storageService.deleteCustomExercise(oldId);
    await storageService.saveCustomExercise(exercise);
    setCustomExercises(prev =>
      prev.map(e => e.id === oldId ? exercise : e)
    );
  }, []);

  const deleteExercise = useCallback(async (id: string) => {
    await storageService.deleteCustomExercise(id);
    setCustomExercises(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await storageService.clearCustomExercises();
    setCustomExercises([]);
  }, []);

  const getByName = useCallback((name: string) => {
    return customExercises.find(
      e => e.name.toLowerCase() === name.toLowerCase()
    );
  }, [customExercises]);

  const value = useMemo(() => ({
    customExercises,
    isLoading,
    refresh,
    addExercise,
    updateExercise,
    deleteExercise,
    clearAll,
    getByName,
  }), [customExercises, isLoading, refresh, addExercise, updateExercise, deleteExercise, clearAll, getByName]);

  return (
    <CustomExercisesContext.Provider value={value}>
      {children}
    </CustomExercisesContext.Provider>
  );
}

export function useCustomExercises() {
  const context = useContext(CustomExercisesContext);
  if (context === undefined) {
    throw new Error('useCustomExercises must be used within a CustomExercisesProvider');
  }
  return context;
}
