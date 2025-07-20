import { ActiveWorkoutSession, ExerciseMax, GeneratedWorkout, Routine, UserPreferences, UserProfile, UserProgress, WorkoutExerciseSession, WorkoutFilters } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeLevel } from './theme';

// Storage keys
const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  USER_PROGRESS: 'user_progress',
  WORKOUT_HISTORY: 'workout_history',
  USER_PREFERENCES: 'user_preferences',
  ACTIVE_WORKOUT_SESSION: 'active_workout_session',
  THEME_PREFERENCE: 'theme_preference',
  WORKOUT_FILTERS: 'workout_filters',
  ROUTINES: 'routines',
  CURRENT_ROUTINE: 'current_routine',
  WORKOUT_ROUTINES: 'workout_routines',

} as const;

export { ExerciseMax, ThemeLevel, UserPreferences, WorkoutFilters };

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

  // User Progress
  async saveUserProgress(progress: UserProgress[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROGRESS, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving user progress:', error);
    }
  }

  async getUserProgress(): Promise<UserProgress[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROGRESS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading user progress:', error);
      return [];
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
      
      const workouts = JSON.parse(data);
      // Convert date strings back to Date objects
      return workouts.map((w: any) => ({
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

  // User Preferences
  async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  }

  async getUserPreferences(): Promise<UserPreferences> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return data ? JSON.parse(data) : {
        preferredEquipment: ['barbell', 'dumbbell', 'machine'],
        workoutDuration: 60,
        excludeBodyweight: false,
        favoriteExercises: [],
        notifications: true,
      };
    } catch (error) {
      console.error('Error loading user preferences:', error);
      return {
        preferredEquipment: ['barbell', 'dumbbell', 'machine'],
        workoutDuration: 60,
        excludeBodyweight: false,
        favoriteExercises: [],
        notifications: true,
      };
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

  async getThemePreference(): Promise<ThemeLevel> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE);
      return (data as ThemeLevel) || 'beginner'; // Default to beginner theme
    } catch (error) {
      console.error('Error loading theme preference:', error);
      return 'beginner';
    }
  }

  // Workout Filters
  async saveWorkoutFilters(filters: WorkoutFilters): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_FILTERS, JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving workout filters:', error);
    }
  }

  async getWorkoutFilters(): Promise<WorkoutFilters> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_FILTERS);
      return data ? JSON.parse(data) : {
        excludedWorkoutIds: [],
        workoutType: 'powerlifting', // Default to powerlifting
      };
    } catch (error) {
      console.error('Error loading workout filters:', error);
      return {
        excludedWorkoutIds: [],
        workoutType: 'powerlifting', // Default to powerlifting
      };
    }
  }

  // Active workout session management
  async saveActiveWorkoutSession(session: ActiveWorkoutSession): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_WORKOUT_SESSION, JSON.stringify(session));
  }

  async getActiveWorkoutSession(): Promise<ActiveWorkoutSession | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_WORKOUT_SESSION);
      if (!data) return null;
      
      const session = JSON.parse(data);
      // Convert date strings back to Date objects
      session.startTime = new Date(session.startTime);
      session.exercises.forEach((exercise: any) => {
        exercise.completedSets.forEach((set: any) => {
          if (set.restStartTime) {
            set.restStartTime = new Date(set.restStartTime);
          }
        });
      });
      
      return session;
    } catch (error) {
      console.error('Error loading active workout session:', error);
      return null;
    }
  }

  async clearActiveWorkoutSession(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKOUT_SESSION);
  }

  async hasActiveWorkoutSession(): Promise<boolean> {
    const session = await this.getActiveWorkoutSession();
    return session !== null && !session.isCompleted;
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
        userProgress: await this.getUserProgress(),
        workoutHistory: await this.getWorkoutHistory(),
        userPreferences: await this.getUserPreferences(),
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
    console.log('💾 Storage: Found', routines.length, 'routines in storage');
    return routines;
  };

  async saveRoutine(routine: Routine): Promise<void> {
    routine.createdAt = new Date();
    const routines = await this.getRoutines();
    
    // Check if routine with same ID already exists
    const existingIndex = routines.findIndex(r => r.id === routine.id);
    
    if (existingIndex >= 0) {
      // Update existing routine
      console.log('💾 Storage: Updating existing routine:', routine.name);
      routines[existingIndex] = routine;
    } else {
      // Add new routine
      console.log('💾 Storage: Adding new routine:', routine.name);
      routines.push(routine);
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    console.log('💾 Storage: Saved routine. Total routines now:', routines.length);
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
      exercise.completedSets = [];
      exercise.isCompleted = false;
    });

    const workoutRoutines = await this.getWorkoutRoutines();
    workoutRoutines.push(workout);
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_ROUTINES, JSON.stringify(workoutRoutines));
  }
  
  async deleteWorkoutRoutine(workoutId: string): Promise<void> {
    const workoutRoutines = await this.getWorkoutRoutines();
    const filtered = workoutRoutines.filter(w => w.id !== workoutId);
    await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_ROUTINES, JSON.stringify(filtered));
  }
}

export const storageService = new StorageService();