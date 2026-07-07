import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import { Text, useInk, View } from '@/components/Themed';
import PlanBuilderModal from '@/components/workout/PlanBuilderModal';
import RoutineImportModal from '@/components/workout/RoutineImportModal';
import WorkoutFinishModal from '@/components/workout/WorkoutFinishModal';
import WorkoutNoteInput, { WorkoutNoteInputRef } from '@/components/workout/WorkoutNoteInput';
import EditableWorkout from '@/components/workout/EditableWorkout';
import { draftToParsedWorkout, type DraftExercise, type DraftSet } from '@/lib/workout/workoutDraft';
import type { CalculatedRoutine } from '@/types';
import RecentWorkouts from '@/components/workout/RecentWorkouts';
import PredictiveCard from '@/components/workout/PredictiveCard';
import NumberPad from '@/components/workout/NumberPad';
import { useVoiceDictation } from '@/hooks/useVoiceDictation';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/components/CustomAlert';
import playHapticFeedback from '@/lib/utils/haptic';
import { layout } from '@/lib/ui/styles';
import { radius, screenGutter, space, tint, track } from '@/lib/ui/tokens';
import { lineHeightFor, type as typeScale } from '@/lib/ui/typography';
import { getPendingQuickStart } from '@/lib/workout/pendingRoutine';
import { useFocusEffect } from 'expo-router';
import { useRestTimer } from '@/hooks/useRestTimer';
import { useWorkoutNoteSession } from '@/hooks/useWorkoutNoteSession';
import {
  endLiveActivity,
  isLiveActivitySupported,
  pullPendingActions,
  saveWorkoutSnapshot,
  startLiveActivity,
  updateLiveActivity,
} from '@/lib/liveActivity/liveActivity';
import type { LiveActivityContent, PendingAction, SnapshotSet } from '@/lib/liveActivity/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Matches the absolute tab bar height in app/(tabs)/_layout.tsx so the composer
// sits clear of it (the bar overlays content). Collapsed when the keyboard is up.
const TAB_BAR_CLEARANCE = 85;

// True when (key,index) is the only set still not done across the whole workout —
// i.e. completing it empties the queue. Used to spawn a "keep going" bonus set.
const isLastRemainingSet = (draft: DraftExercise[], key: string, index: number): boolean =>
  draft.every(e => e.sets.every((s, i) => s.done || (e.key === key && i === index)));

