import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/lib/analytics';
import { storageService } from '@/lib/storage';
import { userService } from '@/lib/userService';
import { userSyncService } from '@/lib/userSyncService';
import { getWorkoutById } from '@/lib/workouts';
import { ParsedExerciseSummary, ParsedWorkout, workoutNoteParser } from '@/lib/workoutNoteParser';
import { isMainLift, UserLift, WeightUnit } from '@/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, AppStateStatus, Keyboard } from 'react-native';

export interface UseWorkoutNoteSessionReturn {
  // Note state
  noteText: string;
  setNoteText: (text: string) => void;

  // Timer state
  elapsedTime: number;
  workoutStartTime: Date | null;
  formatTime: (seconds: number) => string;
  resetWorkoutTimer: () => void;

  // Quick summary
  showSummary: boolean;
  setShowSummary: (show: boolean) => void;
  summaryLoading: boolean;
  parsedExercises: ParsedExerciseSummary[];
  handleQuickSummary: () => Promise<void>;

  // Finish workout
  showFinishModal: boolean;
  setShowFinishModal: (show: boolean) => void;
  handleFinishWorkout: () => void;
  handleSaveWorkout: (parsedWorkout: ParsedWorkout) => Promise<void>;
  handleFinishComplete: () => Promise<void>;
  handleFinishCancel: () => void;

  // Session state
  isSessionLoaded: boolean;
  hasWorkoutStarted: boolean;
  weightUnit: WeightUnit;
}

