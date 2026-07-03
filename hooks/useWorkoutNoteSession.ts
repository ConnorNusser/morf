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
  ReferenceSource,
  WorkoutDraft,
  addNamedExercise,
  addSet as addSetToDraft,
  applyReference as applyReferenceInDraft,
  attachPrevious,
  buildDraft,
  draftToNoteText,
  mergeParsed,
  removeExercise as removeExerciseFromDraft,
  removeSet as removeSetFromDraft,
  toggleSetDone as toggleSetDoneInDraft,
  updateSet as updateSetInDraft,
} from '@/lib/workout/workoutDraft';
import { getLastSetsFor } from '@/lib/workout/autofill';
import { matchExerciseByName } from '@/lib/workout/localWorkoutParser';
import { updateExerciseRecords } from '@/lib/workout/progression';
import { CalculatedRoutine, CustomExercise, FEATURED_SECONDARY_LIFTS, GeneratedWorkout, isMainLift, UserLift, WeightUnit } from '@/types';
import { getPendingRoutine } from '@/lib/workout/pendingRoutine';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, AppStateStatus, Keyboard } from 'react-native';

// Reject if a promise hasn't settled in `ms` — used to cap AI parse latency so a
// slow/hanging call falls back to the local parse instead of stranding the user.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export interface UseWorkoutNoteSessionReturn {
  // Composer (transient input) + structured draft (the editable source of truth)
  composerText: string;
  setComposerText: (text: string) => void;
  commitComposer: () => Promise<void>;
  commitText: (text: string) => Promise<boolean>; // voice / programmatic entry
  draft: WorkoutDraft;
  loadDraftFromText: (text: string, opts?: { asTarget?: boolean }) => void; // plan builder / restore
  loadDraftFromRoutine: (routine: CalculatedRoutine) => void; // routine import — structured, no text round-trip
  // Direct, traditional-UI edits to the synthesized cards:
  editSet: (key: string, index: number, patch: Partial<DraftSet>) => void;
  addSetTo: (key: string) => void;
  removeSetFrom: (key: string, index: number) => void;
  toggleSetDone: (key: string, index: number) => void;
  removeExerciseFrom: (key: string) => void;
  acceptAutofill: (key: string, source: ReferenceSource) => void;
  dismissAutofill: (key: string) => void;

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
  discardWorkout: () => Promise<void>;

  // Session state
  isSessionLoaded: boolean;
  hasWorkoutStarted: boolean;
  weightUnit: WeightUnit;
  setWeightUnitPref: (unit: WeightUnit) => void;

  // Repeat-last-workout prefill
  lastWorkoutTitle: string | null; // null when there's nothing to repeat
  prefillLastWorkout: () => void;
  recentWorkouts: GeneratedWorkout[]; // recent sessions, newest first (empty-state list)
  prefillWorkout: (w: GeneratedWorkout) => void;
  startEmptyWorkout: () => void;
  customExercises: CustomExercise[];
}

