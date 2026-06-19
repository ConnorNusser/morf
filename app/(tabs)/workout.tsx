import { Text, View } from '@/components/Themed';
import PlanBuilderModal from '@/components/workout/PlanBuilderModal';
import RoutineImportModal from '@/components/workout/RoutineImportModal';
import WorkoutFinishModal from '@/components/workout/WorkoutFinishModal';
import WorkoutKeywordsHelpModal from '@/components/workout/WorkoutKeywordsHelpModal';
import WorkoutNoteInput, { WorkoutNoteInputRef } from '@/components/workout/WorkoutNoteInput';
import EditableWorkout from '@/components/workout/EditableWorkout';
import { draftToParsedWorkout } from '@/lib/workout/workoutDraft';
import RecentWorkouts from '@/components/workout/RecentWorkouts';
import PredictiveCard from '@/components/workout/PredictiveCard';
import NumberPad from '@/components/workout/NumberPad';
import { useVoiceDictation } from '@/hooks/useVoiceDictation';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/components/CustomAlert';
import playHapticFeedback from '@/lib/utils/haptic';
import { layout } from '@/lib/ui/styles';
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

export default function WorkoutScreen() {
  const { currentTheme } = useTheme();
  const noteInputRef = useRef<WorkoutNoteInputRef>(null);

  // Workout session hook (handles note, timer, persistence, saving)
  const {
    composerText,
    setComposerText,
    commitComposer,
    commitText,
    draft,
    loadDraftFromText,
    editSet,
    addSetTo,
    removeSetFrom,
    toggleSetDone,
    removeExerciseFrom,
    acceptAutofill,
    dismissAutofill,
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
    customExercises,
  } = useWorkoutNoteSession();
  const { showAlert } = useAlert();

  // Composer collapses to floating compose + mic buttons; opens to the full bar.
  const [composerOpen, setComposerOpen] = useState(false);
  const openComposer = useCallback(() => {
    playHapticFeedback('light', false);
    setComposerOpen(true);
    setTimeout(() => noteInputRef.current?.focus(), 60);
  }, []);
  // Collapse the tab-bar clearance under the composer while the keyboard is up,
  // and treat the keyboard going away (scroll-to-dismiss, tap-outside, swipe-down)
  // as the signal to collapse the composer. The typed text lives in `composerText`
  // and is left untouched, so reopening picks up exactly where you left off.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => {
      setKeyboardVisible(false);
      setComposerOpen(false);
    });
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
    else if (a.type === 'skipRest') skipRestTimer();
    else if (a.type === 'startRest') {
      // A set was completed on the Lock Screen — resume its rest with the time
      // that's actually left (the countdown started when they tapped).
      const remaining = Math.round((a.endTime - Date.now()) / 1000);
      if (remaining > 1) startRestTimer(remaining);
    }
  }, [editSet, addRestTime, skipRestTimer, startRestTimer]);
  useEffect(() => {
    const drain = async () => { (await pullPendingActions()).forEach(applyPending); };
    drain();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') drain(); });
    return () => sub.remove();
  }, [applyPending]);

  // Pick a recent workout to repeat/edit.
  const handlePickRecent = useCallback((w: Parameters<typeof prefillWorkout>[0]) => {
    prefillWorkout(w);
  }, [prefillWorkout]);

  // Stable structured workout for the finish modal (rebuilt only when the draft
  // changes) — an inline object would re-fire the modal's parse effect every render.
  const finishWorkout = useMemo(() => draftToParsedWorkout(draft), [draft]);

  // Quick start: enter the active empty workout, then open the composer.
  const handleQuickStart = useCallback(() => {
    startEmptyWorkout();
    openComposer();
  }, [startEmptyWorkout, openComposer]);

  // Checking a set off (becoming done) auto-starts the rest countdown.
  const handleToggleDone = useCallback((key: string, index: number) => {
    const set = draft.find(e => e.key === key)?.sets[index];
    const becomingDone = set ? !set.done : false;
    toggleSetDone(key, index);
    if (becomingDone) startRestTimer(120);
  }, [draft, toggleSetDone, startRestTimer]);

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
  const [showHelpModal, setShowHelpModal] = useState(false);
  // Which set field the custom number pad is editing.
  const [editing, setEditing] = useState<{ key: string; index: number; field: 'weight' | 'reps' } | null>(null);
  const openNumberPad = useCallback((key: string, index: number, field: 'weight' | 'reps') => {
    Keyboard.dismiss();
    playHapticFeedback('light', false);
    setEditing({ key, index, field });
  }, []);

  // Tapping "Done" on the number pad finalizes the set: check it off (starting
  // rest) and close the pad. The pad has already flushed the typed value.
  const handleNumberPadDone = useCallback(() => {
    if (!editing) return;
    const set = draft.find(e => e.key === editing.key)?.sets[editing.index];
    if (set && !set.done) {
      editSet(editing.key, editing.index, { done: true });
      startRestTimer(120);
    }
    setEditing(null);
  }, [editing, draft, editSet, startRestTimer]);

  // Handle plan completion from modal
  const handlePlanComplete = useCallback((planText: string) => {
    loadDraftFromText(planText, { asTarget: true });
    setShowPlanBuilder(false);
  }, [loadDraftFromText]);

  // Handle routine import
  const handleRoutineImport = useCallback((text: string, _routineId: string) => {
    loadDraftFromText(text, { asTarget: true });
    setShowRoutineImport(false);
  }, [loadDraftFromText]);

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

  // Handle reset workout timer
  const handleResetWorkoutTimer = useCallback(() => {
    resetWorkoutTimer();
  }, [resetWorkoutTimer]);

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
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
            <View style={[styles.headerSide, { alignItems: 'flex-start', backgroundColor: 'transparent' }]}>
              {hasWorkoutStarted && (
                <TouchableOpacity style={styles.cancelButton} onPress={handleDiscard}>
                  <Text style={[styles.cancelButtonText, { color: currentTheme.colors.text + '99' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.headerCenter, { backgroundColor: 'transparent' }]}>
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
                    <Text style={[
                      styles.timerText,
                      { color: isResting ? '#fff' : currentTheme.colors.text }
                    ]}>
                      {isResting ? formattedRestTime : formatTime(elapsedTime)}
                    </Text>
                    {isResting && (
                      <Text style={[styles.restLabel, { color: 'rgba(255,255,255,0.8)' }]}>
                        REST
                      </Text>
                    )}
                  </RNView>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                  Workout
                </Text>
              )}
            </View>

            <View style={[styles.headerSide, { alignItems: 'flex-end', backgroundColor: 'transparent' }]}>
              {hasWorkoutStarted ? (
                <TouchableOpacity
                  style={[styles.finishButton, { backgroundColor: currentTheme.colors.accent }]}
                  onPress={handleFinishPress}
                >
                  <Text style={[styles.finishButtonText, { }]}>
                    Finish
                  </Text>
                </TouchableOpacity>
              ) : (
                <RNView style={[styles.unitSegment, { backgroundColor: currentTheme.colors.text + '0F' }]}>
                  {(['lbs', 'kg'] as const).map(u => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitSegmentBtn, weightUnit === u && { backgroundColor: currentTheme.colors.surface }]}
                      onPress={() => { playHapticFeedback('selection', false); setWeightUnitPref(u); }}
                    >
                      <Text style={[styles.unitSegmentText, { color: weightUnit === u ? currentTheme.colors.text : currentTheme.colors.text + '66' }]}>{u}</Text>
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
              <TouchableOpacity
                style={[styles.adjustButton, { backgroundColor: currentTheme.colors.text + '10' }]}
                onPress={() => handleAddRestTime(-30)}
              >
                <Ionicons name="remove" size={24} color={currentTheme.colors.text} />
              </TouchableOpacity>

              {/* Rest timer display */}
              <RNView style={styles.expandedTimerCenter}>
                <Text style={[styles.expandedTimerTime, { color: currentTheme.colors.primary }]}>
                  {formattedRestTime}
                </Text>
                <Text style={[styles.expandedTimerLabel, { color: currentTheme.colors.text + '60' }]}>
                  rest remaining
                </Text>
              </RNView>

              {/* Add time */}
              <TouchableOpacity
                style={[styles.adjustButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
                onPress={() => handleAddRestTime(30)}
              >
                <Ionicons name="add" size={24} color={currentTheme.colors.primary} />
              </TouchableOpacity>
            </RNView>

            {/* Buttons row */}
            <RNView style={styles.expandedButtonsRow}>
              {/* Reset workout timer with duration */}
              <TouchableOpacity
                style={[styles.resetWorkoutButton, { backgroundColor: currentTheme.colors.text + '10' }]}
                onPress={handleResetWorkoutTimer}
              >
                <Text style={[styles.resetWorkoutButtonText, { color: currentTheme.colors.text + '80' }]}>
                  Restart Workout ({formatTime(elapsedTime)})
                </Text>
              </TouchableOpacity>

              {/* Done button */}
              <TouchableOpacity
                style={[styles.doneRestButton, { backgroundColor: currentTheme.colors.accent }]}
                onPress={handleFinishRest}
              >
                <Text style={[styles.doneRestButtonText, { }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </RNView>
          </RNView>
        )}

        {/* Workout (fills) — the editable source of truth, with one empty state */}
        <View style={[layout.flex1, { backgroundColor: 'transparent' }]}>
          <EditableWorkout
            draft={draft}
            weightUnit={weightUnit}
            onEditSet={editSet}
            onEditField={openNumberPad}
            activeField={editing}
            onAddSet={addSetTo}
            onRemoveSet={removeSetFrom}
            onToggleDone={handleToggleDone}
            onRemoveExercise={removeExerciseFrom}
            onAcceptAutofill={acceptAutofill}
            onDismissAutofill={dismissAutofill}
          />
          {!hasWorkoutStarted && (
            recentWorkouts.length > 0 ? (
              <RecentWorkouts
                workouts={recentWorkouts}
                customExercises={customExercises}
                onPick={handlePickRecent}
                onQuickStart={handleQuickStart}
                onGenerate={() => setShowPlanBuilder(true)}
                onImport={() => setShowRoutineImport(true)}
              />
            ) : (
              <RNView style={styles.empty}>
                <Ionicons name="barbell-outline" size={30} color={currentTheme.colors.text + '30'} />
                <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                  Log your workout
                </Text>
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60' }]}>
                  Type or speak a set below — it appears here, ready to edit.
                </Text>
              </RNView>
            )
          )}
          {hasWorkoutStarted && draft.length === 0 && (
            <RNView style={styles.empty}>
              <Ionicons name="barbell-outline" size={30} color={currentTheme.colors.text + '30'} />
              <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                Empty workout
              </Text>
              <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60' }]}>
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
            <RNView style={{ ...styles.composerBar, paddingBottom: keyboardVisible ? 0 : TAB_BAR_CLEARANCE, borderTopColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.surface }}>
              <RNView style={styles.composerRow}>
                <RNView style={[styles.composerInput, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}>
                  <RNView style={layout.flex1}>
                    <WorkoutNoteInput
                      ref={noteInputRef}
                      value={composerText}
                      onChangeText={setComposerText}
                      autoGrow
                      placeholder="Log a set — e.g. Bench 135×8"
                    />
                  </RNView>
                </RNView>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: voice.isListening ? currentTheme.colors.accent : currentTheme.colors.text + '10' }]}
                  onPress={handleMicPress}
                >
                  <Ionicons name={voice.isListening ? 'stop' : 'mic'} size={20} color={voice.isListening ? '#fff' : currentTheme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: composerText.trim() ? currentTheme.colors.primary : currentTheme.colors.text + '10' }]}
                  onPress={handleComposerSend}
                  disabled={!composerText.trim()}
                >
                  <Ionicons name="arrow-up" size={20} color={composerText.trim() ? '#fff' : currentTheme.colors.text + '50'} />
                </TouchableOpacity>
              </RNView>
            </RNView>
          </>
        ) : (
          /* Collapsed — a compose bar that opens the composer, plus a mic */
          <RNView style={{ ...styles.collapsedBar, paddingBottom: keyboardVisible ? 8 : TAB_BAR_CLEARANCE + 14 }}>
            <TouchableOpacity
              style={[styles.collapsedInput, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
              onPress={openComposer}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color={currentTheme.colors.text + '88'} />
              <Text style={[styles.collapsedPlaceholder, { color: currentTheme.colors.text + '88' }]}>
                Log a set — type or speak
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fabCircle, { backgroundColor: voice.isListening ? currentTheme.colors.accent : currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
              onPress={handleMicPress}
            >
              <Ionicons name={voice.isListening ? 'stop' : 'mic'} size={22} color={voice.isListening ? '#fff' : currentTheme.colors.text} />
            </TouchableOpacity>
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

      {/* Help Modal */}
      <WorkoutKeywordsHelpModal
        visible={showHelpModal}
        onClose={() => setShowHelpModal(false)}
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
            onNext={() => setEditing(e => (e ? { ...e, field: 'reps' } : e))}
            onDone={handleNumberPadDone}
            onClose={() => setEditing(null)}
          />
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  composerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  collapsedInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  collapsedPlaceholder: {
    fontSize: 15,
  },
  fabCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 17,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 6,
  },
  repeatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  repeatButtonText: {
    fontSize: 13,
  },
  actionsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  actionsSheet: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  actionLabel: {
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerSide: {
    width: 88,
    justifyContent: 'center',
  },
  cancelButton: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  cancelButtonText: {
    fontSize: 15,
  },
  unitSegment: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 2,
  },
  unitSegmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
  },
  unitSegmentText: {
    fontSize: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  restLabel: {
    fontSize: 10,
    letterSpacing: 1,
    marginLeft: 2,
  },
  timerText: {
    fontSize: 16,
  },
  expandedTimer: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  expandedTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  expandedTimerCenter: {
    alignItems: 'center',
    minWidth: 100,
  },
  expandedTimerTime: {
    fontSize: 32,
  },
  expandedTimerLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  adjustButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedButtonsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  resetWorkoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  resetWorkoutButtonText: {
    fontSize: 13,
  },
  doneRestButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneRestButtonText: {
    color: '#fff',
    fontSize: 15,
  },
  headerTitle: {
    fontSize: 18,
  },
  finishButton: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});
