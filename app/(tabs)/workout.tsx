import Button from '@/components/Button';
import { Text, View } from '@/components/Themed';
import PlanBuilderModal from '@/components/workout/PlanBuilderModal';
import QuickSummaryToast from '@/components/workout/QuickSummaryToast';
import TemplateLibraryModal from '@/components/workout/TemplateLibraryModal';
import VoiceMicButton from '@/components/workout/VoiceMicButton';
import WorkoutConfirmationModal from '@/components/workout/WorkoutConfirmationModal';
import WorkoutNoteInput, { WorkoutNoteInputRef } from '@/components/workout/WorkoutNoteInput';
import { useTheme } from '@/contexts/ThemeContext';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { storageService } from '@/lib/storage';
import { userService } from '@/lib/userService';
import { ParsedExerciseSummary, ParsedWorkout, workoutNoteParser } from '@/lib/workoutNoteParser';
import { WorkoutTemplate } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity
} from 'react-native';

export default function WorkoutScreen() {
  console.log('WorkoutScreen rendering...');
  const { currentTheme } = useTheme();
  const noteInputRef = useRef<WorkoutNoteInputRef>(null);

  // Workout note state
  const [noteText, setNoteText] = useState('');
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Voice recognition
  const {
    isListening,
    startListening,
    stopListening,
    error: voiceError,
  } = useVoiceRecognition({
    onResult: (text) => {
      // Append voice result to note
      noteInputRef.current?.appendText(text);
    },
    onError: (error) => {
      Alert.alert('Voice Error', error);
    },
  });

  // Quick summary state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [parsedExercises, setParsedExercises] = useState<ParsedExerciseSummary[]>([]);
  const [lastParsedWorkout, setLastParsedWorkout] = useState<ParsedWorkout | null>(null);

  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Plan builder modal state
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);

  // Template library modal state
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  // Start timer when user starts typing
  useEffect(() => {
    if (noteText.length > 0 && !workoutStartTime) {
      setWorkoutStartTime(new Date());
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

  // Handle voice button press
  const handleVoicePress = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

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
      setLastParsedWorkout(parsed);
      const summary = workoutNoteParser.toSummary(parsed);
      setParsedExercises(summary);
    } catch (error) {
      console.error('Error parsing workout:', error);
      setParsedExercises([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [noteText]);

  // Handle finish workout - open confirmation modal
  const handleFinishWorkout = useCallback(async () => {
    if (!noteText.trim()) {
      Alert.alert('No workout data', 'Add some exercises before finishing your workout.');
      return;
    }

    Keyboard.dismiss();

    try {
      // Parse the workout notes if not already parsed
      if (!lastParsedWorkout) {
        const parsed = await workoutNoteParser.parseWorkoutNote(noteText);
        setLastParsedWorkout(parsed);
      }
      // Show confirmation modal
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error parsing workout:', error);
      Alert.alert('Error', 'Failed to parse workout. Please try again.');
    }
  }, [noteText, lastParsedWorkout]);

  // Handle confirm save from modal
  const handleConfirmSave = useCallback(async () => {
    if (!lastParsedWorkout) return;

    setIsSaving(true);

    try {
      // Convert to duration in minutes
      const durationMinutes = Math.ceil(elapsedTime / 60);

      // Convert to GeneratedWorkout format (also auto-creates custom exercises)
      const generatedWorkout = await workoutNoteParser.toGeneratedWorkoutWithCustomExercises(lastParsedWorkout, durationMinutes);

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
            await userService.recordLift({
              parentId: generatedWorkout.id,
              id: exercise.id,
              weight: bestSet.weight,
              reps: bestSet.reps,
              unit: bestSet.unit,
            }, exercise.id.includes('squat') || exercise.id.includes('bench') || exercise.id.includes('deadlift') || exercise.id.includes('overhead') ? 'main' : 'secondary');
          }
        }
      }

      // Close modal and reset
      setShowConfirmation(false);
      setNoteText('');
      setWorkoutStartTime(null);
      setElapsedTime(0);
      setParsedExercises([]);
      setLastParsedWorkout(null);

      // Show success toast
      Alert.alert('Workout Saved!', 'Your workout has been saved to your history.');
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [lastParsedWorkout, elapsedTime]);

  // Handle cancel from confirmation modal
  const handleCancelConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  // Handle clear/new workout
  const handleNewWorkout = useCallback(() => {
    if (noteText.trim()) {
      Alert.alert(
        'Start New Workout?',
        'This will clear your current workout notes.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => {
              setNoteText('');
              setWorkoutStartTime(null);
              setElapsedTime(0);
              setParsedExercises([]);
              setLastParsedWorkout(null);
            },
          },
        ]
      );
    }
  }, [noteText]);

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



  // Workout has started only if there's text
  const hasWorkoutStarted = noteText.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <View style={[styles.headerLeft, { backgroundColor: 'transparent' }]}>
            {hasWorkoutStarted ? (
              <TouchableOpacity onPress={handleNewWorkout}>
                <Ionicons name="refresh-outline" size={24} color={currentTheme.colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setShowPlanBuilder(true)}>
                <Ionicons name="sparkles-outline" size={26} color={currentTheme.colors.text + '80'} />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.headerCenter, { backgroundColor: 'transparent' }]}>
            {hasWorkoutStarted ? (
              <View style={[styles.timerContainer, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                <Ionicons name="time-outline" size={16} color={currentTheme.colors.accent} />
                <Text style={[styles.timerText, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                  {formatTime(elapsedTime)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                Workout
              </Text>
            )}
          </View>

          <View style={[styles.headerRight, { backgroundColor: 'transparent' }]}>
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
              <TouchableOpacity onPress={() => setShowTemplateLibrary(true)}>
                <Ionicons name="download-outline" size={24} color={currentTheme.colors.text + '80'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

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
            placeholder={`Start typing or tap mic to log your workout...

Examples:
Bench 135x8, 155x6
Squats 225 for 5 reps`}
          />
        </View>

        {/* Bottom Action Bar */}
        <View style={[styles.bottomBar, { backgroundColor: currentTheme.colors.background, borderTopColor: currentTheme.colors.border }]}>
          <View style={[styles.bottomBarContent, { backgroundColor: 'transparent' }]}>
            {/* Voice Button */}
            <VoiceMicButton
              isListening={isListening}
              onPress={handleVoicePress}
              size="medium"
            />

            {/* Action Button */}
            <Button
              title={hasWorkoutStarted ? "Finish Workout" : "Start Typing"}
              onPress={hasWorkoutStarted ? handleFinishWorkout : () => noteInputRef.current?.focus()}
              variant={hasWorkoutStarted ? "primary" : "secondary"}
              size="large"
              style={styles.finishButton}
              disabled={!hasWorkoutStarted}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <WorkoutConfirmationModal
        visible={showConfirmation}
        parsedWorkout={lastParsedWorkout}
        duration={elapsedTime}
        onConfirm={handleConfirmSave}
        onCancel={handleCancelConfirmation}
        isLoading={isSaving}
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
    width: 60,
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
    gap: 6,
  },
  timerText: {
    fontSize: 16,
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
  content: {
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  finishButton: {
    flex: 1,
  },
});
