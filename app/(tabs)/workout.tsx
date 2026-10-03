import { useAlert } from "@/components/CustomAlert";
import RestBar from "@/components/workout/RestBar";
import RestTimerSheet from "@/components/workout/RestTimerSheet";
import WorkoutClockSheet from "@/components/workout/WorkoutClockSheet";
import { View } from "@/components/Themed";
import EditableWorkout from "@/components/workout/EditableWorkout";
import HoldTimer from "@/components/workout/HoldTimer";
import PlanBuilderModal from "@/components/workout/PlanBuilderModal";
import RecentWorkouts from "@/components/workout/RecentWorkouts";
import RoutineImportModal from "@/components/workout/RoutineImportModal";
import WorkoutFinishModal from "@/components/workout/WorkoutFinishModal";
import ComposerDock, {
  COMPOSER_DOCK_HEIGHT,
} from "@/components/workout/session/ComposerDock";
import EmptyWorkoutOverlay from "@/components/workout/session/EmptyWorkoutOverlay";
import SetNumberPad from "@/components/workout/session/SetNumberPad";
import WorkoutHeader from "@/components/workout/session/WorkoutHeader";
import ScreenBackground from "@/components/ui/ScreenBackground";
import { DEFAULT_REST_SECONDS, useRestTimer } from "@/hooks/useRestTimer";
import { useSetNumberPad } from "@/hooks/useSetNumberPad";
import { useVoiceLogging } from "@/hooks/useVoiceLogging";
import { useWorkoutComposer } from "@/hooks/useWorkoutComposer";
import { useWorkoutLiveActivity } from "@/hooks/useWorkoutLiveActivity";
import { useWorkoutPrompts } from "@/hooks/useWorkoutPrompts";
import { useWorkoutSession } from "@/hooks/useWorkoutSession";
import { layout } from "@/lib/ui/styles";
import playHapticFeedback from "@/lib/utils/haptic";
import { getPendingQuickStart } from "@/lib/workout/pendingRoutine";
import { draftToParsedWorkout } from "@/lib/workout/workoutDraft";
import type { CalculatedRoutine } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  TouchableOpacity,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WorkoutScreen() {
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
    addWarmupSetTo,
    removeSetFrom,
    toggleSetDone,
    removeExerciseFrom,
    moveExercise,
    moveExerciseToEdge,
    getPreviousSets,
    getStartedRoutineChange,
    syncStartedRoutine,

    logText,
    elapsedTime,
    isPaused,
    pauseWorkout,
    resumeWorkout,
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
  } = useWorkoutSession();
  const router = useRouter();

  // After the finish celebration is dismissed, land the user where the reward is:
  // a strength win (PR / achievement / percentile move) → History, where the bars
  // sweep up from the pre-workout values. Otherwise → the feed (Home in feed mode),
  // where their just-posted workout sits at the top, primed for kudos — always
  // non-flat, unlike a History screen that didn't move.
  const handleFinishAndCelebrate = useCallback(
    (strengthWin: boolean) => {
      handleFinishComplete();
      router.replace(
        strengthWin ? "/(tabs)/history?celebrate=1" : "/(tabs)?feed=1",
      );
    },
    [handleFinishComplete, router],
  );
  const { showAlert } = useAlert();

  // Composer dock: open/collapsed state, its input ref, and the measured keyboard.
  const {
    noteInputRef,
    composerOpen,
    openComposer,
    handleComposerBlur,
    closeComposer,
    keyboardVisible,
    keyboardHeight,
  } = useWorkoutComposer();

  // Rest timer hook
  const {
    isResting,
    remainingTime: restRemaining,
    totalDuration: restDuration,
    formattedTime: formattedRestTime,
    startTimer: startRestTimer,
    skipTimer: skipRestTimer,
    addTime: addRestTime,
  } = useRestTimer();

  // Live Activity: the current-set card (Lock Screen / Dynamic Island), plus
  // folding Lock-Screen taps back into the draft on return to the foreground.
  useWorkoutLiveActivity({
    draft,
    isResting,
    hasWorkoutStarted,
    editSet,
    addSetTo,
    addRestTime,
    skipRestTimer,
    startRestTimer,
  });

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

  // Checking a set off (becoming done) auto-starts the rest countdown and surfaces
  // the full rest screen. Sets are never auto-appended — add more with the explicit
  // "Add set" button — so incomplete phantom sets can't pile up in history.
  const handleToggleDone = useCallback(
    (key: string, index: number) => {
      const ex = draft.find((e) => e.key === key);
      const set = ex?.sets[index];
      const becomingDone = set ? !set.done : false;
      toggleSetDone(key, index);
      if (becomingDone) {
        startRestTimer(DEFAULT_REST_SECONDS, { exerciseName: ex?.name });
        setShowRestSheet(true);
      }
    },
    [draft, toggleSetDone, startRestTimer],
  );

  // Commit the composer text into the structured workout.
  const handleComposerSend = useCallback(() => {
    playHapticFeedback("medium", false);
    commitComposer();
  }, [commitComposer]);

  // Voice: each finished phrase is parsed straight into the workout, hands-free.
  const { voice, handleMicPress } = useVoiceLogging(commitText, showAlert);

  // Ease the rest bar in/out as rests start and end so the list below doesn't jump.
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [isResting]);
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);
  const [showRoutineImport, setShowRoutineImport] = useState(false);
  // Full-screen rest sheet (tap the pill or the rest bar while resting).
  const [showRestSheet, setShowRestSheet] = useState(false);
  // Full-screen workout clock (tap the pill while not resting) — owns
  // pause/resume/rest/restart so the header stays clean.
  const [showClockSheet, setShowClockSheet] = useState(false);
  // Full-screen hold timer target (timed exercises: dead hang, plank…).
  const [holdTarget, setHoldTarget] = useState<{
    key: string;
    index: number;
    name: string;
  } | null>(null);
  // Custom number pad for editing a set's weight / reps (live target cascade).
  const {
    editing,
    openNumberPad,
    handlePadLiveChange,
    handleNumberPadNext,
    handleNumberPadDone,
    closeNumberPad,
  } = useSetNumberPad({ draft, editSet, applyLiveSet, startRestTimer });

  // Handle plan completion from modal
  const handlePlanComplete = useCallback(
    (planText: string) => {
      loadDraftFromText(planText, { asTarget: true });
      setShowPlanBuilder(false);
    },
    [loadDraftFromText],
  );

  // Handle routine import — structured (uses the routine's resolved exerciseIds),
  // no text round-trip that could re-resolve names to the wrong equipment.
  const handleRoutineImport = useCallback(
    (routine: CalculatedRoutine) => {
      loadDraftFromRoutine(routine);
      setShowRoutineImport(false);
    },
    [loadDraftFromRoutine],
  );

  // Tapping the header clock starts a rest when none is running (the rest bar
  // appears on its own); while paused it resumes; while resting it's a readout.
  const handleTimerTap = useCallback(() => {
    playHapticFeedback("light", false);
    if (isResting) setShowRestSheet(true);
    else setShowClockSheet(true);
  }, [isResting]);

  // Header confirmations: discard, restart the clock (long-press), and the
  // "update your routine?" offer before the finish flow.
  const { handleDiscard, handleTimerLongPress, handleFinishPress } =
    useWorkoutPrompts({
      showAlert,
      noteInputRef,
      discardWorkout,
      formatTime,
      elapsedTime,
      resetWorkoutTimer,
      getStartedRoutineChange,
      syncStartedRoutine,
      handleFinishWorkout,
    });

  // Skip the rest countdown from the rest bar.
  const handleSkipRest = useCallback(() => {
    playHapticFeedback("medium", false);
    skipRestTimer();
  }, [skipRestTimer]);

  return (
    <ScreenBackground>
    <SafeAreaView edges={["top"]} style={layout.flex1}>
      <KeyboardAvoidingView
        style={layout.flex1}
        // No behavior: the only keyboard-avoided surface is the floating dock,
        // which lifts itself via measured keyboardHeight (below). Padding here
        // would push the top content and double-offset the dock.
        behavior={undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header — overflow (utilities) · timer/title · Finish */}
        <WorkoutHeader
          hasWorkoutStarted={hasWorkoutStarted}
          isResting={isResting}
          isPaused={isPaused}
          formattedRestTime={formattedRestTime}
          elapsedTime={elapsedTime}
          formatTime={formatTime}
          weightUnit={weightUnit}
          onSelectUnit={setWeightUnitPref}
          onDiscard={handleDiscard}
          onTimerTap={handleTimerTap}
          onTimerLongPress={handleTimerLongPress}
          onFinish={handleFinishPress}
        />

        {/* Rest bar — appears on its own while a rest is running */}
        {isResting && hasWorkoutStarted && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => setShowRestSheet(true)}>
            <RestBar
              remaining={restRemaining}
              duration={restDuration}
              formatted={formattedRestTime}
              onAdjust={addRestTime}
              onSkip={handleSkipRest}
            />
          </TouchableOpacity>
        )}

        {/* Workout (fills) — the editable source of truth, with one empty state */}
        <View style={layout.flex1}>
          <EditableWorkout
            draft={draft}
            weightUnit={weightUnit}
            onEditField={openNumberPad}
            activeField={editing}
            onStartHold={(key, index) => {
              const name = draft.find((e) => e.key === key)?.name ?? "Hold";
              setHoldTarget({ key, index, name });
            }}
            onAddSet={addSetTo}
            onAddWarmupSet={addWarmupSetTo}
            onRemoveSet={removeSetFrom}
            onToggleDone={handleToggleDone}
            onRemoveExercise={removeExerciseFrom}
            onMoveExercise={moveExercise}
            onMoveExerciseToEdge={moveExerciseToEdge}
            getPreviousSets={getPreviousSets}
            onScrollBeginDrag={closeComposer}
            bottomInset={COMPOSER_DOCK_HEIGHT}
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
              bottomInset={COMPOSER_DOCK_HEIGHT}
            />
          )}
          {hasWorkoutStarted && draft.length === 0 && (
            <EmptyWorkoutOverlay
              keyboardVisible={keyboardVisible}
              keyboardHeight={keyboardHeight}
              onPress={closeComposer}
            />
          )}
        </View>

        {/* Floating composer dock — overlays the list bottom so the workout uses the
            full height and scrolls behind it. */}
        <ComposerDock
          open={composerOpen}
          text={composerText}
          onChangeText={setComposerText}
          inputRef={noteInputRef}
          weightUnit={weightUnit}
          keyboardVisible={keyboardVisible}
          keyboardHeight={keyboardHeight}
          isListening={voice.isListening}
          onOpen={openComposer}
          onBlur={handleComposerBlur}
          onSend={handleComposerSend}
          onMicPress={handleMicPress}
        />
      </KeyboardAvoidingView>

      {/* Finish Modal (handles parsing, confirmation, and celebration) */}
      <WorkoutFinishModal
        visible={showFinishModal}
        logText={logText}
        prebuiltWorkout={finishWorkout}
        duration={elapsedTime}
        weightUnit={weightUnit}
        onSave={handleSaveWorkout}
        onCancel={handleFinishCancel}
        onComplete={handleFinishAndCelebrate}
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

      {/* Full-screen workout clock — pause/resume, rest, restart in one place */}
      <WorkoutClockSheet
        visible={showClockSheet && hasWorkoutStarted && !isResting}
        formatted={formatTime(elapsedTime)}
        isPaused={isPaused}
        onPause={pauseWorkout}
        onResume={resumeWorkout}
        onStartRest={() => startRestTimer(DEFAULT_REST_SECONDS)}
        onRestart={() => {
          setShowClockSheet(false);
          handleTimerLongPress();
        }}
        onClose={() => setShowClockSheet(false)}
      />

      {/* Full-screen rest countdown — swipe down (pageSheet) or chevron to dismiss */}
      <RestTimerSheet
        visible={showRestSheet && isResting}
        formatted={formattedRestTime}
        remaining={restRemaining}
        duration={restDuration}
        onAdjust={addRestTime}
        onSkip={handleSkipRest}
        onClose={() => setShowRestSheet(false)}
      />

      {/* Full-screen count-up for timed holds; Stop logs duration + checks off */}
      <HoldTimer
        visible={holdTarget != null}
        exerciseName={holdTarget?.name ?? ""}
        setNumber={(holdTarget?.index ?? 0) + 1}
        onStop={(seconds) => {
          if (holdTarget) {
            editSet(holdTarget.key, holdTarget.index, {
              duration: seconds,
              done: true,
            });
            startRestTimer(DEFAULT_REST_SECONDS, {
              exerciseName: holdTarget.name,
            });
            setShowRestSheet(true);
          }
          setHoldTarget(null);
        }}
        onCancel={() => setHoldTarget(null)}
      />

      {/* Custom number pad for editing a set's weight / reps */}
      <SetNumberPad
        editing={editing}
        draft={draft}
        weightUnit={weightUnit}
        editSet={editSet}
        onLiveChange={handlePadLiveChange}
        onNext={handleNumberPadNext}
        onDone={handleNumberPadDone}
        onClose={closeNumberPad}
      />
    </SafeAreaView>
    </ScreenBackground>
  );
}