export default function WorkoutScreen() {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const noteInputRef = useRef<WorkoutNoteInputRef>(null);

  // Workout session hook (handles note, timer, persistence, saving)
  const {
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
    removeSetFrom,
    toggleSetDone,
    removeExerciseFrom,

    noteText,
    elapsedTime,
    formatTime,
    resetWorkoutTimer,
    showFinishModal,
    handleFinishWorkout,
    handleSaveWorkout,
    handleFinishComplete,
    handleFinishCancel,
    discardWorkout,
    hasWorkoutStarted,
    weightUnit,
    setWeightUnitPref,
    recentWorkouts,
    prefillWorkout,
    startEmptyWorkout,
  } = useWorkoutNoteSession();
  const { showAlert } = useAlert();
  // Always-current draft, so imperative handlers (number pad) can read the latest
  // sets without stale-closure surprises.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Composer collapses to floating compose + mic buttons; opens to the full bar.
  const [composerOpen, setComposerOpen] = useState(false);
  const openComposer = useCallback(() => {
    playHapticFeedback('light', false);
    setComposerOpen(true);
    setTimeout(() => noteInputRef.current?.focus(), 60);
  }, []);
  // The composer collapses when the input loses focus. We drive this off the
  // input's own onBlur (see handleComposerBlur) rather than global keyboard
  // events: in the simulator (and during the open animation) a phantom
  // keyboardWillHide can fire even though the field is still focused, which would
  // slam the composer shut the instant you open it. The typed text lives in
  // `composerText` and is left untouched, so reopening resumes where you left off.
  const handleComposerBlur = useCallback(() => setComposerOpen(false), []);
  // Explicit collapse for scrolling the workout: keyboardDismissMode only blurs
  // the field when a software keyboard is actually up, so on the simulator (and
  // with a hardware keyboard) a scroll wouldn't fire onBlur. Drive it directly.
  const closeComposer = useCallback(() => {
    noteInputRef.current?.blur();
    Keyboard.dismiss();
    setComposerOpen(false);
  }, []);

  // Collapse the tab-bar clearance under the composer while the keyboard is up.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Discard the current workout (from the Cancel button), with a confirm.
  const handleDiscard = useCallback(() => {
    showAlert({
      title: 'Discard workout?',
      message: "This clears everything you've logged in this session. It can't be undone.",
      buttons: [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => discardWorkout() },
      ],
    });
  }, [showAlert, discardWorkout]);

  // Rest timer hook
  const {
    isResting,
    formattedTime: formattedRestTime,
    startTimer: startRestTimer,
    skipTimer: skipRestTimer,
    addTime: addRestTime,
  } = useRestTimer();

  // ── Live Activity: the current-set card (Lock Screen / Dynamic Island) ──────
  // Flat, ordered list of every working set — drives the "current set" shown and
  // the native "complete → next not-done set" advance (mirrored to the App Group
  // so the Lock Screen can jump exercises with the app suspended).
  const snapshot: SnapshotSet[] = useMemo(
    () =>
      draft.flatMap(ex =>
        ex.sets.map((s, i) => ({
          exerciseKey: ex.key,
          exerciseName: ex.name || 'Exercise',
          setNumber: i + 1,
          totalSets: ex.sets.length,
          reps: s.reps,
          weight: s.weight,
          unit: s.unit,
          done: !!s.done,
        })),
      ),
    [draft],
  );
  const currentSet = useMemo(() => snapshot.find(s => !s.done) ?? null, [snapshot]);

  // We own the SET-mode activity; useRestTimer owns REST-mode. While resting it
  // takes over the single activity, so we stand down and re-publish the current
  // set once rest ends.
  const setActivityLive = useRef(false);
  const lastSetKey = useRef('');
  useEffect(() => {
    if (!isLiveActivitySupported()) return;
    if (isResting) { setActivityLive.current = false; lastSetKey.current = ''; return; }

    if (!hasWorkoutStarted || !currentSet) {
      if (setActivityLive.current) { endLiveActivity(); setActivityLive.current = false; }
      lastSetKey.current = '';
      return;
    }

    const content: LiveActivityContent = {
      mode: 'set',
      workoutTitle: 'Workout',
      set: {
        exerciseKey: currentSet.exerciseKey,
        exerciseName: currentSet.exerciseName,
        setNumber: currentSet.setNumber,
        totalSets: currentSet.totalSets,
        reps: currentSet.reps,
        weight: currentSet.weight,
        unit: currentSet.unit,
      },
    };
    saveWorkoutSnapshot(snapshot); // keep the App Group fresh for the intents
    const key = JSON.stringify(content);
    if (setActivityLive.current && key === lastSetKey.current) return;
    lastSetKey.current = key;
    if (setActivityLive.current) updateLiveActivity(content);
    else { setActivityLive.current = true; startLiveActivity(content); }
  }, [isResting, hasWorkoutStarted, currentSet, snapshot]);

  // Fold Lock-Screen taps (queued by the App Intents) back into the draft when we
  // return to the foreground.
  const applyPending = useCallback((a: PendingAction) => {
    if (a.type === 'completeSet') editSet(a.exerciseKey, a.setIndex, { done: true });
    else if (a.type === 'adjustReps') editSet(a.exerciseKey, a.setIndex, { reps: a.reps });
    else if (a.type === 'adjustWeight') editSet(a.exerciseKey, a.setIndex, { weight: a.weight });
    else if (a.type === 'addRest') addRestTime(a.seconds);
    else if (a.type === 'addBonusSet') addSetTo(a.exerciseKey);
    else if (a.type === 'skipRest') skipRestTimer();
    else if (a.type === 'startRest') {
      // A set was completed on the Lock Screen — resume its rest with the time
      // that's actually left (the countdown started when they tapped).
      const remaining = Math.round((a.endTime - Date.now()) / 1000);
      if (remaining > 1) startRestTimer(remaining);
    }
  }, [editSet, addRestTime, skipRestTimer, startRestTimer, addSetTo]);
  useEffect(() => {
    const drain = async () => { (await pullPendingActions()).forEach(applyPending); };
    drain();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') drain(); });
    return () => sub.remove();
  }, [applyPending]);

  // Stable structured workout for the finish modal (rebuilt only when the draft
  // changes) — an inline object would re-fire the modal's parse effect every render.
  const finishWorkout = useMemo(() => draftToParsedWorkout(draft), [draft]);

  // Quick start: enter the active empty workout, then open the composer.
  const handleQuickStart = useCallback(() => {
    startEmptyWorkout();
    openComposer();
  }, [startEmptyWorkout, openComposer]);

  // Quick start handed off from Home's Start a workout — same hand-off
  // pattern as pending routines/repeats.
  useFocusEffect(
    useCallback(() => {
      if (getPendingQuickStart()) handleQuickStart();
    }, [handleQuickStart]),
  );

  // Checking a set off (becoming done) auto-starts the rest countdown. When it was
  // the last remaining set, append a copy so you can keep going past the plan —
  // the Live Activity then resumes onto that bonus set instead of disappearing.
  const handleToggleDone = useCallback((key: string, index: number) => {
    const ex = draft.find(e => e.key === key);
    const set = ex?.sets[index];
    const becomingDone = set ? !set.done : false;
    toggleSetDone(key, index);
    if (becomingDone) {
      startRestTimer(120, { exerciseName: ex?.name });
      if (isLastRemainingSet(draft, key, index)) addSetTo(key);
    }
  }, [draft, toggleSetDone, startRestTimer, addSetTo]);

  // Commit the composer text into the structured workout.
  const handleComposerSend = useCallback(() => {
    playHapticFeedback('medium', false);
    commitComposer();
  }, [commitComposer]);

  // Voice: each finished phrase is parsed straight into the workout, hands-free.
  const handleVoiceTranscript = useCallback((text: string) => {
    playHapticFeedback('light', false);
    commitText(text);
  }, [commitText]);
  const voice = useVoiceDictation(handleVoiceTranscript);
  const handleMicPress = useCallback(() => {
    playHapticFeedback('medium', false);
    if (!voice.available) {
      showAlert({ title: 'Voice not available', message: 'Voice logging needs a dev-client rebuild (npx expo prebuild) and microphone permission.', type: 'info' });
      return;
    }
    voice.toggle();
  }, [voice, showAlert]);
  // Surface voice errors (permissions, recognizer failures) so they're not silent.
  useEffect(() => {
    if (voice.error) showAlert({ title: 'Voice', message: voice.error, type: 'info' });
  }, [voice.error, showAlert]);

  // UI state (modals, expanded timer)
  const [isTimerExpanded, setIsTimerExpanded] = useState(false);
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);
  const [showRoutineImport, setShowRoutineImport] = useState(false);
  // Which set field the custom number pad is editing.
  const [editing, setEditing] = useState<{ key: string; index: number; field: 'weight' | 'reps' } | null>(null);
  // Snapshot of the exercise's sets when editing began, plus the in-progress
  // weight/reps — so each keystroke recomputes the live target cascade from the
  // original values (see handlePadLiveChange → applyLiveSet).
  const editOrigin = useRef<{ key: string; index: number; sets: DraftSet[] } | null>(null);
  const liveEdit = useRef<{ weight: number; reps: number }>({ weight: 0, reps: 0 });
  const openNumberPad = useCallback((key: string, index: number, field: 'weight' | 'reps') => {
    Keyboard.dismiss();
    playHapticFeedback('light', false);
    // Snapshot once per set (weight → Next → reps keeps the same origin); tapping a
    // different set — or re-tapping after its value changed — refreshes it.
    const o = editOrigin.current;
    if (!o || o.key !== key || o.index !== index) {
      const sets = (draftRef.current.find(e => e.key === key)?.sets ?? []).map(s => ({ ...s }));
      editOrigin.current = { key, index, sets };
      const s = sets[index];
      liveEdit.current = { weight: s?.weight ?? 0, reps: s?.reps ?? 0 };
    }
    setEditing({ key, index, field });
  }, []);

  // Each keystroke in the pad updates the in-progress value and re-applies the live
  // target cascade, recomputed from the open-time snapshot so following sets that
  // still match the original "drag" along as you type (customized rows stay put).
  const handlePadLiveChange = useCallback((key: string, index: number, field: 'weight' | 'reps', n: number) => {
    const o = editOrigin.current;
    if (!o || o.key !== key || o.index !== index) return;
    liveEdit.current = { ...liveEdit.current, [field]: n };
    applyLiveSet(key, index, o.sets, liveEdit.current.weight, liveEdit.current.reps);
  }, [applyLiveSet]);

  // Hevy-style rep mirroring: when a set's weight settles, tie its reps to the set
  // directly above IFF the weights match (same working load) or the weight is 0
  // (bodyweight / not-yet-entered). Matching → mirror the row above's reps; diverging
  // → clear the reps that were merely auto-copied from that row. Routed through the
  // live snapshot so the change (and its downward cascade) is reflected immediately.
  const mirrorRepsToWeight = useCallback((key: string, index: number) => {
    const o = editOrigin.current;
    if (index <= 0 || !o || o.key !== key || o.index !== index) return;
    const above = o.sets[index - 1];
    if (!above) return;
    const { weight, reps } = liveEdit.current;
    let nextReps: number | null = null;
    if (weight === above.weight || weight === 0) {
      if (reps !== above.reps) nextReps = above.reps;
    } else if (reps === above.reps) {
      nextReps = 0; // stale copy of the row above, not typed — clear it
    }
    if (nextReps !== null) {
      liveEdit.current = { ...liveEdit.current, reps: nextReps };
      applyLiveSet(key, index, o.sets, liveEdit.current.weight, nextReps);
    }
  }, [applyLiveSet]);

  // Tapping "Done" on the number pad finalizes the set: check it off (starting
  // rest) and close the pad. The value + downward cascade already landed live as
  // the user typed (handlePadLiveChange), so Done just commits and completes.
  const handleNumberPadDone = useCallback(() => {
    if (!editing) return;
    if (editing.field === 'weight') mirrorRepsToWeight(editing.key, editing.index);
    const ex = draft.find(e => e.key === editing.key);
    const set = ex?.sets[editing.index];
    if (set && !set.done) {
      editSet(editing.key, editing.index, { done: true });
      startRestTimer(120, { exerciseName: ex?.name });
      if (isLastRemainingSet(draft, editing.key, editing.index)) addSetTo(editing.key);
    }
    editOrigin.current = null;
    setEditing(null);
  }, [editing, draft, editSet, startRestTimer, addSetTo, mirrorRepsToWeight]);

  // Handle plan completion from modal
  const handlePlanComplete = useCallback((planText: string) => {
    loadDraftFromText(planText, { asTarget: true });
    setShowPlanBuilder(false);
  }, [loadDraftFromText]);

  // Handle routine import — structured (uses the routine's resolved exerciseIds),
  // no text round-trip that could re-resolve names to the wrong equipment.
  const handleRoutineImport = useCallback((routine: CalculatedRoutine) => {
    loadDraftFromRoutine(routine);
    setShowRoutineImport(false);
  }, [loadDraftFromRoutine]);

  // Handle timer tap - toggle expansion and start rest if not resting
  const handleTimerTap = useCallback(() => {
    playHapticFeedback('light', false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (!isTimerExpanded) {
      if (!isResting) {
        startRestTimer(120); // 2 minutes default
      }
      setIsTimerExpanded(true);
    } else {
      setIsTimerExpanded(false);
    }
  }, [isTimerExpanded, isResting, startRestTimer]);

  // Handle finish rest
  const handleFinishRest = useCallback(() => {
    playHapticFeedback('medium', false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    skipRestTimer();
    setIsTimerExpanded(false);
  }, [skipRestTimer]);

  // Handle add time to rest
  const handleAddRestTime = useCallback((seconds: number) => {
    playHapticFeedback('light', false);
    addRestTime(seconds);
  }, [addRestTime]);

  // Handle finish button press
  const handleFinishPress = useCallback(() => {
    playHapticFeedback('medium', false);
    handleFinishWorkout();
  }, [handleFinishWorkout]);

  return (
    <SafeAreaView edges={['top']} style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
      <KeyboardAvoidingView
        style={layout.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header — overflow (utilities) · timer/title · Finish */}
        <View style={styles.header}>
            <View style={[styles.headerSide, { alignItems: 'flex-start' }]}>
              {hasWorkoutStarted && (
                <TouchableOpacity style={styles.cancelButton} onPress={handleDiscard} hitSlop={8}>
                  <Text variant="body" tone="secondary">
                    Cancel
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.headerCenter}>
              {hasWorkoutStarted ? (
                <TouchableOpacity onPress={handleTimerTap} activeOpacity={0.7}>
                  <RNView style={[
                    styles.timerContainer,
                    {
                      backgroundColor: isResting ? currentTheme.colors.primary : currentTheme.colors.surface,
                      borderColor: isResting ? currentTheme.colors.primary : currentTheme.colors.border,
                    }
                  ]}>
                    <Ionicons
                      name={isResting ? 'hourglass-outline' : 'time-outline'}
                      size={16}
                      color={isResting ? '#fff' : currentTheme.colors.accent}
                    />
                    <Text variant="emphasis" tone="primary" style={isResting && { color: '#fff' }}>
                      {isResting ? formattedRestTime : formatTime(elapsedTime)}
                    </Text>
                    {isResting && (
                      <Text variant="meta" style={[styles.restLabel, { color: 'rgba(255,255,255,0.8)' }]}>
                        REST
                      </Text>
                    )}
                  </RNView>
                </TouchableOpacity>
              ) : (
                <Text variant="title" weight="semiBold" tone="primary">
                  Workout
                </Text>
              )}
            </View>

            <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
              {hasWorkoutStarted ? (
                <Button
                  title="Finish"
                  variant="primary"
                  size="small"
                  onPress={handleFinishPress}
                  style={styles.finishButton}
                />
              ) : (
                <RNView style={[styles.unitSegment, { backgroundColor: ink.hairline }]}>
                  {(['lbs', 'kg'] as const).map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitSegmentBtn, weightUnit === u && { backgroundColor: currentTheme.colors.surface }]}
                      onPress={() => { playHapticFeedback('selection', false); setWeightUnitPref(u); }}
                    >
                      <Text variant="meta" tone={weightUnit === u ? 'primary' : 'muted'} style={styles.unitSegmentText}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </RNView>
              )}
            </View>
          </View>

        {/* Expanded Rest Timer */}
        {isTimerExpanded && hasWorkoutStarted && (
          <RNView style={[styles.expandedTimer, { backgroundColor: currentTheme.colors.surface }]}>
            <RNView style={styles.expandedTimerRow}>
              {/* Subtract time */}
              <IconButton
                icon="remove"
                onPress={() => handleAddRestTime(-30)}
                style={{ ...styles.adjustButton, backgroundColor: ink.hairline }}
              />

              {/* Rest timer display */}
              <RNView style={styles.expandedTimerCenter}>
                <Text variant="statHero">
                  {formattedRestTime}
                </Text>
                <Text variant="meta" tone="muted" style={styles.expandedTimerLabel}>
                  rest remaining
                </Text>
              </RNView>

              {/* Add time */}
              <IconButton
                icon="add"
                onPress={() => handleAddRestTime(30)}
                iconColor={currentTheme.colors.primary}
                style={{ ...styles.adjustButton, backgroundColor: tint(currentTheme.colors.primary) }}
              />
            </RNView>

            {/* Buttons row */}
            <RNView style={styles.expandedButtonsRow}>
              {/* Reset workout timer with duration — quiet wide button (keeps its
                  elapsed-time label, so it can't collapse to an icon-only control) */}
              <TouchableOpacity
                style={[styles.resetWorkoutButton, { backgroundColor: ink.hairline }]}
                onPress={resetWorkoutTimer}
              >
                <Text variant="meta" tone="secondary">
                  Restart Workout ({formatTime(elapsedTime)})
                </Text>
              </TouchableOpacity>

              {/* Done button */}
              <Button
                title="Done"
                variant="primary"
                onPress={handleFinishRest}
                style={styles.doneRestButton}
              />
            </RNView>
          </RNView>
        )}

        {/* Workout (fills) — the editable source of truth, with one empty state */}
        <View style={layout.flex1}>
          <EditableWorkout
            draft={draft}
            weightUnit={weightUnit}
            onEditField={openNumberPad}
            activeField={editing}
            onAddSet={addSetTo}
            onRemoveSet={removeSetFrom}
            onToggleDone={handleToggleDone}
            onRemoveExercise={removeExerciseFrom}
            onScrollBeginDrag={closeComposer}
          />
          {!hasWorkoutStarted && (
            /* RecentWorkouts owns the fresh-user case too: with no history it
               renders a full-view hero with the same launch actions. */
            <RecentWorkouts
              workouts={recentWorkouts}
              onPick={prefillWorkout}
              onQuickStart={handleQuickStart}
              onGenerate={() => setShowPlanBuilder(true)}
              onImport={() => setShowRoutineImport(true)}
              onScrollBeginDrag={closeComposer}
            />
          )}
          {hasWorkoutStarted && draft.length === 0 && (
            <RNView style={styles.empty} pointerEvents="none">
              <Ionicons name="barbell-outline" size={56} color={ink.ghost} />
              <Text variant="heading" weight="semiBold" tone="primary" style={styles.emptyTitle}>
                Empty workout
              </Text>
              <Text variant="body" tone="muted" style={styles.emptyText}>
                Add your first set below — type or speak it.
              </Text>
            </RNView>
          )}
        </View>

        {composerOpen ? (
          <>
            {/* Predictive card — previews the paused composer text, tap to commit */}
            <PredictiveCard text={composerText} weightUnit={weightUnit} onCommit={handleComposerSend} />

            {/* Composer (open) — auto-growing input + mic + send. No Done button:
                scrolling the workout, tapping outside, or swiping the keyboard down
                collapses it (the typed text stays cached for next time). */}
            <RNView style={{ ...styles.composerBar, paddingBottom: keyboardVisible ? 0 : TAB_BAR_CLEARANCE + space.lg }}>
              <RNView style={styles.composerRow}>
                <RNView style={[styles.composerInput, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}>
                  <WorkoutNoteInput
                    ref={noteInputRef}
                    value={composerText}
                    onChangeText={setComposerText}
                    onBlur={handleComposerBlur}
                    autoGrow
                    placeholder="Log a set — Bench 135×8"
                  />
                </RNView>
                <IconButton
                  icon={voice.isListening ? 'stop' : 'mic'}
                  onPress={handleMicPress}
                  iconColor={voice.isListening ? '#fff' : currentTheme.colors.text}
                  style={{ ...styles.circleBtn, backgroundColor: voice.isListening ? currentTheme.colors.accent : ink.hairline }}
                />
                <IconButton
                  icon="arrow-up"
                  onPress={handleComposerSend}
                  disabled={!composerText.trim()}
                  iconColor={composerText.trim() ? '#fff' : ink.faint}
                  style={{ ...styles.circleBtn, backgroundColor: composerText.trim() ? currentTheme.colors.primary : ink.hairline }}
                />
              </RNView>
            </RNView>
          </>
        ) : (
          /* Collapsed — a compose bar that opens the composer, plus a mic */
          <RNView style={{ ...styles.collapsedBar, paddingBottom: keyboardVisible ? space.sm : TAB_BAR_CLEARANCE + space.lg }}>
            <TouchableOpacity
              style={[styles.collapsedInput, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
              onPress={openComposer}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color={ink.secondary} />
              <Text variant="body" tone="secondary">
                Log a set — type or speak
              </Text>
            </TouchableOpacity>
            <IconButton
              icon={voice.isListening ? 'stop' : 'mic'}
              onPress={handleMicPress}
              iconColor={voice.isListening ? '#fff' : currentTheme.colors.text}
              style={{
                ...styles.fabCircle,
                backgroundColor: voice.isListening ? currentTheme.colors.accent : currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }}
            />
          </RNView>
        )}
      </KeyboardAvoidingView>

      {/* Finish Modal (handles parsing, confirmation, and celebration) */}
      <WorkoutFinishModal
        visible={showFinishModal}
        noteText={noteText}
        prebuiltWorkout={finishWorkout}
        duration={elapsedTime}
        weightUnit={weightUnit}
        onSave={handleSaveWorkout}
        onCancel={handleFinishCancel}
        onComplete={handleFinishComplete}
      />

      {/* Plan Builder Modal */}
      <PlanBuilderModal
        visible={showPlanBuilder}
        onComplete={handlePlanComplete}
        onCancel={() => setShowPlanBuilder(false)}
      />

      {/* Routine Import Modal */}
      <RoutineImportModal
        visible={showRoutineImport}
        onClose={() => setShowRoutineImport(false)}
        onImport={handleRoutineImport}
      />

      {/* Custom number pad for editing a set's weight / reps */}
      {(() => {
        if (!editing) return null;
        const set = draft.find(e => e.key === editing.key)?.sets[editing.index];
        if (!set) return null;
        const isWeight = editing.field === 'weight';
        return (
          <NumberPad
            visible
            seedKey={`${editing.key}-${editing.index}-${editing.field}`}
            label={isWeight ? 'Weight' : 'Reps'}
            unit={isWeight ? weightUnit : undefined}
            value={isWeight ? set.weight : set.reps}
            allowDecimal={isWeight}
            increments={isWeight ? (weightUnit === 'kg' ? [-5, -2.5, 2.5, 5] : [-10, -5, 5, 10]) : [-1, 1, 2, 5]}
            hasNext={isWeight}
            onChange={n => editSet(editing.key, editing.index, { [editing.field]: n })}
            onLiveChange={n => handlePadLiveChange(editing.key, editing.index, editing.field, n)}
            onNext={() => { mirrorRepsToWeight(editing.key, editing.index); setEditing(e => (e ? { ...e, field: 'reps' } : e)); }}
            onDone={handleNumberPadDone}
            onClose={() => { editOrigin.current = null; setEditing(null); }}
          />
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  composerBar: {
    // No bar background/border — the input pill and the two circle buttons each
    // float over the workout content, lined up by the row's flex-end alignment.
    paddingTop: space.sm,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: screenGutter,
    paddingBottom: space.sm,
  },
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: screenGutter,
    paddingTop: space.sm,
  },
  collapsedInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  fabCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  composerInput: {
    flex: 1,
    // Hug the input's measured height (WorkoutNoteInput drives it). overflow
    // hidden clips the text to the rounded border so glyphs can't spill out
    // past the corners as it grows or scrolls at max height. The 20pt radius is
    // deliberate geometry: radius.pill would balloon as the field grows tall.
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    // Float a touch above the input's baseline (the row aligns to flex-end).
    marginBottom: space.xs,
  },
  empty: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: screenGutter * 2,
  },
  emptyTitle: {
    marginTop: space.md,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: lineHeightFor(typeScale.body),
    marginBottom: space.sm,
    paddingHorizontal: space.section,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  headerSide: {
    width: 88,
    justifyContent: 'center',
  },
  cancelButton: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  // The lbs/kg thumb segment keeps its compact geometry (named exception) —
  // only its colors are tokenized.
  unitSegment: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 2,
  },
  unitSegmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  unitSegmentText: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: space.xs,
  },
  restLabel: {
    letterSpacing: track.caps,
    marginLeft: space.xs,
  },
  expandedTimer: {
    marginHorizontal: screenGutter,
    marginBottom: space.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.card,
  },
  expandedTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
  },
  expandedTimerCenter: {
    alignItems: 'center',
    minWidth: 100,
  },
  expandedTimerLabel: {
    marginTop: space.xs,
  },
  adjustButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
  },
  expandedButtonsRow: {
    flexDirection: 'row',
    marginTop: space.lg,
    gap: space.md,
  },
  resetWorkoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
  doneRestButton: {
    flex: 1,
  },
  finishButton: {
    // Keep the 40pt header row height stable (Button small is minHeight 36).
    height: 40,
  },
});
