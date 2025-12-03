import { Text, View } from '@/components/Themed';
import PlanBuilderModal from '@/components/workout/PlanBuilderModal';
import QuickSummaryToast from '@/components/workout/QuickSummaryToast';
import TemplateLibraryModal from '@/components/workout/TemplateLibraryModal';
import WorkoutFinishModal from '@/components/workout/WorkoutFinishModal';
import WorkoutKeywordsHelpModal from '@/components/workout/WorkoutKeywordsHelpModal';
import WorkoutNoteInput, { WorkoutNoteInputRef } from '@/components/workout/WorkoutNoteInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import playHapticFeedback from '@/lib/haptic';
import { useRestTimer } from '@/hooks/useRestTimer';
import { storageService } from '@/lib/storage';
import { userService } from '@/lib/userService';
import { ParsedExerciseSummary, ParsedWorkout , workoutNoteParser } from '@/lib/workoutNoteParser';
import { isMainLift, WeightUnit, WorkoutTemplate } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
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
  const { refreshProfile } = useUser();
  const noteInputRef = useRef<WorkoutNoteInputRef>(null);

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

  // Plan builder modal state
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);

  // Template library modal state
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Rest timer state
  const [isTimerExpanded, setIsTimerExpanded] = useState(false);
  const { isResting, remainingTime: _remainingTime, formattedTime: formattedRestTime, startTimer: startRestTimer, skipTimer: skipRestTimer, addTime: addRestTime } = useRestTimer();

  // User preferences
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');

  // Load user preferences
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const profile = await userService.getRealUserProfile();
        if (profile?.weightUnitPreference) {
          setWeightUnit(profile.weightUnitPreference);
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    };
    loadUserPreferences();
  }, []);

  // Start timer when user starts typing, reset when text is cleared
  useEffect(() => {
    if (noteText.length > 0 && !workoutStartTime) {
      setWorkoutStartTime(new Date());
    } else if (noteText.length === 0 && workoutStartTime) {
      // User backspaced all text - reset workout state
      setWorkoutStartTime(null);
      setElapsedTime(0);
      setParsedExercises([]);
    }
  }, [noteText, workoutStartTime]);

  // Timer tick
  useEffect(() => {
    if (!workoutStartTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - workoutStartTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [workoutStartTime]);

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle quick summary
  const handleQuickSummary = useCallback(async () => {
    if (!noteText.trim()) {
      Alert.alert('No workout data', 'Start typing your workout to see a summary.');
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
  }, [noteText]);

  // Handle finish workout - open finish modal
  const handleFinishWorkout = useCallback(() => {
    if (!noteText.trim()) {
      Alert.alert('No workout data', 'Add some exercises before finishing your workout.');
      return;
    }
    // Note: No tap sound here - the celebration sounds play when workout is saved
    playHapticFeedback('medium', false);
    Keyboard.dismiss();
    setShowFinishModal(true);
  }, [noteText]);

  // Handle save from finish modal
  const handleSaveWorkout = useCallback(async (parsedWorkout: ParsedWorkout) => {
    // Convert to duration in minutes
    const durationMinutes = Math.ceil(elapsedTime / 60);

    // Convert to GeneratedWorkout format (also auto-creates custom exercises)
    const generatedWorkout = await workoutNoteParser.toGeneratedWorkoutWithCustomExercises(parsedWorkout, durationMinutes);

    // Save to workout history
    await storageService.saveWorkout(generatedWorkout);

    // Record lifts for progress tracking
    for (const exercise of generatedWorkout.exercises) {
      if (exercise.completedSets.length > 0) {
        // Find the best set (highest estimated 1RM)
        const bestSet = exercise.completedSets.reduce((best, current) => {
          const bestOneRM = best.weight * (1 + best.reps / 30);
          const currentOneRM = current.weight * (1 + current.reps / 30);
          return currentOneRM > bestOneRM ? current : best;
        });

        // Only record lifts with actual weight
        if (bestSet.weight > 0) {
          // Use proper type guard to categorize lifts correctly
          const liftType = isMainLift(exercise.id) ? 'main' : 'secondary';
          await userService.recordLift({
            parentId: generatedWorkout.id,
            id: exercise.id,
            weight: bestSet.weight,
            reps: bestSet.reps,
            unit: bestSet.unit,
          }, liftType);
        }
      }
    }

    // Refresh user profile context so other screens get updated data
    await refreshProfile();
  }, [elapsedTime, refreshProfile]);

  // Handle finish modal complete - reset workout state
  const handleFinishComplete = useCallback(() => {
    setShowFinishModal(false);
    setNoteText('');
    setWorkoutStartTime(null);
    setElapsedTime(0);
    setParsedExercises([]);
  }, []);

  // Handle cancel from finish modal
  const handleFinishCancel = useCallback(() => {
    setShowFinishModal(false);
  }, []);

  // Handle plan completion from modal
  const handlePlanComplete = useCallback((planText: string) => {
    setNoteText(planText);
    setShowPlanBuilder(false);
    // Timer will start automatically when noteText updates
  }, []);

  // Handle plan cancel
  const handlePlanCancel = useCallback(() => {
    setShowPlanBuilder(false);
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: WorkoutTemplate) => {
    setNoteText(template.noteText);
    setShowTemplateLibrary(false);
    // Timer will start automatically when noteText updates
  }, []);

  // Handle timer tap - toggle expansion and start rest if not resting
  const handleTimerTap = useCallback(() => {
    playHapticFeedback('light', false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (!isTimerExpanded) {
      // Expanding - start rest timer if not already resting
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
    setWorkoutStartTime(new Date());
    setElapsedTime(0);
  }, []);

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



  // Workout has started only if there's text
  const hasWorkoutStarted = noteText.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.keyboardAvoid}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <View style={[styles.headerLeft, { backgroundColor: 'transparent' }]}>
            {hasWorkoutStarted ? (
              <TouchableOpacity
                style={[styles.summaryButton, { backgroundColor: currentTheme.colors.surface }]}
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
                onPress={handleFinishWorkout}
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
        <QuickSummaryToast
          visible={showSummary}
          exercises={parsedExercises}
          isLoading={summaryLoading}
          onDismiss={() => setShowSummary(false)}
        />

        {/* Main Content - Notes Input */}
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
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
      </View>

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
        onCancel={handlePlanCancel}
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
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
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
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  summaryButtonText: {
    fontSize: 13,
  },
  finishButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
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
  content: {
    flex: 1,
  },
  headerButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
});
