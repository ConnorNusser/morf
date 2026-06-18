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
import { workoutToNoteText } from '@/lib/workout/workoutNoteFormat';
import {
  DraftSet,
  WorkoutDraft,
  addSet as addSetToDraft,
  draftFromParsed,
  draftToNoteText,
  mergeParsed,
  removeExercise as removeExerciseFromDraft,
  removeSet as removeSetFromDraft,
  updateSet as updateSetInDraft,
} from '@/lib/workout/workoutDraft';
import { updateRoutineProgression } from '@/lib/workout/routineProgression';
import { CustomExercise, FEATURED_SECONDARY_LIFTS, GeneratedWorkout, isMainLift, UserLift, WeightUnit } from '@/types';
import { getPendingRoutine, getPendingRoutineId } from '@/lib/workout/pendingRoutine';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus, Keyboard } from 'react-native';

export interface UseWorkoutNoteSessionReturn {
  // Composer (transient input) + structured draft (the editable source of truth)
  composerText: string;
  setComposerText: (text: string) => void;
  commitComposer: () => Promise<void>;
  commitText: (text: string) => Promise<boolean>; // voice / programmatic entry
  draft: WorkoutDraft;
  loadDraftFromText: (text: string) => void; // plan builder / routine import / voice
  // Direct, traditional-UI edits to the synthesized cards:
  editSet: (key: string, index: number, patch: Partial<DraftSet>) => void;
  addSetTo: (key: string) => void;
  removeSetFrom: (key: string, index: number) => void;
  removeExerciseFrom: (key: string) => void;

  // Derived note text (serialized draft) — feeds the finish/save pipeline.
  noteText: string;

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

  // Repeat-last-workout prefill
  lastWorkoutTitle: string | null; // null when there's nothing to repeat
  prefillLastWorkout: () => void;
}

