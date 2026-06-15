import { useAlert } from '@/components/CustomAlert';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/lib/services/analytics';
import { notificationService } from '@/lib/services/notificationService';
import { retentionNotificationService } from '@/lib/services/retentionNotificationService';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { userSyncService } from '@/lib/services/userSyncService';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { getWorkoutById } from '@/lib/workout/workouts';
import { ParsedExerciseSummary, ParsedWorkout, workoutNoteParser } from '@/lib/workout/workoutNoteParser';
import { updateRoutineProgression } from '@/lib/workout/routineProgression';
import { FEATURED_SECONDARY_LIFTS, isMainLift, UserLift, WeightUnit } from '@/types';
import { getPendingRoutine, getPendingRoutineId } from '@/lib/workout/pendingRoutine';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Keyboard } from 'react-native';

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
  const { showAlert } = useAlert();

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

  // Track which routine this workout is from (for UP NEXT cycling)
  const [startedRoutineId, setStartedRoutineId] = useState<string | null>(null);

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

        // Load saved note session. Any pending routine the user just started is
        // consumed by the focus effect below (which runs every time the screen
        // is focused, not just on mount), so it overrides this restore.
        const savedSession = await storageService.getNoteSession();
        if (savedSession && savedSession.noteText) {
          setNoteText(savedSession.noteText);
          setWorkoutStartTime(savedSession.startTime);
          setElapsedTime(calculateElapsedTime(savedSession.startTime));
          if (savedSession.routineId) {
            setStartedRoutineId(savedSession.routineId);
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsSessionLoaded(true);
      }
    };
    loadInitialData();
  }, [calculateElapsedTime]);

  // Consume any routine the user just started (text + id) on every focus, not
  // just on mount. The Workout tab stays mounted, so a mount-only read meant the
  // second (and every later) routine started from Home/Routines never attached
  // its id here — completing it then failed to update progression or lastUsed,
  // which broke "Up Next" cycling when training out of order.
  useFocusEffect(
    useCallback(() => {
      const text = getPendingRoutine();
      if (text !== null) {
        setNoteText(text);
        // A routine launch always carries an id; a plain freestyle launch never
        // reaches here (it sets no pending text), so this won't clear an id by
        // accident. Read the id regardless to keep the pending slot clean.
        setStartedRoutineId(getPendingRoutineId());
      }
    }, [])
  );

  // Save session whenever noteText, workoutStartTime, or routineId changes
  useEffect(() => {
    if (!isSessionLoaded) return; // Don't save until we've loaded

    const saveSession = async () => {
      if (noteText && workoutStartTime) {
        await storageService.saveNoteSession({
          noteText,
          startTime: workoutStartTime,
          routineId: startedRoutineId,
        });
      } else if (!noteText) {
        // Clear session if note is empty
        await storageService.clearNoteSession();
      }
    };
    saveSession();
  }, [noteText, workoutStartTime, startedRoutineId, isSessionLoaded]);

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

  // Update timer and recover state when app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Always update elapsed time if workout is active
        if (workoutStartTime) {
          setElapsedTime(calculateElapsedTime(workoutStartTime));
        }

        // Check if state was lost during background transition and recover from storage
        // This handles the edge case where component state gets reset but storage still has data
        if (!noteText && isSessionLoaded) {
          const savedSession = await storageService.getNoteSession();
          if (savedSession?.noteText) {
            setNoteText(savedSession.noteText);
            setWorkoutStartTime(savedSession.startTime);
            setElapsedTime(calculateElapsedTime(savedSession.startTime));
            // Also recover routine ID if it was lost
            if (savedSession.routineId) {
              setStartedRoutineId(savedSession.routineId);
            }
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [workoutStartTime, noteText, isSessionLoaded, calculateElapsedTime]);

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
      showAlert({ title: 'No workout data', message: 'Start typing your workout to see a summary.', type: 'info' });
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
  }, [noteText, showAlert]);

  // Handle finish workout - open finish modal
  const handleFinishWorkout = useCallback(() => {
    if (!noteText.trim()) {
      showAlert({ title: 'No workout data', message: 'Add some exercises before finishing your workout.', type: 'info' });
      return;
    }
    Keyboard.dismiss();
    setShowFinishModal(true);
  }, [noteText, showAlert]);

  // Handle save from finish modal
  const handleSaveWorkout = useCallback(async (parsedWorkout: ParsedWorkout) => {
    // Convert to duration in minutes
    const durationMinutes = Math.ceil(elapsedTime / 60);

    // Convert to GeneratedWorkout format (also auto-creates custom exercises)
    // Pass routineId if this workout was started from a routine
    const generatedWorkout = await workoutNoteParser.toGeneratedWorkoutWithCustomExercises(
      parsedWorkout,
      durationMinutes,
      startedRoutineId || undefined
    );

    // Save to workout history
    await storageService.saveWorkout(generatedWorkout);

    // The user just trained — re-evaluate retention reminders so today's
    // streak/habit nudge is cancelled (they no longer need it).
    retentionNotificationService.refreshScheduledReminders().catch(() => {});

    // Update routine progression if this was from a routine
    if (startedRoutineId) {
      try {
        const routines = await storageService.getRoutines();
        const routine = routines.find(r => r.id === startedRoutineId);
        if (routine) {
          const updatedRoutine = updateRoutineProgression(routine, generatedWorkout, weightUnit);
          await storageService.saveRoutine(updatedRoutine);
        }
      } catch (error) {
        console.error('Error updating routine progression:', error);
      }
    }

    // Get current progress (PRs) before recording new lifts - for notifications AND strength animation
    // Use getAllFeaturedLifts to include both main AND secondary lifts (matching home screen calculation)
    const currentProgress = await userService.getAllFeaturedLifts();

    // Capture the BEFORE overall percentile for post-workout animation
    const beforePercentiles = currentProgress.map(p => p.percentileRanking).filter(p => p > 0);
    const beforeOverallPercentile = beforePercentiles.length > 0 ? calculateOverallPercentile(beforePercentiles) : 0;
    const currentPRMap: Record<string, number> = {};
    currentProgress.forEach(p => {
      currentPRMap[p.workoutId] = p.personalRecord;
    });

    // Record lifts for progress tracking and count PRs
    const liftsToSync: UserLift[] = [];
    const newPRs: { exerciseId: string; exerciseName: string; newPR: number; previousPR: number }[] = [];

    // Prepare lift data for all exercises first
    const liftDataWithMeta: { liftData: UserLift; liftType: 'main' | 'secondary'; exercise: typeof generatedWorkout.exercises[0]; previousPR: number }[] = [];

    for (const exercise of generatedWorkout.exercises) {
      if (exercise.completedSets.length > 0) {
        // Find the best set (highest estimated 1RM)
        const bestSet = exercise.completedSets.reduce((best, current) => {
          const bestOneRM = OneRMCalculator.estimate(best.weight, best.reps);
          const currentOneRM = OneRMCalculator.estimate(current.weight, current.reps);
          return currentOneRM > bestOneRM ? current : best;
        });

        // Only record lifts with actual weight
        if (bestSet.weight > 0) {
          const liftType = isMainLift(exercise.id) ? 'main' : 'secondary';
          const liftData: UserLift = {
            parentId: generatedWorkout.id,
            id: exercise.id,
            weight: bestSet.weight,
            reps: bestSet.reps,
            unit: bestSet.unit,
            dateRecorded: new Date(),
          };
          const previousPR = currentPRMap[exercise.id] || 0;
          liftDataWithMeta.push({ liftData, liftType, exercise, previousPR });
          liftsToSync.push(liftData);
        }
      }
    }

    // Record all lifts in a single atomic operation to avoid race conditions
    // (Previously this used Promise.all which caused lifts to be lost due to concurrent profile writes)
    const recordResults = await userService.recordLifts(
      liftDataWithMeta.map(({ liftData, liftType }) => ({ lift: liftData, liftType }))
    );

    // Build a map of liftId -> isNewPR for quick lookup
    const prResultMap = new Map(recordResults.map(r => [r.liftId, r.isNewPR]));

    // Process PR results
    let prCount = 0;
    for (const { liftData, exercise, previousPR } of liftDataWithMeta) {
      const isNewPR = prResultMap.get(liftData.id) || false;
      if (isNewPR) {
        prCount++;
        const workoutInfo = getWorkoutById(exercise.id);
        if (workoutInfo) {
          const newPR = OneRMCalculator.estimate(liftData.weight, liftData.reps);
          newPRs.push({
            exerciseId: exercise.id,
            exerciseName: workoutInfo.name,
            newPR,
            previousPR: Math.round(previousPR),
          });
        }
      }
    }

    // Notify friends about PRs for main lifts + hip thrust only (fire and forget)
    for (const pr of newPRs) {
      const isNotificationWorthy = isMainLift(pr.exerciseId) || pr.exerciseId === FEATURED_SECONDARY_LIFTS.HIP_THRUST_BARBELL;
      if (isNotificationWorthy) {
        notificationService.notifyFriendsOfPR(pr.exerciseId, pr.exerciseName, pr.newPR, pr.previousPR).catch(err => {
          console.error('Error notifying friends of PR:', err);
        });
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

    // Sync workout to Supabase for social viewing (include PR count)
    userSyncService.syncWorkout(generatedWorkout, elapsedTime, prCount).catch(err => {
      console.error('Error syncing workout to Supabase:', err);
    });

    // Refresh user profile context so other screens get updated data (fire-and-forget)
    refreshProfile().catch(err => {
      console.error('Error refreshing profile:', err);
    });

    // Calculate NEW percentile after recording lifts
    // Use getAllFeaturedLifts to include both main AND secondary lifts (matching home screen calculation)
    const afterProgress = await userService.getAllFeaturedLifts();
    const afterPercentiles = afterProgress.map(p => p.percentileRanking).filter(p => p > 0);
    const afterOverallPercentile = afterPercentiles.length > 0 ? calculateOverallPercentile(afterPercentiles) : 0;

    // Save strength progress to storage for home screen celebration
    // Only save if there's an actual change
    if (afterOverallPercentile !== beforeOverallPercentile) {
      console.log('[useWorkoutNoteSession] Saving strength progress:', {
        before: beforeOverallPercentile,
        after: afterOverallPercentile,
      });
      await storageService.savePendingStrengthProgress({
        previousPercentile: beforeOverallPercentile,
        newPercentile: afterOverallPercentile,
        timestamp: Date.now(),
      });
    }

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

    // Record the training time (for "last trained" display), mark the day done
    // for this cycle, and advance the up-next ring to the next day.
    if (startedRoutineId) {
      await storageService.updateRoutineLastUsed(startedRoutineId);
      await storageService.recordDayTrained(startedRoutineId);
    }
  }, [elapsedTime, refreshProfile, startedRoutineId, weightUnit]);

  // Handle finish modal complete - reset workout state
  const handleFinishComplete = useCallback(async () => {
    setShowFinishModal(false);
    setNoteText('');
    setWorkoutStartTime(null);
    setElapsedTime(0);
    setParsedExercises([]);
    setStartedRoutineId(null);
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