export function useWorkoutNoteSession(): UseWorkoutNoteSessionReturn {
  const { refreshProfile, userProfile, updateProfile } = useUser();
  const { showAlert } = useAlert();

  // Structured draft is the source of truth; composer text is transient input.
  const [draft, setDraft] = useState<WorkoutDraft>([]);
  const [composerText, setComposerText] = useState('');
  // Quick-start: the session is active even before any set is logged.
  const [manuallyStarted, setManuallyStarted] = useState(false);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // The note text the finish/save/persistence pipeline consumes is just the
  // serialized draft — so editing cards or committing the composer both flow
  // through one place.
  const noteText = useMemo(() => draftToNoteText(draft), [draft]);


  // Traditional-UI edits to the synthesized cards.
  const editSet = useCallback((key: string, index: number, patch: Partial<DraftSet>) => {
    setDraft(d => updateSetInDraft(d, key, index, patch));
  }, []);
  const addSetTo = useCallback((key: string) => setDraft(d => addSetToDraft(d, key)), []);
  const removeSetFrom = useCallback((key: string, index: number) => setDraft(d => removeSetFromDraft(d, key, index)), []);
  const toggleSetDone = useCallback((key: string, index: number) => setDraft(d => toggleSetDoneInDraft(d, key, index)), []);
  const removeExerciseFrom = useCallback((key: string) => setDraft(d => removeExerciseFromDraft(d, key)), []);
  const acceptAutofill = useCallback((key: string, source: ReferenceSource) => setDraft(d => applyReferenceInDraft(d, key, source)), []);
  // Dismiss = start filling manually (a blank set), keeping the ghost reference.
  const dismissAutofill = useCallback((key: string) => setDraft(d => addSetToDraft(d, key)), []);

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
  // Full history powers per-exercise "autofill last time" suggestions.
  const [history, setHistory] = useState<GeneratedWorkout[]>([]);

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
      setHistory(history);
      setCustomExercises(custom);
    } catch (error) {
      console.error('Error loading last workout for prefill:', error);
    }
  }, []);

  // Per-exercise "last time" lookup for ghost references + autofill.
  const previousFor = useCallback(
    (exerciseId: string | undefined) => (exerciseId ? getLastSetsFor(exerciseId, history, weightUnit) : null),
    [history, weightUnit],
  );

  // Parse free text into a fresh draft (routine import, plan builder, repeat,
  // restore). Local-only (no API calls). A routine template's "Target:/Actual:"
  // labels are folded onto their exercise; pass { asTarget } to treat the parsed
  // sets as the prescription (empty working sets + target ghost) rather than as
  // already-done work. Either way, a "previous" reference is attached from history.
  const loadDraftFromText = useCallback((text: string, opts?: { asTarget?: boolean }) => {
    if (!text.trim()) {
      setDraft([]);
      return;
    }
    const normalized = text.replace(/\n[ \t]*(target|actual)s?:[ \t]*/gi, ' ');
    const parsed = workoutNoteParser.parseLocal(normalized);
    setDraft(buildDraft(parsed, { asTarget: opts?.asTarget, previousFor }));
  }, [previousFor]);

  // Import a routine WITHOUT the lossy text round-trip. The routine already carries
  // the resolved exerciseId per exercise, so we build the draft straight from it —
  // no re-parsing a name back through the fuzzy matcher (which used to silently swap
  // "Overhead Press (Machine)" for the barbell variant). The prescription becomes the
  // target ghost; sets start un-done for check-off.
  const loadDraftFromRoutine = useCallback((routine: CalculatedRoutine) => {
    const parsed: ParsedWorkout = {
      exercises: routine.exercises.map(ex => ({
        name: ex.exerciseName,
        matchedExerciseId: ex.exerciseId, // authoritative id — never re-resolved by name
        isCustom: customExercises.some(c => c.id === ex.exerciseId),
        sets: ex.sets.map(s => ({ weight: s.targetWeight || 0, reps: s.reps, unit: ex.unit, completed: false })),
      })),
      confidence: 1,
      rawText: '',
    };
    setDraft(buildDraft(parsed, { asTarget: true, previousFor }));
    setStartedRoutineId(routine.id);
  }, [customExercises, previousFor]);

  // Parse some text and merge it into the draft. Local parse first (free /
  // instant); fall back to the AI parser when local can't *reasonably* read it —
  // i.e. it found nothing, mangled the sets, or couldn't recognize the exercise
  // (abbreviations like "db press", "rdl"). Returns true if anything was added.
  const commitText = useCallback(async (text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const mergeInto = (exercises: ParsedWorkout['exercises']) =>
      setDraft(d => attachPrevious(mergeParsed(d, exercises, { done: true }), previousFor));

    const local = workoutNoteParser.parseLocal(trimmed);
    // "Known" = matched the built-in catalog OR one of the user's custom
    // exercises (by name). Anything unknown is what the AI should synthesize.
    const norm = (s: string) => s.toLowerCase().trim();
    const isKnown = (ex: ParsedWorkout['exercises'][number]) =>
      !!ex.matchedExerciseId || customExercises.some(c => norm(c.name) === norm(ex.name));
    const localReasonable =
      local.exercises.length > 0 &&
      local.exercises.every(ex => isKnown(ex) && ex.sets.length > 0 && ex.sets.every(s => s.reps > 0));
    if (localReasonable) {
      mergeInto(local.exercises); // typed/spoken sets are work you did → checked off
      return true;
    }

    // No sets, but it names a known exercise — add it; its sets autofill from the
    // last time they trained it (Fitbod-style smart prefill).
    const namedId = matchExerciseByName(trimmed);
    if (namedId && local.exercises.length === 0) {
      const previous = getLastSetsFor(namedId, history, weightUnit) ?? undefined;
      const name = getWorkoutById(namedId)?.name ?? trimmed;
      setDraft(d => addNamedExercise(d, { name, exerciseId: namedId, recognized: true, previous }));
      return true;
    }

    // A name with no sets that we don't recognize offline — ask the AI what
    // exercise it is and add it (sets autofill from last time). No digits means
    // there are no sets to parse, so we only need the recognized name.
    if (local.exercises.length === 0 && !/\d/.test(trimmed)) {
      try {
        const first = (await withTimeout(workoutNoteParser.parseWorkoutNote(trimmed), 4000)).exercises[0];
        if (first) {
          const id = first.matchedExerciseId;
          const name = id ? getWorkoutById(id)?.name ?? first.name : first.name;
          const previous = id ? getLastSetsFor(id, history, weightUnit) ?? undefined : undefined;
          setDraft(d => addNamedExercise(d, { name, exerciseId: id, recognized: !!id && !first.isCustom, previous }));
          return true;
        }
      } catch {
        // fall through
      }
    }

    // Local couldn't reasonably parse it → let the AI parser try, but only when
    // the text actually carries set data (digits). On a bare fragment the AI
    // guesses an exercise with a 0×0 set, which would add an empty card. Cap the
    // wait so a slow/hanging call can never strand the add — we fall back to local.
    if (/\d/.test(trimmed)) {
      try {
        const ai = await withTimeout(workoutNoteParser.parseWorkoutNote(trimmed), 4000);
        const real = ai.exercises.filter(ex => ex.sets.some(s => s.reps > 0));
        if (real.length > 0) {
          mergeInto(real);
          return true;
        }
      } catch {
        // fall through
      }
    }

    // AI unavailable/failed — fall back to whatever local managed, if anything.
    if (local.exercises.length > 0) {
      mergeInto(local.exercises);
      return true;
    }
    showAlert({ title: "Couldn't read that", message: 'Try something like "Bench 135x8, 155x6".', type: 'info' });
    return false;
  }, [showAlert, history, weightUnit, previousFor, customExercises]);

  // Commit the composer box: merge what's typed, then clear it on success.
  const commitComposer = useCallback(async () => {
    const ok = await commitText(composerText);
    if (ok) setComposerText('');
  }, [commitText, composerText]);

  // Calculate elapsed time from start time (works even after app restart)
  const calculateElapsedTime = useCallback((startTime: Date | null): number => {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime.getTime()) / 1000);
  }, []);

  // Rehydrate the session state (draft/timer/routine) from a persisted session.
  // Shared by the mount load and the app-foreground recovery.
  const restoreSession = useCallback((s: NonNullable<Awaited<ReturnType<typeof storageService.getNoteSession>>>) => {
    const savedDraft = s.draft as WorkoutDraft | null;
    if (savedDraft && savedDraft.length) setDraft(savedDraft);
    else if (s.noteText) loadDraftFromText(s.noteText);
    setManuallyStarted(s.manuallyStarted);
    setWorkoutStartTime(s.startTime);
    setElapsedTime(calculateElapsedTime(s.startTime));
    if (s.routineId) setStartedRoutineId(s.routineId);
  }, [loadDraftFromText, calculateElapsedTime]);

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
        if (savedSession && (savedSession.noteText || (savedSession.draft as WorkoutDraft | null)?.length || savedSession.manuallyStarted)) {
          restoreSession(savedSession); // preserves per-set done + target/previous refs
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsSessionLoaded(true);
      }
    };
    loadInitialData();
    refreshLastWorkout();
    // Run once on mount. Listing loadDraftFromText/refreshLastWorkout here would
    // loop: refreshLastWorkout sets a fresh history array → previousFor →
    // loadDraftFromText change → effect refires → refresh → … (pins the UI).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume any routine the user just started (text + id) on every focus, not
  // just on mount. The Workout tab stays mounted, so a mount-only read meant the
  // second (and every later) routine started from Home/Routines never attached
  // its id here — completing it then failed to update progression or lastUsed,
  // which broke "Up Next" cycling when training out of order.
  useFocusEffect(
    useCallback(() => {
      const routine = getPendingRoutine();
      if (routine) {
        // Structured import: seed the prescription as targets from the resolved
        // exerciseIds (no text re-parse), and attach the routine id for progression.
        loadDraftFromRoutine(routine);
      }
    }, [loadDraftFromRoutine])
  );

  // Persist the in-progress session (incl. the structured draft, so per-set
  // check-off survives closing/reopening the app).
  useEffect(() => {
    if (!isSessionLoaded) return; // Don't save until we've loaded

    const active = draft.length > 0 || manuallyStarted;
    const saveSession = async () => {
      if (active && workoutStartTime) {
        await storageService.saveNoteSession({
          noteText,
          draft,
          manuallyStarted,
          startTime: workoutStartTime,
          routineId: startedRoutineId,
        });
      } else if (!active) {
        await storageService.clearNoteSession();
      }
    };
    saveSession();
  }, [noteText, draft, manuallyStarted, workoutStartTime, startedRoutineId, isSessionLoaded]);

  // Start timer when user starts logging, reset when everything's cleared
  // (unless they explicitly Quick-started an empty session).
  useEffect(() => {
    if (!isSessionLoaded) return; // Wait for session to load

    if (noteText.length > 0 && !workoutStartTime) {
      setWorkoutStartTime(new Date());
    } else if (noteText.length === 0 && workoutStartTime && !manuallyStarted) {
      // User backspaced all text - reset workout state
      setWorkoutStartTime(null);
      setElapsedTime(0);
      setParsedExercises([]);
    }
  }, [noteText, workoutStartTime, isSessionLoaded, manuallyStarted]);

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
        if (draft.length === 0 && !manuallyStarted && isSessionLoaded) {
          const savedSession = await storageService.getNoteSession();
          const savedDraft = savedSession?.draft as WorkoutDraft | null;
          if (savedSession && (savedDraft?.length || savedSession.noteText || savedSession.manuallyStarted)) {
            restoreSession(savedSession);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [workoutStartTime, draft.length, manuallyStarted, isSessionLoaded, calculateElapsedTime, restoreSession]);

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

    // Did the user actually complete any set this session? Completion (the day
    // checkmark, lastUsed, the cycle) keys off real work — a routine opened and
    // finished with nothing checked off should not read as trained.
    const didRealWork = generatedWorkout.exercises.some(e =>
      e.completedSets.some(s => s.completed && (s.weight > 0 || s.reps > 0 || !!s.duration || !!s.distance))
    );

    // Save to workout history
    await storageService.saveWorkout(generatedWorkout);

    // The user just trained — re-evaluate retention reminders so today's
    // streak/habit nudge is cancelled (they no longer need it).
    retentionNotificationService.refreshScheduledReminders().catch(() => {});


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
      // Only sets the user actually checked off count toward lifts/PRs — typing
      // a number without completing the set shouldn't log a personal record.
      const doneSets = exercise.completedSets.filter(s => s.completed && s.weight > 0);
      if (doneSets.length > 0) {
        // Find the best set (highest estimated 1RM)
        const bestSet = doneSets.reduce((best, current) => {
          const bestOneRM = OneRMCalculator.estimate(best.weight, best.reps);
          const currentOneRM = OneRMCalculator.estimate(current.weight, current.reps);
          return currentOneRM > bestOneRM ? current : best;
        });

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

    // Fold this workout into the global exercise records — the single source of
    // "your best per exercise" (progression anchor + strength rank). This must run
    // AFTER the before-snapshot above so PR detection compares against the prior
    // best, not the just-updated one. Only when real work was logged.
    if (didRealWork) {
      try {
        const records = await storageService.getExerciseRecords();
        await storageService.saveExerciseRecords(updateExerciseRecords(records, generatedWorkout.exercises, new Date()));
      } catch (error) {
        console.error('Error updating exercise records:', error);
      }
    }

    // A PR is a best-set estimated-1RM above the exercise's prior best (from the
    // before-snapshot). Derived directly — no separate lift store to write.
    let prCount = 0;
    for (const { liftData, exercise, previousPR } of liftDataWithMeta) {
      const newPR = OneRMCalculator.estimate(liftData.weight, liftData.reps);
      if (newPR > previousPR) {
        prCount++;
        const workoutInfo = getWorkoutById(exercise.id);
        if (workoutInfo) {
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

    // Mark the day trained — stamps lastUsed (for "last trained" + the cycle
    // checkmark) and advances the up-next ring. Only when real work was logged,
    // so an abandoned routine never shows as done. recordDayTrained owns lastUsed.
    if (startedRoutineId && didRealWork) {
      await storageService.recordDayTrained(startedRoutineId);
    }
  }, [elapsedTime, refreshProfile, startedRoutineId]);

  // Handle finish modal complete - reset workout state
  // Clear the in-progress workout: draft, composer, timer, routine link, and the
  // persisted session. Shared by finishing and discarding.
  const resetSession = useCallback(async () => {
    setDraft([]);
    setComposerText('');
    setManuallyStarted(false);
    setWorkoutStartTime(null);
    setElapsedTime(0);
    setParsedExercises([]);
    setStartedRoutineId(null);
    await storageService.clearNoteSession();
  }, []);

  const handleFinishComplete = useCallback(async () => {
    setShowFinishModal(false);
    await resetSession();
    // The just-finished session is now the one to repeat next time.
    refreshLastWorkout();
  }, [resetSession, refreshLastWorkout]);

  // Handle cancel from finish modal
  const handleFinishCancel = useCallback(() => {
    setShowFinishModal(false);
  }, []);

  // Discard the in-progress workout without saving (clears draft, timer, session).
  const discardWorkout = resetSession;

  // Handle reset workout timer
  const resetWorkoutTimer = useCallback(() => {
    setWorkoutStartTime(new Date());
    setElapsedTime(0);
  }, []);

  // Quick start: begin an empty active session (timer running, ready to log).
  const startEmptyWorkout = useCallback(() => {
    setManuallyStarted(true);
    setStartedRoutineId(null);
    setWorkoutStartTime(prev => prev ?? new Date());
  }, []);

  // Toggle the preferred unit (lbs/kg) and persist it to the profile.
  const setWeightUnitPref = useCallback(async (unit: WeightUnit) => {
    setWeightUnit(unit);
    try {
      if (userProfile) {
        await updateProfile({ ...userProfile, age: userProfile.age || 28, weightUnitPreference: unit });
      }
    } catch (error) {
      console.error('Error saving weight unit:', error);
    }
  }, [userProfile, updateProfile]);

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

  // Load any past workout into the draft to repeat/edit it.
  const prefillWorkout = useCallback((w: GeneratedWorkout) => {
    const text = workoutToNoteText(w, customExercises);
    if (!text) return;
    loadDraftFromText(text);
    setStartedRoutineId(null);
    if (!workoutStartTime) setWorkoutStartTime(new Date());
  }, [customExercises, workoutStartTime, loadDraftFromText]);

  // Recent sessions, newest first (for the empty-state list; the view scrolls).
  const recentWorkouts = useMemo(
    () => [...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15),
    [history],
  );

  // A workout is underway once the draft has anything in it.
  const hasWorkoutStarted = draft.length > 0 || manuallyStarted;

  return {
    // Composer + structured draft
    composerText,
    setComposerText,
    commitComposer,
    commitText,
    draft,
    loadDraftFromText,
    loadDraftFromRoutine,
    editSet,
    addSetTo,
    removeSetFrom,
    toggleSetDone,
    removeExerciseFrom,
    acceptAutofill,
    dismissAutofill,
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
    discardWorkout,

    // Session state
    isSessionLoaded,
    hasWorkoutStarted,
    weightUnit,
    setWeightUnitPref,

    // Repeat-last-workout prefill
    lastWorkoutTitle,
    prefillLastWorkout,
    recentWorkouts,
    prefillWorkout,
    startEmptyWorkout,
    customExercises,
  };
}
