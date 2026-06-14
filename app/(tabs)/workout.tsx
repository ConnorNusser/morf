import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial';
import PlanBuilderModal from '@/components/workout/PlanBuilderModal';
import RoutineImportModal from '@/components/workout/RoutineImportModal';
import WorkoutFinishModal from '@/components/workout/WorkoutFinishModal';
import WorkoutKeywordsHelpModal from '@/components/workout/WorkoutKeywordsHelpModal';
import WorkoutNoteInput, { WorkoutNoteInputRef } from '@/components/workout/WorkoutNoteInput';
import { useTheme } from '@/contexts/ThemeContext';
import { getPendingRoutine } from '@/lib/workout/pendingRoutine';
import playHapticFeedback from '@/lib/utils/haptic';
import { layout } from '@/lib/ui/styles';
import { useRestTimer } from '@/hooks/useRestTimer';
import { useWorkoutNoteSession } from '@/hooks/useWorkoutNoteSession';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View as RNView,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WorkoutScreen() {
  const { currentTheme } = useTheme();
  const noteInputRef = useRef<WorkoutNoteInputRef>(null);

  // Workout session hook (handles note, timer, persistence, saving)
  const {
    noteText,
    setNoteText,
    elapsedTime,
    formatTime,
    resetWorkoutTimer,
    showSummary,
    setShowSummary,
    summaryLoading,
    parsedExercises,
    handleQuickSummary,
    showFinishModal,
    handleFinishWorkout,
    handleSaveWorkout,
    handleFinishComplete,
    handleFinishCancel,
    hasWorkoutStarted,
    weightUnit,
  } = useWorkoutNoteSession();

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

  // Gentle "breathing" pulse on the rest-timer chip while resting — a calm,
  // living cue that the clock is counting, without nagging the lifter.
  const restPulse = useSharedValue(1);
  useEffect(() => {
    if (isResting) {
      restPulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 850, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(restPulse);
      restPulse.value = withTiming(1, { duration: 200 });
    }
    return () => cancelAnimation(restPulse);
  }, [isResting, restPulse]);

  const restPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: restPulse.value }],
  }));

  // Handle plan completion from modal
  const handlePlanComplete = useCallback((planText: string) => {
    setNoteText(planText);
    setShowPlanBuilder(false);
  }, [setNoteText]);

  // Handle routine import
  const handleRoutineImport = useCallback((text: string, _routineId: string) => {
    setNoteText(text);
    setShowRoutineImport(false);
  }, [setNoteText]);

  // Check for pending routine text from Routines tab
  useFocusEffect(
    useCallback(() => {
      const text = getPendingRoutine();
      if (text) {
        setNoteText(text);
      }
    }, [setNoteText])
  );

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
    <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
      <KeyboardAvoidingView
        style={layout.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <TutorialTarget id="workout-header-buttons">
          <Animated.View entering={FadeInDown.duration(400).springify().damping(18)} style={[styles.header, { backgroundColor: 'transparent' }]}>
            <View style={[styles.headerLeft, { backgroundColor: 'transparent' }]}>
              {hasWorkoutStarted ? (
                <TouchableOpacity
                  style={[styles.summaryButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border, borderWidth: 1 }]}
                  onPress={handleQuickSummary}
                >
                  <Ionicons name="list-outline" size={16} color={currentTheme.colors.text} />
                  <Text style={[styles.summaryButtonText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                    Summary
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.headerButtonGroup, { backgroundColor: 'transparent' }]}>
                  <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
                    onPress={() => setShowPlanBuilder(true)}
                  >
                    <Ionicons name="sparkles" size={20} color={currentTheme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: currentTheme.colors.text + '10' }]}
                    onPress={() => setShowHelpModal(true)}
                  >
                    <Ionicons name="information-circle-outline" size={20} color={currentTheme.colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

          <View style={[styles.headerCenter, { backgroundColor: 'transparent' }]}>
            {hasWorkoutStarted ? (
              <TouchableOpacity onPress={handleTimerTap} activeOpacity={0.7}>
                <Animated.View style={[
                  styles.timerContainer,
                  {
                    backgroundColor: isResting ? currentTheme.colors.primary : currentTheme.colors.surface,
                    borderColor: isResting ? currentTheme.colors.primary : currentTheme.colors.border,
                  },
                  restPulseStyle,
                ]}>
                  <Ionicons
                    name={isResting ? 'hourglass-outline' : 'time-outline'}
                    size={16}
                    color={isResting ? '#fff' : currentTheme.colors.accent}
                  />
                  <Text style={[
                    styles.timerText,
                    {
                      color: isResting ? '#fff' : currentTheme.colors.text,
                      fontFamily: currentTheme.fonts.semiBold
                    }
                  ]}>
                    {isResting ? formattedRestTime : formatTime(elapsedTime)}
                  </Text>
                  {isResting && (
                    <Text style={[styles.restLabel, { color: 'rgba(255,255,255,0.8)', fontFamily: currentTheme.fonts.medium }]}>
                      REST
                    </Text>
                  )}
                </Animated.View>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                Workout
              </Text>
            )}
          </View>

          <View style={[styles.headerRight, { backgroundColor: 'transparent' }]}>
            {hasWorkoutStarted ? (
              <TouchableOpacity
                style={[styles.finishButton, { backgroundColor: currentTheme.colors.accent }]}
                onPress={handleFinishPress}
              >
                <Text style={[styles.finishButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>
                  Finish
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
                onPress={() => setShowRoutineImport(true)}
              >
                <Ionicons name="download-outline" size={20} color={currentTheme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          </Animated.View>
        </TutorialTarget>

        {/* Expanded Rest Timer */}
        {isTimerExpanded && hasWorkoutStarted && (
          <Animated.View entering={FadeInDown.duration(280).springify().damping(16)} style={[styles.expandedTimer, { backgroundColor: currentTheme.colors.surface }]}>
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
          </Animated.View>
        )}

        {/* Quick Summary Preview */}
        <WorkoutFinishModal
          visible={showSummary}
          noteText={noteText}
          duration={elapsedTime}
          isPreviewMode={true}
          exercises={parsedExercises}
          isLoading={summaryLoading}
          onDismiss={() => setShowSummary(false)}
        />

        {/* Main Content - Notes Input */}
        <TutorialTarget id="workout-note-input" style={layout.flex1}>
          <Animated.View entering={FadeIn.delay(120).duration(450)} style={[layout.flex1, { backgroundColor: 'transparent' }]}>
            <WorkoutNoteInput
              ref={noteInputRef}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={`Start typing your workout...

Examples:
Bench 135x8, 155x6
Squats 225 for 5 reps`}
            />
          </Animated.View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerLeft: {
    minWidth: 90,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    minWidth: 90,
    alignItems: 'flex-end',
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
  summaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  summaryButtonText: {
    fontSize: 14,
  },
  finishButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
});
