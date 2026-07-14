import { useAlert } from '@/components/CustomAlert';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/lib/services/analytics';
import { notificationService } from '@/lib/services/notificationService';
import { retentionNotificationService } from '@/lib/services/retentionNotificationService';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { userSyncService } from '@/lib/services/userSyncService';
import { calculateOverallPercentile, formatDuration} from '@/lib/utils/utils';
import { e1rmLbs } from '@/lib/data/strengthStandards';
import { beginOvertakeWatch } from '@/lib/leagues/overtakeWatch';
import { getExercise, getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { ParsedWorkout, workoutTextParser } from '@/lib/workout/workoutTextParser';
import {
  DraftSet,
  WorkoutDraft,
  addNamedExercise,
  addSet as addSetToDraft,
  addWarmupSet as addWarmupSetToDraft,
  buildDraft,
  draftToLogText,
  draftToRoutineExercises,
  mergeParsed,
  moveExercise as moveExerciseInDraft,
  moveExerciseToEdge as moveExerciseToEdgeInDraft,
  previewSetEdit as previewSetEditInDraft,
  removeExercise as removeExerciseFromDraft,
  removeSet as removeSetFromDraft,
  routineDiffersFromDraft,
  toggleSetDone as toggleSetDoneInDraft,
  updateSet as updateSetInDraft,
} from '@/lib/workout/workoutDraft';
import { getLastSetsFor } from '@/lib/workout/autofill';
import { matchExerciseByName } from '@/lib/workout/localWorkoutParser';
import { updateExerciseRecords } from '@/lib/workout/progression';
import { pausedSpanSeconds, sessionElapsedSeconds } from '@/lib/workout/sessionClock';
import { CalculatedRoutine, CustomExercise, FEATURED_SECONDARY_LIFTS, LoggedWorkout, isMainLift, UserLift, WeightUnit } from '@/types';
import { getPendingRepeatWorkout, getPendingRoutine } from '@/lib/workout/pendingRoutine';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Keyboard } from 'react-native';

// Cap AI parse latency so a hanging call falls back to local parse.
const AI_PARSE_TIMEOUT_MS = 4000;
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export interface UseWorkoutSessionReturn {
  composerText: string;
  setComposerText: (text: string) => void;
  commitComposer: () => Promise<void>;
  commitText: (text: string) => Promise<boolean>;
  draft: WorkoutDraft;
  loadDraftFromText: (text: string, opts?: { asTarget?: boolean }) => void;
  loadDraftFromRoutine: (routine: CalculatedRoutine) => void; // structured import, no text round-trip
  editSet: (key: string, index: number, patch: Partial<DraftSet>) => void;
  applyLiveSet: (key: string, index: number, originalSets: DraftSet[], weight: number, reps: number) => void;
  addSetTo: (key: string) => void;
  addWarmupSetTo: (key: string) => void;
  removeSetFrom: (key: string, index: number) => void;
  toggleSetDone: (key: string, index: number) => void;
  removeExerciseFrom: (key: string) => void;
  moveExercise: (key: string, dir: -1 | 1) => void;
  moveExerciseToEdge: (key: string, edge: 'top' | 'bottom') => void;
  dismissAutofill: (key: string) => void;
  getPreviousSets: (exerciseId?: string) => DraftSet[] | null;
  getStartedRoutineChange: () => Promise<{ name: string } | null>;
  syncStartedRoutine: () => Promise<void>;
  logText: string;

  elapsedTime: number;
  workoutStartTime: Date | null;
  formatTime: (seconds: number) => string;
  resetWorkoutTimer: () => void;
  isPaused: boolean;
  pauseWorkout: () => void;
  resumeWorkout: () => void;

  showFinishModal: boolean;
  setShowFinishModal: (show: boolean) => void;
  handleFinishWorkout: () => void;
  handleSaveWorkout: (parsedWorkout: ParsedWorkout) => Promise<void>;
  handleFinishComplete: () => Promise<void>;
  handleFinishCancel: () => void;
  discardWorkout: () => Promise<void>;

  isSessionLoaded: boolean;
  hasWorkoutStarted: boolean;
  weightUnit: WeightUnit;
  setWeightUnitPref: (unit: WeightUnit) => void;

  lastWorkoutTitle: string | null; // null when there's nothing to repeat
  prefillLastWorkout: () => void;
  recentWorkouts: LoggedWorkout[];
  prefillWorkout: (w: LoggedWorkout) => void;
  startEmptyWorkout: () => void;
  customExercises: CustomExercise[];
}

