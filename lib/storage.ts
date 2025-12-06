import { CustomExercise, ExerciseMax, GeneratedWorkout, LiftDisplayFilters, Routine, UserProfile, WorkoutExerciseSession, WorkoutSetCompletion, WorkoutTemplate } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeLevel } from './theme';

// Storage keys
const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  WORKOUT_HISTORY: 'workout_history',
  ACTIVE_NOTE_SESSION: 'active_note_session',
  THEME_PREFERENCE: 'theme_preference',
  LIFT_DISPLAY_FILTERS: 'lift_display_filters',
  ROUTINES: 'routines',
  CURRENT_ROUTINE: 'current_routine',
  WORKOUT_ROUTINES: 'workout_routines',
  SHARE_COUNT: 'share_count',
  CUSTOM_EXERCISES: 'custom_exercises',
  WORKOUT_TEMPLATES: 'workout_templates',
  TUTORIAL_STATE: 'tutorial_state',
} as const;

export interface TutorialState {
  hasCompletedAppTutorial: boolean;
  tutorialsCompleted: {
    home: boolean;
    workout: boolean;
    history: boolean;
    profile: boolean;
  };
}

export { ExerciseMax, LiftDisplayFilters, ThemeLevel };

class StorageService {
  // User Profile
  async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  }

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }

  // Workout History
  async saveWorkout(workout: GeneratedWorkout): Promise<void> {
    try {
      const history = await this.getWorkoutHistory();
      history.push(workout);
      
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving workout:', error);
    }
  }

  async getWorkoutHistory(): Promise<GeneratedWorkout[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_HISTORY);
      if (!data) return [];
      
      const workouts = JSON.parse(data) as (Omit<GeneratedWorkout, 'createdAt'> & { createdAt: string })[];
      // Convert date strings back to Date objects
      return workouts.map((w) => ({
        ...w,
        createdAt: new Date(w.createdAt),
      }));
    } catch (error) {
      console.error('Error loading workout history:', error);
      return [];
    }
  }

  async deleteWorkout(workoutId: string): Promise<void> {
    try {
      const history = await this.getWorkoutHistory();
      const filtered = history.filter(w => w.id !== workoutId);
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting workout:', error);
    }
  }

  async clearWorkoutHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify([]));
    } catch (error) {
      console.error('Error clearing workout history:', error);
    }
  }

  // Theme Preference
  async saveThemePreference(themeLevel: ThemeLevel): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME_PREFERENCE, themeLevel);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }

  async getThemePreference(): Promise<ThemeLevel | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE);
      if (!data) return null;

      // Migrate old themes that no longer exist
      const validThemes: ThemeLevel[] = ['beginner', 'beginner_dark', 'intermediate', 'advanced', 'elite', 'god', 'share_warm', 'share_cool'];
      if (!validThemes.includes(data as ThemeLevel)) {
        // Map removed themes to their closest equivalent
        if (data === 'beginner_ocean') {
          return 'beginner';
        }
        return 'beginner';
      }

      return data as ThemeLevel;
    } catch (error) {
      console.error('Error loading theme preference:', error);
      return null;
    }
  }

  // Share count tracking for theme milestones
  async incrementShareCount(): Promise<number> {
    try {
      const currentCount = await this.getShareCount();
      const newCount = currentCount + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.SHARE_COUNT, JSON.stringify(newCount));
      return newCount;
    } catch (error) {
      console.error('Error incrementing share count:', error);
      return 0;
    }
  }

  async getShareCount(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SHARE_COUNT);
      // Default to 10 for testing, change to 0 for production
      return data ? JSON.parse(data) : 0;
    } catch (error) {
      console.error('Error loading share count:', error);
      return 0; // Default for testing
    }
  }

  // Lift Display Filters
  async saveLiftDisplayFilters(filters: LiftDisplayFilters): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LIFT_DISPLAY_FILTERS, JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving lift display filters:', error);
    }
  }

  async getLiftDisplayFilters(): Promise<LiftDisplayFilters> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LIFT_DISPLAY_FILTERS);
      return data ? JSON.parse(data) : {
        hiddenLiftIds: [],
      };
    } catch (error) {
      console.error('Error loading lift display filters:', error);
      return {
        hiddenLiftIds: [],
      };
    }
  }

  // Note-based workout session (for the freeform notes workout screen)
  async saveNoteSession(session: { noteText: string; startTime: Date }): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_NOTE_SESSION, JSON.stringify({
        noteText: session.noteText,
        startTime: session.startTime.toISOString(),
      }));
    } catch (error) {
      console.error('Error saving note session:', error);
    }
  }

  async getNoteSession(): Promise<{ noteText: string; startTime: Date } | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_NOTE_SESSION);
      if (!data) return null;

      const session = JSON.parse(data);
      return {
        noteText: session.noteText,
        startTime: new Date(session.startTime),
      };
    } catch (error) {
      console.error('Error loading note session:', error);
      return null;
    }
  }

  async clearNoteSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_NOTE_SESSION);
    } catch (error) {
      console.error('Error clearing note session:', error);
    }
  }

  // Utility functions
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }

  async exportData(): Promise<string> {
    try {
      const data = {
        userProfile: await this.getUserProfile(),
        workoutHistory: await this.getWorkoutHistory(),
        exportDate: new Date().toISOString(),
      };
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      return '';
    }
  }

  // Routines
  async getCurrentRoutine(): Promise<Routine | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_ROUTINE);
    return data ? JSON.parse(data) : null;
  };

  async setCurrentRoutine(routine: Routine): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_ROUTINE, JSON.stringify(routine));
  };

  async getRoutines(): Promise<Routine[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);
    const routines = data ? JSON.parse(data) : [];
    return routines;
  };

  async saveRoutine(routine: Routine): Promise<void> {
    routine.createdAt = new Date();
    const routines = await this.getRoutines();
    
    // Check if routine with same ID already exists
    const existingIndex = routines.findIndex(r => r.id === routine.id);
    
    if (existingIndex >= 0) {
      // Update existing routine
      routines[existingIndex] = routine;
    } else {
      // Add new routine
      routines.push(routine);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
  };

  async deleteRoutine(routineId: string): Promise<void> {
    const routines = await this.getRoutines();
    const filtered = routines.filter(r => r.id !== routineId);
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(filtered));
  }

  async getWorkoutRoutines(): Promise<GeneratedWorkout[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_ROUTINES);
    return data ? JSON.parse(data) : [];
  }

  async saveWorkoutRoutine(workout: GeneratedWorkout): Promise<void> {
    workout.createdAt = new Date();
    workout.exercises.forEach((exercise: WorkoutExerciseSession) => {
      exercise.completedSets.forEach((set: WorkoutSetCompletion) => {
        set.completed = false;
      });
      exercise.isCompleted = false;
    });

    const workoutRoutines = await this.getWorkoutRoutines();
    //filter out any workouts with the same id
    const filtered = workoutRoutines.filter(w => w.id !== workout.id);
    filtered.push(workout);
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_ROUTINES, JSON.stringify(filtered));
  }
  
  async deleteWorkoutRoutine(workoutId: string): Promise<void> {
    const workoutRoutines = await this.getWorkoutRoutines();
    const filtered = workoutRoutines.filter(w => w.id !== workoutId);
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_ROUTINES, JSON.stringify(filtered));
  }

  // Custom Exercises
  async getCustomExercises(): Promise<CustomExercise[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES);
      if (!data) return [];

      const exercises = JSON.parse(data) as (Omit<CustomExercise, 'createdAt'> & { createdAt: string })[];
      return exercises.map((e) => ({
        ...e,
        createdAt: new Date(e.createdAt),
      }));
    } catch (error) {
      console.error('Error loading custom exercises:', error);
      return [];
    }
  }

  async saveCustomExercise(exercise: CustomExercise): Promise<void> {
    try {
      const exercises = await this.getCustomExercises();

      // Check if exercise with same ID already exists
      const existingIndex = exercises.findIndex(e => e.id === exercise.id);

      if (existingIndex >= 0) {
        exercises[existingIndex] = exercise;
      } else {
        exercises.push(exercise);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(exercises));
    } catch (error) {
      console.error('Error saving custom exercise:', error);
    }
  }

  async deleteCustomExercise(exerciseId: string): Promise<void> {
    try {
      const exercises = await this.getCustomExercises();
      const filtered = exercises.filter(e => e.id !== exerciseId);
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting custom exercise:', error);
    }
  }

  async clearCustomExercises(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify([]));
    } catch (error) {
      console.error('Error clearing custom exercises:', error);
    }
  }

  async getCustomExerciseByName(name: string): Promise<CustomExercise | null> {
    const exercises = await this.getCustomExercises();
    return exercises.find(e => e.name.toLowerCase() === name.toLowerCase()) || null;
  }

  // Workout Templates
  async getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_TEMPLATES);
      const templates = (data ? JSON.parse(data) : []) as (Omit<WorkoutTemplate, 'createdAt' | 'lastUsed'> & { createdAt: string; lastUsed?: string })[];
      // Convert date strings back to Date objects
      return templates.map((t) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        lastUsed: t.lastUsed ? new Date(t.lastUsed) : undefined,
      }));
    } catch (error) {
      console.error('Error loading workout templates:', error);
      return [];
    }
  }

  async saveWorkoutTemplate(template: WorkoutTemplate): Promise<void> {
    try {
      const templates = await this.getWorkoutTemplates();
      const existingIndex = templates.findIndex(t => t.id === template.id);

      if (existingIndex >= 0) {
        templates[existingIndex] = template;
      } else {
        templates.push(template);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_TEMPLATES, JSON.stringify(templates));
    } catch (error) {
      console.error('Error saving workout template:', error);
    }
  }

  async deleteWorkoutTemplate(templateId: string): Promise<void> {
    try {
      const templates = await this.getWorkoutTemplates();
      const filtered = templates.filter(t => t.id !== templateId);
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_TEMPLATES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting workout template:', error);
    }
  }

  async updateTemplateLastUsed(templateId: string): Promise<void> {
    try {
      const templates = await this.getWorkoutTemplates();
      const template = templates.find(t => t.id === templateId);
      if (template) {
        template.lastUsed = new Date();
        await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_TEMPLATES, JSON.stringify(templates));
      }
    } catch (error) {
      console.error('Error updating template last used:', error);
    }
  }

  /**
   * Migrate all references from an old exercise ID to a new exercise ID.
   * This updates:
   * - Workout history (exercises in past workouts)
   * - User profile lifts and secondaryLifts
   * - Workout templates
   */
  async migrateExerciseId(oldId: string, newId: string): Promise<void> {
    if (oldId === newId) return;

    try {
      // 1. Update workout history
      const history = await this.getWorkoutHistory();
      let historyChanged = false;
      for (const workout of history) {
        for (const exercise of workout.exercises) {
          if (exercise.id === oldId) {
            exercise.id = newId;
            historyChanged = true;
          }
        }
      }
      if (historyChanged) {
        await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(history));
      }

      // 2. Update user profile lifts
      const profileData = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (profileData) {
        const profile = JSON.parse(profileData);
        let profileChanged = false;

        if (profile.lifts) {
          for (const lift of profile.lifts) {
            if (lift.id === oldId) {
              lift.id = newId;
              profileChanged = true;
            }
          }
        }

        if (profile.secondaryLifts) {
          for (const lift of profile.secondaryLifts) {
            if (lift.id === oldId) {
              lift.id = newId;
              profileChanged = true;
            }
          }
        }

        if (profileChanged) {
          await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
        }
      }

      // Note: WorkoutTemplates store raw noteText, not exercise IDs, so no migration needed

    } catch (error) {
      console.error('Error migrating exercise ID:', error);
      throw error;
    }
  }

  // Tutorial State
  async getTutorialState(): Promise<TutorialState | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TUTORIAL_STATE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading tutorial state:', error);
      return null;
    }
  }

  async saveTutorialState(state: TutorialState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_STATE, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving tutorial state:', error);
    }
  }

  async clearTutorialState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TUTORIAL_STATE);
    } catch (error) {
      console.error('Error clearing tutorial state:', error);
    }
  }
}

export const storageService = new StorageService();