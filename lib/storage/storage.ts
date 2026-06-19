import { CustomExercise, ExerciseMax, GeneratedWorkout, LiftDisplayFilters, Program, Routine, UserProfile, WorkoutExerciseSession, WorkoutSetCompletion, WorkoutTemplate } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeLevel } from '@/lib/ui/theme';
import { DEFAULT_WEEKLY_GOAL, WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from '@/lib/workout/weeklyGoal';
import { getNextInCycle, getUpNextCandidates } from '@/lib/workout/activeRoutine';

// Storage keys
const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  WORKOUT_HISTORY: 'workout_history',
  ACTIVE_NOTE_SESSION: 'active_note_session',
  THEME_PREFERENCE: 'theme_preference',
  LIFT_DISPLAY_FILTERS: 'lift_display_filters',
  ROUTINES: 'routines',
  PROGRAMS: 'programs',
  CURRENT_ROUTINE: 'current_routine',
  WORKOUT_ROUTINES: 'workout_routines',
  SHARE_COUNT: 'share_count',
  CUSTOM_EXERCISES: 'custom_exercises',
  WORKOUT_TEMPLATES: 'workout_templates',
  TUTORIAL_STATE: 'tutorial_state',
  HOME_VIEW_MODE: 'home_view_mode',
  PENDING_STRENGTH_PROGRESS: 'pending_strength_progress',
  SHOWN_NOTIFICATIONS: 'shown_notifications',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  RETENTION_META: 'retention_meta',
  WEEKLY_GOAL: 'weekly_goal',
  ROUTINE_ADVICE_DISMISSED: 'routine_advice_dismissed',
  SEEN_ACHIEVEMENTS: 'seen_achievements',
  PROFILE_ICON: 'profile_icon',
  UP_NEXT_POINTER: 'up_next_pointer',
  CYCLE_COMPLETED: 'cycle_completed',
} as const;

// Strength progress data for post-workout celebration
export interface PendingStrengthProgress {
  previousPercentile: number;
  newPercentile: number;
  timestamp: number;
}

export type HomeViewMode = 'home' | 'feed';

// User-facing toggles for self-directed retention notifications.
export interface NotificationPreferences {
  streakReminders: boolean;
  habitReminders: boolean;
  /** Latest minute-of-day we'll schedule a reminder (default 21:30 = 1290). */
  quietHoursEndMinute: number;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  streakReminders: true,
  habitReminders: true,
  quietHoursEndMinute: 21 * 60 + 30,
};

