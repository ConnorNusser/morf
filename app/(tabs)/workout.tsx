import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial';
import PlanBuilderModal from '@/components/workout/PlanBuilderModal';
import WorkoutSummaryModal from '@/components/workout/WorkoutSummaryModal';
import TemplateLibraryModal from '@/components/workout/TemplateLibraryModal';
import WorkoutFinishModal from '@/components/workout/WorkoutFinishModal';
import WorkoutKeywordsHelpModal from '@/components/workout/WorkoutKeywordsHelpModal';
import WorkoutNoteInput, { WorkoutNoteInputRef } from '@/components/workout/WorkoutNoteInput';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { layout } from '@/lib/ui/styles';
import { useRestTimer } from '@/hooks/useRestTimer';
import { useWorkoutNoteSession } from '@/hooks/useWorkoutNoteSession';
import { WorkoutTemplate } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
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
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Handle plan completion from modal
  const handlePlanComplete = useCallback((planText: string) => {
    setNoteText(planText);
    setShowPlanBuilder(false);
  }, [setNoteText]);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: WorkoutTemplate) => {
    setNoteText(template.noteText);
    setShowTemplateLibrary(false);
  }, [setNoteText]);

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
          <View style={[styles.header, { backgroundColor: 'transparent' }]}>
            <View style={[styles.headerLeft, { backgroundColor: 'transparent' }]}>
              {hasWorkoutStarted ? (
                <TouchableOpacity
                  style={[styles.summaryButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border, borderWidth: 1 }]}
                  onPress={handleQuickSummary}
                >
                  <Ionicons name="list-outline" size={16} color={currentTheme.colors.text} />
                  <Text style={[styles.summaryButtonText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
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
                    {
                      color: isResting ? '#fff' : currentTheme.colors.text,
                      fontFamily: 'Raleway_600SemiBold'
                    }
                  ]}>
                    {isResting ? formattedRestTime : formatTime(elapsedTime)}
                  </Text>
                  {isResting && (
                    <Text style={[styles.restLabel, { color: 'rgba(255,255,255,0.8)', fontFamily: 'Raleway_500Medium' }]}>
                      REST
                    </Text>
                  )}
                </RNView>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
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
                <Text style={[styles.finishButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
                  Finish
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
                onPress={() => setShowTemplateLibrary(true)}
              >
                <Ionicons name="download-outline" size={20} color={currentTheme.colors.primary} />
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
                <Text style={[styles.expandedTimerTime, { color: currentTheme.colors.primary, fontFamily: 'Raleway_700Bold' }]}>
                  {formattedRestTime}
                </Text>
                <Text style={[styles.expandedTimerLabel, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
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
                <Text style={[styles.resetWorkoutButtonText, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                  Restart Workout ({formatTime(elapsedTime)})
                </Text>
              </TouchableOpacity>

              {/* Done button */}
              <TouchableOpacity
                style={[styles.doneRestButton, { backgroundColor: currentTheme.colors.accent }]}
                onPress={handleFinishRest}
              >
                <Text style={[styles.doneRestButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </RNView>
          </RNView>
        )}

        {/* Quick Summary Toast */}
        <WorkoutSummaryModal
          visible={showSummary}
          exercises={parsedExercises}
          isLoading={summaryLoading}
          onDismiss={() => setShowSummary(false)}
        />

        {/* Main Content - Notes Input */}
        <TutorialTarget id="workout-note-input" style={layout.flex1}>
          <View style={[layout.flex1, { backgroundColor: 'transparent' }]}>
            <WorkoutNoteInput
              ref={noteInputRef}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={`Start typing your workout...

Examples:
Bench 135x8, 155x6
Squats 225 for 5 reps`}
            />
          </View>
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

      {/* Template Library Modal */}
      <TemplateLibraryModal
        visible={showTemplateLibrary}
        onClose={() => setShowTemplateLibrary(false)}
        onSelectTemplate={handleTemplateSelect}
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