export function useWorkoutSession(): UseWorkoutSessionReturn {
  const { refreshProfile, userProfile, updateProfile } = useUser();
  const { showAlert } = useAlert();

  const [draft, setDraft] = useState<WorkoutDraft>([]);
  const [composerText, setComposerText] = useState('');
  // Quick-start: session is active even before any set is logged.
  const [manuallyStarted, setManuallyStarted] = useState(false);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  // Pause accounting: pausedAt freezes the clock; pausedTotalSeconds accumulates
  // completed pause spans (both persisted, so a paused session survives restarts).
  const [pausedAt, setPausedAt] = useState<Date | null>(null);
  const [pausedTotalSeconds, setPausedTotalSeconds] = useState(0);

  const logText = useMemo(() => draftToLogText(draft), [draft]);

  const editSet = useCallback((key: string, index: number, patch: Partial<DraftSet>) => {
    setDraft(d => updateSetInDraft(d, key, index, patch));
  }, []);
  // Cascade typed weight×reps onto target sets from the edit-start snapshot.
  const applyLiveSet = useCallback(
    (key: string, index: number, originalSets: DraftSet[], weight: number, reps: number) => {
      setDraft(d => previewSetEditInDraft(d, key, index, originalSets, weight, reps));
    },
    [],
  );
  const addSetTo = useCallback((key: string) => setDraft(d => addSetToDraft(d, key)), []);
  const addWarmupSetTo = useCallback((key: string) => setDraft(d => addWarmupSetToDraft(d, key)), []);
  const removeSetFrom = useCallback((key: string, index: number) => setDraft(d => removeSetFromDraft(d, key, index)), []);
  const toggleSetDone = useCallback((key: string, index: number) => setDraft(d => toggleSetDoneInDraft(d, key, index)), []);
  const removeExerciseFrom = useCallback((key: string) => setDraft(d => removeExerciseFromDraft(d, key)), []);
  const moveExercise = useCallback((key: string, dir: -1 | 1) => setDraft(d => moveExerciseInDraft(d, key, dir)), []);
  const moveExerciseToEdge = useCallback((key: string, edge: 'top' | 'bottom') => setDraft(d => moveExerciseToEdgeInDraft(d, key, edge)), []);
  const dismissAutofill = useCallback((key: string) => setDraft(d => addSetToDraft(d, key)), []);

  const [showFinishModal, setShowFinishModal] = useState(false);

  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  // Which routine this workout is from (for UP NEXT cycling).
  const [startedRoutineId, setStartedRoutineId] = useState<string | null>(null);

  const [lastWorkout, setLastWorkout] = useState<LoggedWorkout | null>(null);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [history, setHistory] = useState<LoggedWorkout[]>([]);

  const refreshLastWorkout = useCallback(async () => {
    try {
      const [history, custom] = await Promise.all([
        storageService.getWorkoutHistory(),
        storageService.getCustomExercises(),
      ]);
      const newest = history.reduce<LoggedWorkout | null>((latest, w) => {
        return !latest || new Date(w.createdAt) > new Date(latest.createdAt) ? w : latest;
      }, null);
      setLastWorkout(newest);
      setHistory(history);
      setCustomExercises(custom);
    } catch (error) {
      console.error('Error loading last workout for prefill:', error);
    }
  }, []);

  // Parse free text into a fresh draft, local-only. { asTarget } treats parsed sets
  // as prescription, not done work.
  const loadDraftFromText = useCallback((text: string, opts?: { asTarget?: boolean }) => {
    if (!text.trim()) {
      setDraft([]);
      return;
    }
    const normalized = text.replace(/\n[ \t]*(target|actual)s?:[ \t]*/gi, ' ');
    const parsed = workoutTextParser.parseLocal(normalized);
    setDraft(buildDraft(parsed, { asTarget: opts?.asTarget }));
  }, []);

  // Build from the resolved exerciseId, not re-parsing the name through the fuzzy
  // matcher (which used to swap "Overhead Press (Machine)" for barbell).
  const loadDraftFromRoutine = useCallback((routine: CalculatedRoutine) => {
    const parsed: ParsedWorkout = {
      exercises: routine.exercises.map(ex => ({
        name: ex.exerciseName,
        matchedExerciseId: ex.exerciseId, // authoritative id, never re-resolved by name
        isCustom: customExercises.some(c => c.id === ex.exerciseId),
        sets: ex.sets.map(s => ({ weight: s.targetWeight || 0, reps: s.reps, unit: ex.unit, completed: false, isWarmup: s.isWarmup })),
      })),
      confidence: 1,
      rawText: '',
    };
    setDraft(buildDraft(parsed, { asTarget: true }));
    setStartedRoutineId(routine.id);
  }, [customExercises]);

  const getPreviousSets = useCallback(
    (exerciseId?: string): DraftSet[] | null =>
      exerciseId ? getLastSetsFor(exerciseId, history, weightUnit) : null,
    [history, weightUnit],
  );

  // For the "update your routine?" prompt: name if folding the draft back changes it.
  const getStartedRoutineChange = useCallback(async (): Promise<{ name: string } | null> => {
    if (!startedRoutineId) return null;
    try {
      const routine = (await storageService.getRoutines()).find(r => r.id === startedRoutineId);
      if (!routine) return null;
      return routineDiffersFromDraft(draft, routine.exercises) ? { name: routine.name } : null;
    } catch (e) {
      console.error('Error diffing routine against workout:', e);
      return null;
    }
  }, [startedRoutineId, draft]);

  const syncStartedRoutine = useCallback(async () => {
    if (!startedRoutineId) return;
    try {
      const routine = (await storageService.getRoutines()).find(r => r.id === startedRoutineId);
      if (!routine) return;
      await storageService.saveRoutine({
        ...routine,
        exercises: draftToRoutineExercises(draft, routine.exercises),
      });
    } catch (e) {
      console.error('Error updating routine from workout:', e);
    }
  }, [startedRoutineId, draft]);

  // Parse and merge into the draft. Local first; fall back to AI when local can't
  // reasonably read it (nothing, mangled sets, abbreviations). Returns true if added.
  const commitText = useCallback(async (text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const mergeInto = (exercises: ParsedWorkout['exercises']) =>
      setDraft(d => mergeParsed(d, exercises, { done: true }));

    const local = workoutTextParser.parseLocal(trimmed);
    // "Known" = matched the built-in catalog or a custom exercise by name.
    const norm = (s: string) => s.toLowerCase().trim();
    const isKnown = (ex: ParsedWorkout['exercises'][number]) =>
      !!ex.matchedExerciseId || customExercises.some(c => norm(c.name) === norm(ex.name));
    const localReasonable =
      local.exercises.length > 0 &&
      local.exercises.every(ex => isKnown(ex) && ex.sets.length > 0 && ex.sets.every(s => s.reps > 0));
    if (localReasonable) {
      mergeInto(local.exercises); // typed/spoken sets are work done → checked off
      return true;
    }

    // Names a known exercise but no sets — add it, autofilling from last time.
    const namedId = matchExerciseByName(trimmed);
    if (namedId && local.exercises.length === 0) {
      const previous = getLastSetsFor(namedId, history, weightUnit) ?? undefined;
      const name = getCatalogExercise(namedId)?.name ?? trimmed;
      setDraft(d => addNamedExercise(d, { name, exerciseId: namedId, recognized: true, previous }));
      return true;
    }

    // A name with no sets, unrecognized offline — ask the AI what exercise it is.
    if (local.exercises.length === 0 && !/\d/.test(trimmed)) {
      try {
        const first = (await withTimeout(workoutTextParser.parseWorkoutText(trimmed), AI_PARSE_TIMEOUT_MS)).exercises[0];
        if (first) {
          const id = first.matchedExerciseId;
          const name = id ? getCatalogExercise(id)?.name ?? first.name : first.name;
          const previous = id ? getLastSetsFor(id, history, weightUnit) ?? undefined : undefined;
          setDraft(d => addNamedExercise(d, { name, exerciseId: id, recognized: !!id && !first.isCustom, previous }));
          return true;
        }
      } catch {
        // fall through
      }
    }

    // Only let AI parse when text carries digits: a bare fragment yields a 0×0 set.
    if (/\d/.test(trimmed)) {
      try {
        const ai = await withTimeout(workoutTextParser.parseWorkoutText(trimmed), AI_PARSE_TIMEOUT_MS);
        const real = ai.exercises.filter(ex => ex.sets.some(s => s.reps > 0));
        if (real.length > 0) {
          mergeInto(real);
          return true;
        }
      } catch {
        // fall through
      }
    }

    // AI unavailable/failed — fall back to whatever local managed.
    if (local.exercises.length > 0) {
      mergeInto(local.exercises);
      return true;
    }
    showAlert({ title: "Couldn't read that", message: 'Try something like "Bench 135x8, 155x6".', type: 'info' });
    return false;
  }, [showAlert, history, weightUnit, customExercises]);

  const commitComposer = useCallback(async () => {
    const ok = await commitText(composerText);
    if (ok) setComposerText('');
  }, [commitText, composerText]);

  const calculateElapsedTime = useCallback(
    (startTime: Date | null, paused: Date | null = pausedAt, pausedTotal: number = pausedTotalSeconds): number =>
      sessionElapsedSeconds(startTime, new Date(), paused, pausedTotal),
    [pausedAt, pausedTotalSeconds],
  );

  const restoreSession = useCallback((s: NonNullable<Awaited<ReturnType<typeof storageService.getNoteSession>>>) => {
    const savedDraft = s.draft as WorkoutDraft | null;
    if (savedDraft && savedDraft.length) setDraft(savedDraft);
    else if (s.noteText) loadDraftFromText(s.noteText); // legacy sessions persisted text only
    setManuallyStarted(s.manuallyStarted);
    setWorkoutStartTime(s.startTime);
    setPausedAt(s.pausedAt);
    setPausedTotalSeconds(s.pausedTotalSeconds);
    setElapsedTime(calculateElapsedTime(s.startTime, s.pausedAt, s.pausedTotalSeconds));
    if (s.routineId) setStartedRoutineId(s.routineId);
  }, [loadDraftFromText, calculateElapsedTime]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const profile = await userService.getRealUserProfile();
        if (profile?.weightUnitPreference) {
          setWeightUnit(profile.weightUnitPreference);
        }

        // A just-started routine is consumed by the focus effect below, overriding this.
        const savedSession = await storageService.getNoteSession();
        if (savedSession && (savedSession.noteText || (savedSession.draft as WorkoutDraft | null)?.length || savedSession.manuallyStarted)) {
          restoreSession(savedSession); // preserves per-set done state
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setIsSessionLoaded(true);
      }
    };
    loadInitialData();
    refreshLastWorkout();
    // Run once on mount; adding deps here loops (refresh → history → refire).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume a just-started routine on every focus, not just mount: the tab stays
  // mounted, so a mount-only read left later routines' ids unattached — breaking
  // progression/lastUsed and "Up Next" cycling when training out of order.
  useFocusEffect(
    useCallback(() => {
      const routine = getPendingRoutine();
      if (routine) {
        loadDraftFromRoutine(routine);
      }
    }, [loadDraftFromRoutine])
  );

  // Debounced persist: per-keystroke edits would otherwise write AsyncStorage every
  // render and lag typing. Latest snapshot held in a ref, flushed on unmount.
  const sessionSnapshot = useRef({ logText, draft, manuallyStarted, workoutStartTime, startedRoutineId, pausedAt, pausedTotalSeconds });
  sessionSnapshot.current = { logText, draft, manuallyStarted, workoutStartTime, startedRoutineId, pausedAt, pausedTotalSeconds };
  const persistSession = useCallback(async () => {
    const snap = sessionSnapshot.current;
    const active = snap.draft.length > 0 || snap.manuallyStarted;
    if (active && snap.workoutStartTime) {
      await storageService.saveNoteSession({
        noteText: snap.logText, // legacy persisted field name — do not rename (user data)
        draft: snap.draft,
        manuallyStarted: snap.manuallyStarted,
        startTime: snap.workoutStartTime,
        routineId: snap.startedRoutineId,
        pausedAt: snap.pausedAt,
        pausedTotalSeconds: snap.pausedTotalSeconds,
      });
    } else if (!active) {
      await storageService.clearNoteSession();
    }
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isSessionLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { persistSession(); }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [logText, draft, manuallyStarted, workoutStartTime, startedRoutineId, pausedAt, pausedTotalSeconds, isSessionLoaded, persistSession]);

  // Flush the pending save on unmount so leaving the tab mid-edit isn't lost.
  useEffect(() => () => { persistSession(); }, [persistSession]);

  // Start timer when logging begins, reset when cleared (unless Quick-started empty).
  useEffect(() => {
    if (!isSessionLoaded) return;

    if (logText.length > 0 && !workoutStartTime) {
      setWorkoutStartTime(new Date());
    } else if (logText.length === 0 && workoutStartTime && !manuallyStarted) {
      setWorkoutStartTime(null);
      setElapsedTime(0);
    }
  }, [logText, workoutStartTime, isSessionLoaded, manuallyStarted]);

  useEffect(() => {
    if (!workoutStartTime) return;

    setElapsedTime(calculateElapsedTime(workoutStartTime));
    if (pausedAt) return; // frozen — nothing to tick

    const interval = setInterval(() => {
      setElapsedTime(calculateElapsedTime(workoutStartTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [workoutStartTime, pausedAt, calculateElapsedTime]);

  useFocusEffect(
    useCallback(() => {
      if (workoutStartTime) {
        setElapsedTime(calculateElapsedTime(workoutStartTime));
      }
    }, [workoutStartTime, calculateElapsedTime])
  );

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (workoutStartTime) {
          setElapsedTime(calculateElapsedTime(workoutStartTime));
        }

        // Recover if component state was reset during backgrounding but storage kept it.
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

  const formatTime = useCallback((seconds: number): string => formatDuration(seconds), []);

  const handleFinishWorkout = useCallback(() => {
    if (!logText.trim()) {
      showAlert({ title: 'No workout data', message: 'Add some exercises before finishing your workout.', type: 'info' });
      return;
    }
    Keyboard.dismiss();
    setShowFinishModal(true);
  }, [logText, showAlert]);

  const handleSaveWorkout = useCallback(async (parsedWorkout: ParsedWorkout) => {
    const durationMinutes = Math.ceil(elapsedTime / 60);

    // Also auto-creates custom exercises; routineId when started from a routine.
    const generatedWorkout = await workoutTextParser.toLoggedWorkoutWithCustomExercises(
      parsedWorkout,
      durationMinutes,
      startedRoutineId || undefined
    );

    // Completion keys off real work — a routine finished with nothing checked off
    // must not read as trained.
    const didRealWork = generatedWorkout.exercises.some(e =>
      e.completedSets.some(s => s.completed && (s.weight > 0 || s.reps > 0 || !!s.duration || !!s.distance))
    );

    await storageService.saveWorkout(generatedWorkout);

    // Just trained — re-evaluate retention reminders so today's nudge is cancelled.
    retentionNotificationService.refreshScheduledReminders().catch(() => {});

    // PRs before recording new lifts; covers main AND secondary (matches home screen).
    const currentProgress = await userService.getAllFeaturedLifts();

    const beforePercentiles = currentProgress.map(p => p.percentileRanking).filter(p => p > 0);
    const beforeOverallPercentile = beforePercentiles.length > 0 ? calculateOverallPercentile(beforePercentiles) : 0;
    const currentPRMap: Record<string, number> = {};
    currentProgress.forEach(p => {
      currentPRMap[p.workoutId] = p.personalRecord;
    });

    const liftsToSync: UserLift[] = [];
    const newPRs: { exerciseId: string; exerciseName: string; newPR: number; previousPR: number }[] = [];

    const liftDataWithMeta: { liftData: UserLift; liftType: 'main' | 'secondary'; exercise: typeof generatedWorkout.exercises[0]; previousPR: number }[] = [];

    for (const exercise of generatedWorkout.exercises) {
      // Only checked-off sets count toward lifts/PRs.
      const doneSets = exercise.completedSets.filter(s => s.completed && s.weight > 0);
      if (doneSets.length > 0) {
        const bestSet = doneSets.reduce((best, current) => {
          const bestOneRM = e1rmLbs(best.weight, best.reps, best.unit);
          const currentOneRM = e1rmLbs(current.weight, current.reps, current.unit);
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

    // Must run AFTER the before-snapshot so PR detection compares the prior best.
    if (didRealWork) {
      try {
        const records = await storageService.getExerciseRecords();
        await storageService.saveExerciseRecords(updateExerciseRecords(records, generatedWorkout.exercises, new Date()));
      } catch (error) {
        console.error('Error updating exercise records:', error);
      }
    }

    let prCount = 0;
    for (const { liftData, exercise, previousPR } of liftDataWithMeta) {
      // Lbs on both sides — previousPR (personalRecord) is stored in lbs.
      const newPR = e1rmLbs(liftData.weight, liftData.reps, liftData.unit);
      if (newPR > previousPR) {
        prCount++;
        const workoutInfo = getCatalogExercise(exercise.id);
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

    // Notify friends about PRs for main lifts + hip thrust only (fire and forget).
    for (const pr of newPRs) {
      const isNotificationWorthy = isMainLift(pr.exerciseId) || pr.exerciseId === FEATURED_SECONDARY_LIFTS.HIP_THRUST_BARBELL;
      if (isNotificationWorthy) {
        notificationService.notifyFriendsOfPR(pr.exerciseId, pr.exerciseName, pr.newPR, pr.previousPR).catch(err => {
          console.error('Error notifying friends of PR:', err);
        });
      }
    }

    // Capture the pre-sync league board so overtake pushes can diff against it.
    const settleOvertakeWatch = beginOvertakeWatch();

    // Sync lifts to Supabase for leaderboard (excluding custom exercises).
    const liftsToSyncFiltered = liftsToSync.filter(lift => getCatalogExercise(lift.id) !== null);
    const liftsSyncPromise = liftsToSyncFiltered.length > 0
      ? userSyncService.syncLifts(liftsToSyncFiltered).catch(err => {
          console.error('Error syncing lifts to Supabase:', err);
        })
      : Promise.resolve();

    // Percentile sync covers ALL the user's lifts, not just this workout.
    userSyncService.calculateAndSyncPercentiles().catch(err => {
      console.error('Error syncing percentile data:', err);
    });

    const workoutSyncPromise = userSyncService.syncWorkout(generatedWorkout, elapsedTime, prCount).catch(err => {
      console.error('Error syncing workout to Supabase:', err);
    });

    // League overtakes: re-fetch standings once this session is on the server,
    // push to friends the user just moved past (fire and forget).
    settleOvertakeWatch(Promise.allSettled([liftsSyncPromise, workoutSyncPromise]));

    refreshProfile().catch(err => {
      console.error('Error refreshing profile:', err);
    });

    // NEW percentile after recording lifts (main + secondary, matches home screen).
    const afterProgress = await userService.getAllFeaturedLifts();
    const afterPercentiles = afterProgress.map(p => p.percentileRanking).filter(p => p > 0);
    const afterOverallPercentile = afterPercentiles.length > 0 ? calculateOverallPercentile(afterPercentiles) : 0;

    // Save strength progress for the home screen celebration, only on a change.
    if (afterOverallPercentile !== beforeOverallPercentile) {
      console.log('[useWorkoutSession] Saving strength progress:', {
        before: beforeOverallPercentile,
        after: afterOverallPercentile,
      });
      await storageService.savePendingStrengthProgress({
        previousPercentile: beforeOverallPercentile,
        newPercentile: afterOverallPercentile,
        timestamp: Date.now(),
      });
    }

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

    // Stamps lastUsed and advances the up-next ring; only on real work so an
    // abandoned routine never shows as done.
    if (startedRoutineId && didRealWork) {
      await storageService.recordDayTrained(startedRoutineId);
    }
  }, [elapsedTime, refreshProfile, startedRoutineId]);

  // Clear the in-progress workout. Shared by finishing and discarding.
  const resetSession = useCallback(async () => {
    setDraft([]);
    setComposerText('');
    setManuallyStarted(false);
    setWorkoutStartTime(null);
    setPausedAt(null);
    setPausedTotalSeconds(0);
    setElapsedTime(0);
    setStartedRoutineId(null);
    await storageService.clearNoteSession();
  }, []);

  const handleFinishComplete = useCallback(async () => {
    setShowFinishModal(false);
    await resetSession();
    refreshLastWorkout();
  }, [resetSession, refreshLastWorkout]);

  const handleFinishCancel = useCallback(() => {
    setShowFinishModal(false);
  }, []);

  const discardWorkout = resetSession;

  const pauseWorkout = useCallback(() => {
    if (!workoutStartTime || pausedAt) return;
    setPausedAt(new Date());
  }, [workoutStartTime, pausedAt]);

  const resumeWorkout = useCallback(() => {
    if (!pausedAt) return;
    setPausedTotalSeconds(t => t + pausedSpanSeconds(pausedAt, new Date()));
    setPausedAt(null);
  }, [pausedAt]);

  const resetWorkoutTimer = useCallback(() => {
    setWorkoutStartTime(new Date());
    setPausedAt(null);
    setPausedTotalSeconds(0);
    setElapsedTime(0);
  }, []);

  const startEmptyWorkout = useCallback(() => {
    setManuallyStarted(true);
    setStartedRoutineId(null);
    setWorkoutStartTime(prev => prev ?? new Date());
  }, []);

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

  const lastWorkoutTitle = lastWorkout ? (lastWorkout.title || 'last workout') : null;

  // Repeat a logged workout structured — ids authoritative, roles survive.
  // Rows arrive un-done: a repeat is a plan, not work.
  const prefillWorkout = useCallback((w: LoggedWorkout) => {
    const parsed: ParsedWorkout = {
      exercises: w.exercises
        .filter(ex => ex.completedSets.length > 0)
        .map(ex => ({
          name: getExercise(ex.id)?.name ?? ex.id,
          matchedExerciseId: ex.id, // authoritative id, never re-resolved by name
          isCustom: customExercises.some(c => c.id === ex.id),
          sets: ex.completedSets.map(s => ({
            weight: s.weight,
            reps: s.reps,
            unit: s.unit,
            completed: false,
            duration: s.duration,
            distance: s.distance,
            isWarmup: s.isWarmup,
          })),
        })),
      confidence: 1,
      rawText: '',
    };
    if (parsed.exercises.length === 0) return;
    setDraft(buildDraft(parsed));
    // A repeat is freestyle — not advancing a routine's up-next cycle.
    setStartedRoutineId(null);
    if (!workoutStartTime) setWorkoutStartTime(new Date());
  }, [customExercises, workoutStartTime]);

  const prefillLastWorkout = useCallback(() => {
    if (lastWorkout) prefillWorkout(lastWorkout);
  }, [lastWorkout, prefillWorkout]);

  // A repeat handed off from Home's recent list (same pattern as getPendingRoutine).
  useFocusEffect(
    useCallback(() => {
      const repeat = getPendingRepeatWorkout();
      if (repeat) prefillWorkout(repeat);
    }, [prefillWorkout])
  );

  const recentWorkouts = useMemo(
    () => [...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15),
    [history],
  );

  const hasWorkoutStarted = draft.length > 0 || manuallyStarted;

  return {
    composerText,
    setComposerText,
    commitComposer,
    commitText,
    draft,
    loadDraftFromText,
    loadDraftFromRoutine,
    editSet,
    applyLiveSet,
    addSetTo,
    addWarmupSetTo,
    removeSetFrom,
    toggleSetDone,
    removeExerciseFrom,
    moveExercise,
    moveExerciseToEdge,
    dismissAutofill,
    getPreviousSets,
    getStartedRoutineChange,
    syncStartedRoutine,
    logText,

    elapsedTime,
    workoutStartTime,
    formatTime,
    resetWorkoutTimer,
    isPaused: pausedAt != null,
    pauseWorkout,
    resumeWorkout,

    showFinishModal,
    setShowFinishModal,
    handleFinishWorkout,
    handleSaveWorkout,
    handleFinishComplete,
    handleFinishCancel,
    discardWorkout,

    isSessionLoaded,
    hasWorkoutStarted,
    weightUnit,
    setWeightUnitPref,

    lastWorkoutTitle,
    prefillLastWorkout,
    recentWorkouts,
    prefillWorkout,
    startEmptyWorkout,
    customExercises,
  };
}