export function useWorkoutNoteSession(): UseWorkoutNoteSessionReturn {
  const { refreshProfile } = useUser();
  const { showAlert } = useAlert();

  // Structured draft is the source of truth; composer text is transient input.
  const [draft, setDraft] = useState<WorkoutDraft>([]);
  const [composerText, setComposerText] = useState('');
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // The note text the finish/save/persistence pipeline consumes is just the
  // serialized draft — so editing cards or committing the composer both flow
  // through one place.
  const noteText = useMemo(() => draftToNoteText(draft), [draft]);

  // Parse free text into a fresh draft (routine import, plan builder, restore).
  // Local-only (no API calls): a routine template's "Target:/Actual:" lines are
  // folded onto their exercise so the prescription seeds editable working sets.
  const loadDraftFromText = useCallback((text: string) => {
    if (!text.trim()) {
      setDraft([]);
      return;
    }
    const normalized = text.replace(/\n[ \t]*(target|actual)s?:[ \t]*/gi, ' ');
    setDraft(draftFromParsed(workoutNoteParser.parseLocal(normalized)));
  }, []);

  // Parse some text and merge it into the draft. Local parse first (free /
  // instant); only escalate to the AI parser when the local pass reads nothing.
  // Returns true if anything was added. Used by both the composer and voice.
  const commitText = useCallback(async (text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const local = workoutNoteParser.parseLocal(trimmed);
    if (local.exercises.length > 0) {
      setDraft(d => mergeParsed(d, local.exercises));
      return true;
    }
    try {
      const ai = await workoutNoteParser.parseWorkoutNote(trimmed);
      if (ai.exercises.length > 0) {
        setDraft(d => mergeParsed(d, ai.exercises));
        return true;
      }
    } catch {
      // fall through to the hint below
    }
    showAlert({ title: "Couldn't read that", message: 'Try something like "Bench 135x8, 155x6".', type: 'info' });
    return false;
  }, [showAlert]);

  // Commit the composer box: merge what's typed, then clear it on success.
  const commitComposer = useCallback(async () => {
    const ok = await commitText(composerText);
    if (ok) setComposerText('');
  }, [commitText, composerText]);

  // Traditional-UI edits to the synthesized cards.
  const editSet = useCallback((key: string, index: number, patch: Partial<DraftSet>) => {
    setDraft(d => updateSetInDraft(d, key, index, patch));
  }, []);
  const addSetTo = useCallback((key: string) => setDraft(d => addSetToDraft(d, key)), []);
  const removeSetFrom = useCallback((key: string, index: number) => setDraft(d => removeSetFromDraft(d, key, index)), []);
  const removeExerciseFrom = useCallback((key: string) => setDraft(d => removeExerciseFromDraft(d, key)), []);

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

  // Most recent saved workout, kept around so the user can repeat it in one tap.
  const [lastWorkout, setLastWorkout] = useState<GeneratedWorkout | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);

  // Pull the newest saved workout (+ custom exercises for name resolution) so
  // "repeat last workout" can pre-fill the note box. Refreshed on focus too,
  // so the day after a session the prefill reflects what was just logged.
  const refreshLastWorkout = useCallback(async () => {
    try {
      const [history, custom] = await Promise.all([
        storageService.getWorkoutHistory(),
        storageService.getCustomExercises(),
      ]);
      const newest = history.reduce<GeneratedWorkout | null>((latest, w) => {
        return !latest || new Date(w.createdAt) > new Date(latest.createdAt) ? w : latest;
      }, null);
      setLastWorkout(newest);
      setCustomExercises(custom);
    } catch (error) {
      console.error('Error loading last workout for prefill:', error);
    }
  }, []);

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
          loadDraftFromText(savedSession.noteText);
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
    refreshLastWorkout();
  }, [calculateElapsedTime, refreshLastWorkout, loadDraftFromText]);

  // Consume any routine the user just started (text + id) on every focus, not
  // just on mount. The Workout tab stays mounted, so a mount-only read meant the
  // second (and every later) routine started from Home/Routines never attached
  // its id here — completing it then failed to update progression or lastUsed,
  // which broke "Up Next" cycling when training out of order.
  useFocusEffect(
    useCallback(() => {
      const text = getPendingRoutine();
      if (text !== null) {
        loadDraftFromText(text);
        // A routine launch always carries an id; a plain freestyle launch never
        // reaches here (it sets no pending text), so this won't clear an id by
        // accident. Read the id regardless to keep the pending slot clean.
        setStartedRoutineId(getPendingRoutineId());
      }
    }, [loadDraftFromText])
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
            loadDraftFromText(savedSession.noteText);
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
  }, [workoutStartTime, noteText, isSessionLoaded, calculateElapsedTime, loadDraftFromText]);

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
    setDraft([]);
    setComposerText('');
    setWorkoutStartTime(null);
    setElapsedTime(0);
    setParsedExercises([]);
    setStartedRoutineId(null);
    // Clear saved session
    await storageService.clearNoteSession();
    // The just-finished session is now the one to repeat next time.
    refreshLastWorkout();
  }, [refreshLastWorkout]);

  // Handle cancel from finish modal
  const handleFinishCancel = useCallback(() => {
    setShowFinishModal(false);
  }, []);

  // Handle reset workout timer
  const resetWorkoutTimer = useCallback(() => {
    setWorkoutStartTime(new Date());
    setElapsedTime(0);
  }, []);

  // Pre-fill the draft with the most recent workout so the user can repeat it
  // and just tweak the numbers — the freeform answer to Hevy's prefilled rows.
  const lastWorkoutNote = lastWorkout ? workoutToNoteText(lastWorkout, customExercises) : '';
  const lastWorkoutTitle = lastWorkoutNote ? (lastWorkout?.title || 'last workout') : null;

  const prefillLastWorkout = useCallback(() => {
    if (!lastWorkoutNote) return;
    loadDraftFromText(lastWorkoutNote);
    // A repeat is freestyle — it isn't advancing a routine's up-next cycle.
    setStartedRoutineId(null);
    if (!workoutStartTime) setWorkoutStartTime(new Date());
  }, [lastWorkoutNote, workoutStartTime, loadDraftFromText]);

  // A workout is underway once the draft has anything in it.
  const hasWorkoutStarted = draft.length > 0;

  return {
    // Composer + structured draft
    composerText,
    setComposerText,
    commitComposer,
    commitText,
    draft,
    loadDraftFromText,
    editSet,
    addSetTo,
    removeSetFrom,
    removeExerciseFrom,
    noteText,

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

    // Repeat-last-workout prefill
    lastWorkoutTitle,
    prefillLastWorkout,
  };
}