export function useWorkoutNoteSession(): UseWorkoutNoteSessionReturn {
  const { refreshProfile } = useUser();

  // Workout note state
  const [noteText, setNoteText] = useState('');
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Quick summary state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [parsedExercises, setParsedExercises] = useState<ParsedExerciseSummary[]>([]);

  // Finish modal state
  const [showFinishModal, setShowFinishModal] = useState(false);

  // User preferences
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Calculate elapsed time from start time (works even after app restart)
  const calculateElapsedTime = useCallback((startTime: Date | null): number => {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime.getTime()) / 1000);
  }, []);

  // Load saved session and user preferences on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load user preferences
        const profile = await userService.getRealUserProfile();
        if (profile?.weightUnitPreference) {
          setWeightUnit(profile.weightUnitPreference);
        }

        // Load saved note session
        const savedSession = await storageService.getNoteSession();
        if (savedSession && savedSession.noteText) {
          setNoteText(savedSession.noteText);
          setWorkoutStartTime(savedSession.startTime);
          setElapsedTime(calculateElapsedTime(savedSession.startTime));
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsSessionLoaded(true);
      }
    };
    loadInitialData();
  }, [calculateElapsedTime]);

  // Save session whenever noteText or workoutStartTime changes
  useEffect(() => {
    if (!isSessionLoaded) return; // Don't save until we've loaded

    const saveSession = async () => {
      if (noteText && workoutStartTime) {
        await storageService.saveNoteSession({
          noteText,
          startTime: workoutStartTime,
        });
      } else if (!noteText) {
        // Clear session if note is empty
        await storageService.clearNoteSession();
      }
    };
    saveSession();
  }, [noteText, workoutStartTime, isSessionLoaded]);

  // Start timer when user starts typing, reset when text is cleared
  useEffect(() => {
    if (!isSessionLoaded) return; // Wait for session to load

    if (noteText.length > 0 && !workoutStartTime) {
      setWorkoutStartTime(new Date());
    } else if (noteText.length === 0 && workoutStartTime) {
      // User backspaced all text - reset workout state
      setWorkoutStartTime(null);
      setElapsedTime(0);
      setParsedExercises([]);
    }
  }, [noteText, workoutStartTime, isSessionLoaded]);

  // Timer tick - runs when screen is active
  useEffect(() => {
    if (!workoutStartTime) return;

    // Update immediately
    setElapsedTime(calculateElapsedTime(workoutStartTime));

    const interval = setInterval(() => {
      setElapsedTime(calculateElapsedTime(workoutStartTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [workoutStartTime, calculateElapsedTime]);

  // Update timer when screen comes into focus (after switching tabs)
  useFocusEffect(
    useCallback(() => {
      if (workoutStartTime) {
        setElapsedTime(calculateElapsedTime(workoutStartTime));
      }
    }, [workoutStartTime, calculateElapsedTime])
  );

  // Update timer when app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && workoutStartTime) {
        setElapsedTime(calculateElapsedTime(workoutStartTime));
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [workoutStartTime, calculateElapsedTime]);

  // Format elapsed time
  const formatTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle quick summary
  const handleQuickSummary = useCallback(async () => {
    if (!noteText.trim()) {
      Alert.alert('No workout data', 'Start typing your workout to see a summary.');
      return;
    }

    Keyboard.dismiss();
    setSummaryLoading(true);
    setShowSummary(true);

    try {
      const parsed = await workoutNoteParser.parseWorkoutNote(noteText);
      const summary = workoutNoteParser.toSummary(parsed);
      setParsedExercises(summary);
    } catch (error) {
      console.error('Error parsing workout:', error);
      setParsedExercises([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [noteText]);

  // Handle finish workout - open finish modal
  const handleFinishWorkout = useCallback(() => {
    if (!noteText.trim()) {
      Alert.alert('No workout data', 'Add some exercises before finishing your workout.');
      return;
    }
    Keyboard.dismiss();
    setShowFinishModal(true);
  }, [noteText]);

  // Handle save from finish modal
  const handleSaveWorkout = useCallback(async (parsedWorkout: ParsedWorkout) => {
    // Convert to duration in minutes
    const durationMinutes = Math.ceil(elapsedTime / 60);

    // Convert to GeneratedWorkout format (also auto-creates custom exercises)
    const generatedWorkout = await workoutNoteParser.toGeneratedWorkoutWithCustomExercises(parsedWorkout, durationMinutes);

    // Save to workout history
    await storageService.saveWorkout(generatedWorkout);

    // Record lifts for progress tracking
    const liftsToSync: UserLift[] = [];
    for (const exercise of generatedWorkout.exercises) {
      if (exercise.completedSets.length > 0) {
        // Find the best set (highest estimated 1RM)
        const bestSet = exercise.completedSets.reduce((best, current) => {
          const bestOneRM = best.weight * (1 + best.reps / 30);
          const currentOneRM = current.weight * (1 + current.reps / 30);
          return currentOneRM > bestOneRM ? current : best;
        });

        // Only record lifts with actual weight
        if (bestSet.weight > 0) {
          // Use proper type guard to categorize lifts correctly
          const liftType = isMainLift(exercise.id) ? 'main' : 'secondary';
          const liftData: UserLift = {
            parentId: generatedWorkout.id,
            id: exercise.id,
            weight: bestSet.weight,
            reps: bestSet.reps,
            unit: bestSet.unit,
            dateRecorded: new Date(),
          };
          await userService.recordLift(liftData, liftType);
          liftsToSync.push(liftData);
        }
      }
    }

    // Sync lifts to Supabase for leaderboard (excluding custom exercises)
    const liftsToSyncFiltered = liftsToSync.filter(lift => getWorkoutById(lift.id) !== null);
    if (liftsToSyncFiltered.length > 0) {
      userSyncService.syncLifts(liftsToSyncFiltered).catch(err => {
        console.error('Error syncing lifts to Supabase:', err);
      });
    }

    // Always sync overall percentile data (includes ALL user's lifts, not just this workout)
    userSyncService.calculateAndSyncPercentiles().catch(err => {
      console.error('Error syncing percentile data:', err);
    });

    // Refresh user profile context so other screens get updated data
    await refreshProfile();

    // Track workout completion analytics
    const totalSets = generatedWorkout.exercises.reduce(
      (sum, ex) => sum + ex.completedSets.length,
      0
    );
    analyticsService.trackWorkoutCompleted({
      workoutId: generatedWorkout.id,
      exerciseCount: generatedWorkout.exercises.length,
      totalSets,
      durationSeconds: elapsedTime,
    });
  }, [elapsedTime, refreshProfile]);

  // Handle finish modal complete - reset workout state
  const handleFinishComplete = useCallback(async () => {
    setShowFinishModal(false);
    setNoteText('');
    setWorkoutStartTime(null);
    setElapsedTime(0);
    setParsedExercises([]);
    // Clear saved session
    await storageService.clearNoteSession();
  }, []);

  // Handle cancel from finish modal
  const handleFinishCancel = useCallback(() => {
    setShowFinishModal(false);
  }, []);

  // Handle reset workout timer
  const resetWorkoutTimer = useCallback(() => {
    setWorkoutStartTime(new Date());
    setElapsedTime(0);
  }, []);

  // Workout has started only if there's text
  const hasWorkoutStarted = noteText.length > 0;

  return {
    // Note state
    noteText,
    setNoteText,

    // Timer state
    elapsedTime,
    workoutStartTime,
    formatTime,
    resetWorkoutTimer,

    // Quick summary
    showSummary,
    setShowSummary,
    summaryLoading,
    parsedExercises,
    handleQuickSummary,

    // Finish workout
    showFinishModal,
    setShowFinishModal,
    handleFinishWorkout,
    handleSaveWorkout,
    handleFinishComplete,
    handleFinishCancel,

    // Session state
    isSessionLoaded,
    hasWorkoutStarted,
    weightUnit,
  };
}
