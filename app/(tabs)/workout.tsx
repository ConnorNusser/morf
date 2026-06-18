import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial';
import PlanBuilderModal from '@/components/workout/PlanBuilderModal';
import RoutineImportModal from '@/components/workout/RoutineImportModal';
import WorkoutFinishModal from '@/components/workout/WorkoutFinishModal';
import WorkoutKeywordsHelpModal from '@/components/workout/WorkoutKeywordsHelpModal';
import WorkoutNoteInput, { WorkoutNoteInputRef } from '@/components/workout/WorkoutNoteInput';
import EditableWorkout from '@/components/workout/EditableWorkout';
import { useVoiceDictation } from '@/hooks/useVoiceDictation';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/components/CustomAlert';
import playHapticFeedback from '@/lib/utils/haptic';
import { layout } from '@/lib/ui/styles';
import { useRestTimer } from '@/hooks/useRestTimer';
import { useWorkoutNoteSession } from '@/hooks/useWorkoutNoteSession';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
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
    lastWorkoutTitle,
    prefillLastWorkout,
  } = useWorkoutNoteSession();
  const { showAlert } = useAlert();

  // Collapse the tab-bar clearance under the composer while the keyboard is up.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Discard the current workout (from the overflow menu), with a confirm.
  const handleDiscard = useCallback(() => {
    setShowActions(false);
    showAlert({
      title: 'Discard workout?',
      message: "This clears everything you've logged in this session. It can't be undone.",
      buttons: [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => discardWorkout() },
      ],
    });
  }, [showAlert, discardWorkout]);

  // Repeat the last workout into the editable draft.
  const handleRepeatLast = useCallback(() => {
    playHapticFeedback('medium', false);
    prefillLastWorkout();
  }, [prefillLastWorkout]);

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
    voice.toggle();
  }, [voice]);

  // Rest timer hook
  const {
    isResting,
    formattedTime: formattedRestTime,
    startTimer: startRestTimer,
    skipTimer: skipRestTimer,
    addTime: addRestTime,
  } = useRestTimer();

  // UI state (modals, expanded timer)
  const [isTimerExpanded, setIsTimerExpanded] = useState(false);
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);
  const [showRoutineImport, setShowRoutineImport] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showActions, setShowActions] = useState(false);

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
        <TutorialTarget id="workout-header-buttons">
          <View style={[styles.header, { backgroundColor: 'transparent' }]}>
            <View style={[styles.headerSide, { alignItems: 'flex-start', backgroundColor: 'transparent' }]}>
              <TouchableOpacity
                style={[styles.circleBtn, { backgroundColor: currentTheme.colors.text + '10' }]}
                onPress={() => setShowActions(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={currentTheme.colors.text} />
              </TouchableOpacity>
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
                      { color: isResting ? '#fff' : currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }
                    ]}>
                      {isResting ? formattedRestTime : formatTime(elapsedTime)}
                    </Text>
                    {isResting && (
                      <Text style={[styles.restLabel, { color: 'rgba(255,255,255,0.8)', fontFamily: currentTheme.fonts.medium }]}>
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
              {hasWorkoutStarted && (
                <TouchableOpacity
                  style={[styles.finishButton, { backgroundColor: currentTheme.colors.accent }]}
                  onPress={handleFinishPress}
                >
                  <Text style={[styles.finishButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>
                    Finish
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TutorialTarget>

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
                <Text style={[styles.expandedTimerTime, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.bold }]}>
                  {formattedRestTime}
                </Text>
                <Text style={[styles.expandedTimerLabel, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
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
                <Text style={[styles.resetWorkoutButtonText, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.medium }]}>
                  Restart Workout ({formatTime(elapsedTime)})
                </Text>
              </TouchableOpacity>

              {/* Done button */}
              <TouchableOpacity
                style={[styles.doneRestButton, { backgroundColor: currentTheme.colors.accent }]}
                onPress={handleFinishRest}
              >
                <Text style={[styles.doneRestButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>
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
            onAddSet={addSetTo}
            onRemoveSet={removeSetFrom}
            onToggleDone={toggleSetDone}
            onRemoveExercise={removeExerciseFrom}
            onAcceptAutofill={acceptAutofill}
            onDismissAutofill={dismissAutofill}
          />
          {!hasWorkoutStarted && (
            <RNView style={styles.empty}>
              <Ionicons name="barbell-outline" size={30} color={currentTheme.colors.text + '30'} />
              <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                Log your workout
              </Text>
              <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                Type or speak a set below — it appears here, ready to edit.
              </Text>
              {lastWorkoutTitle && (
                <TouchableOpacity
                  style={[styles.repeatButton, { backgroundColor: currentTheme.colors.primary + '15', borderColor: currentTheme.colors.primary + '40' }]}
                  onPress={handleRepeatLast}
                  activeOpacity={0.7}
                >
                  <Ionicons name="repeat" size={16} color={currentTheme.colors.primary} />
                  <Text style={[styles.repeatButtonText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
                    Repeat last workout
                  </Text>
                </TouchableOpacity>
              )}
            </RNView>
          )}
        </View>

        {/* Composer (bottom) — type or speak a set; it's added to the workout above */}
        <TutorialTarget id="workout-note-input" style={{ ...styles.composerBar, paddingBottom: keyboardVisible ? 6 : TAB_BAR_CLEARANCE, borderTopColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.surface }}>
          <RNView style={styles.composerRow}>
            <RNView style={styles.composerInput}>
              <WorkoutNoteInput
                ref={noteInputRef}
                value={composerText}
                onChangeText={setComposerText}
                compact
                placeholder="Type or speak a set — e.g. Bench 135x8, 155x6"
              />
            </RNView>
            {voice.available && (
              <TouchableOpacity
                style={[styles.circleBtn, { backgroundColor: voice.isListening ? currentTheme.colors.accent : currentTheme.colors.text + '10' }]}
                onPress={handleMicPress}
              >
                <Ionicons name={voice.isListening ? 'stop' : 'mic'} size={20} color={voice.isListening ? '#fff' : currentTheme.colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.circleBtn, { backgroundColor: composerText.trim() ? currentTheme.colors.primary : currentTheme.colors.text + '10' }]}
              onPress={handleComposerSend}
              disabled={!composerText.trim()}
            >
              <Ionicons name="arrow-up" size={20} color={composerText.trim() ? '#fff' : currentTheme.colors.text + '50'} />
            </TouchableOpacity>
          </RNView>
        </TutorialTarget>
      </KeyboardAvoidingView>

      {/* Finish Modal (handles parsing, confirmation, and celebration) */}
      <WorkoutFinishModal
        visible={showFinishModal}
        noteText={noteText}
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

      {/* Overflow actions — the utilities that used to clutter the header */}
      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={styles.actionsBackdrop} activeOpacity={1} onPress={() => setShowActions(false)}>
          <RNView style={[styles.actionsSheet, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
            {[
              { icon: 'sparkles' as const, label: 'Generate a plan', run: () => setShowPlanBuilder(true) },
              { icon: 'download-outline' as const, label: 'Import a routine', run: () => setShowRoutineImport(true) },
              { icon: 'help-circle-outline' as const, label: 'How logging works', run: () => setShowHelpModal(true) },
            ].map((a, i) => (
              <TouchableOpacity
                key={a.label}
                style={[styles.actionRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: currentTheme.colors.border }]}
                onPress={() => {
                  playHapticFeedback('light', false);
                  setShowActions(false);
                  a.run();
                }}
              >
                <Ionicons name={a.icon} size={20} color={currentTheme.colors.primary} />
                <Text style={[styles.actionLabel, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            {hasWorkoutStarted && (
              <TouchableOpacity
                style={[styles.actionRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: currentTheme.colors.border }]}
                onPress={handleDiscard}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.actionLabel, { color: '#FF3B30', fontFamily: currentTheme.fonts.medium }]}>Discard workout</Text>
              </TouchableOpacity>
            )}
          </RNView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  composerBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  composerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  composerInput: {
    flex: 1,
    alignSelf: 'stretch',
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