// Internal bookkeeping for retention-notification anti-spam (not user-facing).
export interface RetentionMeta {
  /** Date keys (YYYY-MM-DD) we've scheduled a retention reminder for. */
  scheduledDateKeys: string[];
}

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
      const validThemes: ThemeLevel[] = ['beginner', 'beginner_dark', 'intermediate', 'advanced', 'elite', 'god', 'share_warm', 'share_cool', 'winter_2026'];
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

  // Retention notification preferences
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES);
      if (!data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
      // Merge over defaults so newly-added fields get sensible values.
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(data) };
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
  }

  async saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES, JSON.stringify(prefs));
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    }
  }

  // Retention notification anti-spam bookkeeping
  async getRetentionMeta(): Promise<RetentionMeta> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RETENTION_META);
      return data ? JSON.parse(data) : { scheduledDateKeys: [] };
    } catch (error) {
      console.error('Error loading retention meta:', error);
      return { scheduledDateKeys: [] };
    }
  }

  async saveRetentionMeta(meta: RetentionMeta): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.RETENTION_META, JSON.stringify(meta));
    } catch (error) {
      console.error('Error saving retention meta:', error);
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
  async saveNoteSession(session: { noteText: string; startTime: Date; routineId?: string | null; draft?: unknown; manuallyStarted?: boolean }): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_NOTE_SESSION, JSON.stringify({
        noteText: session.noteText,
        startTime: session.startTime.toISOString(),
        routineId: session.routineId || null,
        // The structured draft preserves per-set check-off (done) across restarts.
        draft: session.draft ?? null,
        manuallyStarted: session.manuallyStarted ?? false,
      }));
    } catch (error) {
      console.error('Error saving note session:', error);
    }
  }

  async getNoteSession(): Promise<{ noteText: string; startTime: Date; routineId: string | null; draft: unknown; manuallyStarted: boolean } | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_NOTE_SESSION);
      if (!data) return null;

      const session = JSON.parse(data);
      return {
        noteText: session.noteText,
        startTime: new Date(session.startTime),
        routineId: session.routineId || null,
        draft: session.draft ?? null,
        manuallyStarted: !!session.manuallyStarted,
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
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);
      if (!data) return [];

      const routines = JSON.parse(data) as (Omit<Routine, 'createdAt' | 'lastUsed'> & { createdAt: string; lastUsed?: string })[];
      // Convert date strings back to Date objects
      return routines.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        lastUsed: r.lastUsed ? new Date(r.lastUsed) : undefined,
      }));
    } catch (error) {
      console.error('Error loading routines:', error);
      return [];
    }
  }

  async saveRoutine(routine: Routine): Promise<void> {
    try {
      const routines = await this.getRoutines();

      // Check if routine with same ID already exists
      const existingIndex = routines.findIndex(r => r.id === routine.id);

      if (existingIndex >= 0) {
        // Update existing routine, preserve createdAt
        routines[existingIndex] = {
          ...routine,
          createdAt: routines[existingIndex].createdAt,
        };
      } else {
        // Add new routine with current timestamp
        routines.push({
          ...routine,
          createdAt: routine.createdAt || new Date(),
        });
      }

      await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    } catch (error) {
      console.error('Error saving routine:', error);
    }
  }

  async updateRoutineLastUsed(routineId: string): Promise<void> {
    try {
      const routines = await this.getRoutines();
      const routine = routines.find(r => r.id === routineId);
      if (routine) {
        routine.lastUsed = new Date();
        await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
      }
    } catch (error) {
      console.error('Error updating routine last used:', error);
    }
  }

  // The day the up-next ring currently points at, or null to start from the
  // top of the program. Flipping on the home dashboard sets this; finishing a
  // workout advances it (see advanceUpNext).
  async getUpNextPointerId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.UP_NEXT_POINTER);
    } catch (error) {
      console.error('Error loading up-next pointer:', error);
      return null;
    }
  }

  async setUpNextPointerId(routineId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.UP_NEXT_POINTER, routineId);
    } catch (error) {
      console.error('Error saving up-next pointer:', error);
    }
  }

  // Day ids the user has actually trained in the current cycle — drives the
  // "completed" checkmarks and the cycle progress bar. Only finishing a workout
  // adds to this (see recordDayTrained); flipping the up-next pointer does not.
  async getCycleCompletedIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CYCLE_COMPLETED);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error loading cycle completed days:', error);
      return [];
    }
  }

  // Record that a day was trained: advance the up-next pointer to the next day
  // (wrapping at the end) and add the day to the cycle's completed set. Once
  // every day in the program has been trained, the set resets so a fresh cycle
  // begins. Called on workout completion — never on a manual flip.
  async recordDayTrained(trainedRoutineId: string): Promise<void> {
    try {
      const [routines, programs] = await Promise.all([this.getRoutines(), this.getPrograms()]);
      const ringIds = getUpNextCandidates(routines, programs).map(r => r.id);

      const next = getNextInCycle(routines, programs, trainedRoutineId);
      if (next) await AsyncStorage.setItem(STORAGE_KEYS.UP_NEXT_POINTER, next.id);

      const prev = await this.getCycleCompletedIds();
      const done = new Set(prev.filter(id => ringIds.includes(id)));
      done.add(trainedRoutineId);
      // Whole program trained → reset to an empty cycle.
      const completed = ringIds.length > 0 && ringIds.every(id => done.has(id)) ? [] : Array.from(done);
      await AsyncStorage.setItem(STORAGE_KEYS.CYCLE_COMPLETED, JSON.stringify(completed));
    } catch (error) {
      console.error('Error recording trained day:', error);
    }
  }

  async deleteRoutine(routineId: string): Promise<void> {
    const routines = await this.getRoutines();
    const filtered = routines.filter(r => r.id !== routineId);
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(filtered));
  }

  // Remove every routine and clear the current-routine pointer.
  async clearAllRoutines(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify([]));
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_ROUTINE);
  }

  // Programs ---------------------------------------------------------------
  // A program groups the day-routines created together. Exactly one program is
  // 'active' at a time; its days are the user's active rotation.

  async getPrograms(): Promise<Program[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROGRAMS);
      if (!data) return [];
      const programs = JSON.parse(data) as (Omit<Program, 'createdAt'> & { createdAt: string })[];
      return programs.map(p => ({ ...p, createdAt: new Date(p.createdAt) }));
    } catch (error) {
      console.error('Error loading programs:', error);
      return [];
    }
  }

  private async savePrograms(programs: Program[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs));
  }

  async saveProgram(program: Program): Promise<void> {
    try {
      const programs = await this.getPrograms();
      const existingIndex = programs.findIndex(p => p.id === program.id);
      if (existingIndex >= 0) {
        programs[existingIndex] = { ...program, createdAt: programs[existingIndex].createdAt };
      } else {
        programs.push({ ...program, createdAt: program.createdAt || new Date() });
      }
      await this.savePrograms(programs);
    } catch (error) {
      console.error('Error saving program:', error);
    }
  }

  /**
   * Make one program active: pause every other non-archived program and sync each
   * program's day-routines' isActive flag to whether their program is now active.
   * Standalone routines (no programId) are left untouched.
   */
  async setActiveProgram(programId: string): Promise<void> {
    try {
      const programs = await this.getPrograms();
      for (const p of programs) {
        if (p.id === programId) p.status = 'active';
        else if (p.status === 'active') p.status = 'paused';
      }
      await this.savePrograms(programs);
      await this.syncRoutineActiveFlags(programs);
    } catch (error) {
      console.error('Error setting active program:', error);
    }
  }

  /** Set a program's status (paused/archived/active) and sync its routines. */
  async setProgramStatus(programId: string, status: Program['status']): Promise<void> {
    if (status === 'active') return this.setActiveProgram(programId);
    try {
      const programs = await this.getPrograms();
      const program = programs.find(p => p.id === programId);
      if (!program) return;
      program.status = status;
      await this.savePrograms(programs);
      await this.syncRoutineActiveFlags(programs);
    } catch (error) {
      console.error('Error setting program status:', error);
    }
  }

  /** Delete a program and all of its day-routines. */
  async deleteProgram(programId: string): Promise<void> {
    try {
      const programs = (await this.getPrograms()).filter(p => p.id !== programId);
      await this.savePrograms(programs);
      const routines = (await this.getRoutines()).filter(r => r.programId !== programId);
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    } catch (error) {
      console.error('Error deleting program:', error);
    }
  }

  /**
   * Add a new day-routine to an existing program: stamps it with the programId,
   * places it at the end of the day order, matches the program's active state, and
   * keeps the program's `days` count in sync with the actual number of days.
   */
  async addProgramDay(programId: string, routine: Routine): Promise<void> {
    try {
      const programs = await this.getPrograms();
      const program = programs.find(p => p.id === programId);
      if (!program) return;

      const routines = await this.getRoutines();
      const dayRoutines = routines.filter(r => r.programId === programId);
      const maxOrder = dayRoutines.reduce((m, r) => Math.max(m, r.order ?? -1), -1);

      const day: Routine = {
        ...routine,
        programId,
        order: maxOrder + 1,
        isActive: program.status === 'active',
      };
      await this.saveRoutine(day);

      program.days = dayRoutines.length + 1;
      await this.savePrograms(programs);
    } catch (error) {
      console.error('Error adding program day:', error);
    }
  }

  /**
   * Persist a user-chosen day order within a program. `orderedDayIds` is the
   * program's day-routine ids in their new top-to-bottom order; each gets an
   * `order` matching its index so day lists sort by it everywhere.
   */
  async reorderProgramDays(programId: string, orderedDayIds: string[]): Promise<void> {
    try {
      const routines = await this.getRoutines();
      const rank = new Map(orderedDayIds.map((id, i) => [id, i]));
      for (const r of routines) {
        if (r.programId === programId && rank.has(r.id)) r.order = rank.get(r.id);
      }
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    } catch (error) {
      console.error('Error reordering program days:', error);
    }
  }

  /** Mirror each programmed routine's isActive flag onto whether its program is active. */
  private async syncRoutineActiveFlags(programs: Program[]): Promise<void> {
    const statusById = new Map(programs.map(p => [p.id, p.status]));
    const routines = await this.getRoutines();
    let changed = false;
    for (const r of routines) {
      if (!r.programId) continue;  // leave standalone routines alone
      const active = statusById.get(r.programId) === 'active';
      if (r.isActive !== active) { r.isActive = active; changed = true; }
    }
    if (changed) await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
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

  // Home View Mode
  async saveHomeViewMode(mode: HomeViewMode): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HOME_VIEW_MODE, mode);
    } catch (error) {
      console.error('Error saving home view mode:', error);
    }
  }

  async getHomeViewMode(): Promise<HomeViewMode> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HOME_VIEW_MODE);
      if (data === 'home' || data === 'feed') {
        return data;
      }
      return 'home'; // Default to home
    } catch (error) {
      console.error('Error loading home view mode:', error);
      return 'home';
    }
  }

  // Weekly training-day goal (days/week target shown on the home dashboard).
  async getWeeklyGoal(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_GOAL);
      const parsed = data ? parseInt(data, 10) : NaN;
      if (Number.isFinite(parsed)) {
        return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, parsed));
      }
      return DEFAULT_WEEKLY_GOAL;
    } catch (error) {
      console.error('Error loading weekly goal:', error);
      return DEFAULT_WEEKLY_GOAL;
    }
  }

  async saveWeeklyGoal(goal: number): Promise<void> {
    try {
      const clamped = Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, Math.round(goal)));
      await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_GOAL, String(clamped));
    } catch (error) {
      console.error('Error saving weekly goal:', error);
    }
  }

  // Timestamp (ms) the user last dismissed the "build a routine" home nudge, or
  // null if never. The home card re-surfaces the nudge after a cooldown.
  async getRoutineAdviceDismissedAt(): Promise<number | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINE_ADVICE_DISMISSED);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : null;
    } catch (error) {
      console.error('Error loading routine advice flag:', error);
      return null;
    }
  }

  async setRoutineAdviceDismissedAt(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTINE_ADVICE_DISMISSED, String(timestamp));
    } catch (error) {
      console.error('Error saving routine advice flag:', error);
    }
  }

  // Achievement IDs the user has already seen unlocked (so newly-earned ones can
  // be highlighted on the Career card and cleared once viewed).
  async getSeenAchievements(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SEEN_ACHIEVEMENTS);
      const parsed = data ? JSON.parse(data) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error loading seen achievements:', error);
      return [];
    }
  }

  async setSeenAchievements(ids: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SEEN_ACHIEVEMENTS, JSON.stringify(ids));
    } catch (error) {
      console.error('Error saving seen achievements:', error);
    }
  }


  // The career emblem id the user picked (null if never chosen).
  async getProfileIconId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PROFILE_ICON);
    } catch (error) {
      console.error('Error loading profile icon:', error);
      return null;
    }
  }

  async setProfileIconId(id: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE_ICON, id);
    } catch (error) {
      console.error('Error saving profile icon:', error);
    }
  }

  // Pending Strength Progress (for post-workout celebration)
  async savePendingStrengthProgress(progress: PendingStrengthProgress): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_STRENGTH_PROGRESS,
        JSON.stringify(progress)
      );
    } catch (error) {
      console.error('Error saving pending strength progress:', error);
    }
  }

  async getPendingStrengthProgress(): Promise<PendingStrengthProgress | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_STRENGTH_PROGRESS);
      if (data) {
        const progress = JSON.parse(data) as PendingStrengthProgress;
        // Only return if less than 24 hours old
        if (Date.now() - progress.timestamp < 24 * 60 * 60 * 1000) {
          return progress;
        }
        // Clear stale data
        await this.clearPendingStrengthProgress();
      }
      return null;
    } catch (error) {
      console.error('Error loading pending strength progress:', error);
      return null;
    }
  }

  async clearPendingStrengthProgress(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_STRENGTH_PROGRESS);
    } catch (error) {
      console.error('Error clearing pending strength progress:', error);
    }
  }

  // Shown Notifications (for one-time unlock notifications)
  async getShownNotifications(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SHOWN_NOTIFICATIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading shown notifications:', error);
      return [];
    }
  }

  async markNotificationShown(notificationId: string): Promise<void> {
    try {
      const shown = await this.getShownNotifications();
      if (!shown.includes(notificationId)) {
        shown.push(notificationId);
        await AsyncStorage.setItem(STORAGE_KEYS.SHOWN_NOTIFICATIONS, JSON.stringify(shown));
      }
    } catch (error) {
      console.error('Error marking notification as shown:', error);
    }
  }

  async hasNotificationBeenShown(notificationId: string): Promise<boolean> {
    try {
      const shown = await this.getShownNotifications();
      return shown.includes(notificationId);
    } catch (error) {
      console.error('Error checking notification status:', error);
      return false;
    }
  }
}

export const storageService = new StorageService();