import Button from '@/components/Button';
import Card from '@/components/Card';
import NumberInput from '@/components/inputs/NumberInput';
import WeightInput from '@/components/inputs/WeightInput';
import RestTimer from '@/components/RestTimer';
import { Text, View } from '@/components/Themed';
import { WorkoutProgressBar } from '@/components/WorkoutProgressBar';
import { WorkoutStats } from '@/components/WorkoutStats';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkoutSessionContext } from '@/contexts/WorkoutSessionContext';
import { useRestTimer } from '@/hooks/useRestTimer';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { OneRMCalculator } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { getWorkoutById } from '@/lib/workouts';
import { ActiveWorkoutSession, GeneratedWorkout, WorkoutSetCompletion } from '@/types';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

interface WorkoutSessionModalProps {
  visible: boolean;
  onClose: () => void;
  workout: GeneratedWorkout | null;
  onWorkoutComplete?: (result?: { session: ActiveWorkoutSession; stats: { duration: number; totalSets: number; totalVolume: number; progressUpdates: number; } }) => void;
}

const getRecommendedWeight = async (liftId: string, reps: string): Promise<number> => {
  const userProgress = await userService.getTopLiftById(liftId);
  if (!userProgress) {
    return 0;
  }
  const weightForPercentage = OneRMCalculator.getWeightForPercentage(userProgress.personalRecord, OneRMCalculator.getPercentageFor(parseInt(reps)));
  // Round to nearest 5 lbs
  return Math.round(weightForPercentage / 5) * 5;
}

export default function WorkoutSessionModal({
  visible,
  onClose,
  workout,
  onWorkoutComplete
}: WorkoutSessionModalProps) {
  const { currentTheme } = useTheme();
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  
  // Use the persistent rest timer hook
  const { isResting, formattedTime, startTimer, skipTimer } = useRestTimer();
  
  // Use the context instead of the hook directly
  const {
    // State
    activeSession,
    currentWeight,
    currentReps,
    progressExpanded,
    statsExpanded,
    
    // Setters
    setCurrentWeight,
    setCurrentReps,
    setProgressExpanded,
    setStatsExpanded,
    
    // Actions
    initializeWorkout,
    completeSet,
    jumpToExercise,
    nextExercise,
    finishWorkout,
    cancelWorkout,
    updateSet,
  } = useWorkoutSessionContext();


  // Add workout timer
  const { formattedTime: workoutTime } = useWorkoutTimer(activeSession?.startTime || null);

  useEffect(() => {
    if (visible && workout) {
      initializeWorkout(workout).catch(() => {
        onClose();
      });
    }
  }, [visible, workout]);

  // Auto-suggest weight when exercise changes (MOVED BEFORE CONDITIONAL RETURN)
  useEffect(() => {
    const updateRecommendedWeight = async () => {
      if (activeSession) {
        const currentExercise = activeSession.exercises[activeSession.currentExerciseIndex];
        const recommendedWeight = await getRecommendedWeight(currentExercise.id, currentExercise.reps);
        setCurrentWeight({ value: recommendedWeight, unit: 'lbs' });
      }
    }
    updateRecommendedWeight();
  }, [activeSession?.currentExerciseIndex]);


  const handleCompleteSet = async () => {
    if (editingSetIndex !== null) {
      // Update existing set
      await updateSet(editingSetIndex, currentWeight, currentReps);
      setEditingSetIndex(null);
    } else {
      // Complete new set
      await completeSet();
      // Start rest timer after completing a set
      startTimer(90); // 90 seconds default
    }
  };

  const handleFinishWorkout = async () => {
    try {
      const result = await finishWorkout();
      
      if (result) {
        onWorkoutComplete?.(result);
      }
      // Don't call onClose() here - let the parent handle modal transitions
    } catch (error) {
      console.error('Error finishing workout:', error);
      onClose();
    }
  };

  const handlePreviousSetPress = (setIndex: number, set: WorkoutSetCompletion) => {
    // Populate input fields with the selected set's data
    setCurrentWeight({ value: set.weight, unit: set.unit });
    setCurrentReps(set.reps);
    setEditingSetIndex(setIndex);
  };

  const handleCancelEdit = () => {
    setEditingSetIndex(null);
    setCurrentWeight({ value: 0, unit: 'lbs' });
    setCurrentReps(0);
  };

  if (!activeSession) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
          <Text style={[styles.loadingText, { color: currentTheme.colors.text }]}>
            Loading workout...
          </Text>
        </View>
      </Modal>
    );
  }

  const currentExercise = activeSession.exercises[activeSession.currentExerciseIndex];
  const currentExerciseDetails = getWorkoutById(currentExercise.id);
  const currentSet = currentExercise.completedSets.length + 1;
  const isExerciseComplete = currentExercise.isCompleted;
  const completedExercises = activeSession.exercises.filter(ex => ex.isCompleted).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
        {/* Swipe Indicator */}
        <View style={styles.swipeIndicator}>
          <View style={[styles.swipeHandle, { backgroundColor: currentTheme.colors.border }]} />
        </View>
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <Button
            title="Cancel"
            onPress={() => cancelWorkout()}
            variant="ghost"
            size="small"
          />
          <View style={[styles.headerCenter, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
              {activeSession.title}
            </Text>
            <Text style={[styles.workoutTimer, { color: currentTheme.colors.primary }]}>
              {workoutTime}
            </Text>
          </View>
          <Button
            title="Finish"
            onPress={handleFinishWorkout}
            variant="primary"
            size="small"
            hapticType="light"
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.contentPadding, { backgroundColor: 'transparent' }]}>
            
            {/* Progress Bar */}
            <WorkoutProgressBar
              session={activeSession}
              themeColors={currentTheme.colors}
              onExerciseSelect={jumpToExercise}
              currentExerciseIndex={activeSession.currentExerciseIndex}
              isExpanded={progressExpanded}
              onToggle={() => setProgressExpanded(!progressExpanded)}
            />

            {/* Stats */}
            <WorkoutStats
              session={activeSession}
              themeColors={currentTheme.colors}
              isExpanded={statsExpanded}
              onToggle={() => setStatsExpanded(!statsExpanded)}
            />

            {/* Current Exercise Focus */}
            <Card style={styles.currentExerciseCard} variant="elevated">
              <View style={[styles.exerciseHeader, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.exerciseProgress, { color: currentTheme.colors.text, opacity: 0.7 }]}>
                  Current Exercise ({activeSession.currentExerciseIndex + 1}/{activeSession.exercises.length})
                </Text>
              </View>

              <Text style={[styles.exerciseName, { color: currentTheme.colors.text }]}>
                {currentExerciseDetails?.name || 'Unknown Exercise'}
              </Text>
              
              <View style={[styles.setProgress, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.setProgressText, { color: currentTheme.colors.primary }]}>
                  {editingSetIndex !== null ? `Editing Set ${editingSetIndex + 1}` : `Set ${isExerciseComplete ? currentExercise.sets : currentSet} of ${currentExercise.sets}`}
                </Text>
                <Text style={[styles.targetReps, { color: currentTheme.colors.text }]}>
                  Target: {currentExercise.reps} reps
                </Text>
              </View>
            </Card>

            {/* Rest Timer - Using hook with props */}
            <RestTimer 
              isResting={isResting}
              formattedTime={formattedTime}
              onSkip={skipTimer}
            />

            {/* Previous Sets - Only when there are completed sets */}
            {currentExercise.completedSets.length > 0 && (
              <Card style={styles.historyCard} variant="subtle">
                <Text style={[styles.historyTitle, { color: currentTheme.colors.text }]}>
                  Previous Sets {editingSetIndex !== null && '(tap to edit)'}
                </Text>
                <View style={[styles.historyCompact, { backgroundColor: 'transparent' }]}>
                  {currentExercise.completedSets.map((set, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handlePreviousSetPress(index, set)}
                      style={[
                        styles.historyItem, 
                        { 
                          backgroundColor: editingSetIndex === index 
                            ? currentTheme.colors.primary + '20' 
                            : currentTheme.colors.surface,
                          borderColor: editingSetIndex === index 
                            ? currentTheme.colors.primary 
                            : 'transparent',
                          borderWidth: editingSetIndex === index ? 1 : 0,
                        }
                      ]}
                    >
                      <Text style={[{ color: currentTheme.colors.text }]}>
                        {set.weight}{set.unit} × {set.reps}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            )}

            {/* Input Section - Only when ready to record or editing */}
            {(!isExerciseComplete || editingSetIndex !== null) && (
              <Card style={styles.inputCard} variant="elevated">
                {editingSetIndex !== null && (
                  <View style={[styles.editingHeader, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.editingText, { color: currentTheme.colors.primary }]}>
                      Editing Set {editingSetIndex + 1}
                    </Text>
                    <Button
                      title="Cancel"
                      onPress={handleCancelEdit}
                      variant="ghost"
                      size="small"
                    />
                  </View>
                )}
                
                <WeightInput
                  key={`weight-${activeSession.currentExerciseIndex}-${editingSetIndex}`}
                  value={currentWeight}
                  onChange={setCurrentWeight}
                  style={styles.weightInput}
                />
                
                <NumberInput
                  key={`reps-${activeSession.currentExerciseIndex}-${editingSetIndex}`}
                  value={currentReps}
                  onChange={setCurrentReps}
                  label="Reps Completed"
                  placeholder={currentExercise.reps.toString()}
                  allowDecimal={false}
                  maxLength={3}
                  style={styles.repsInput}
                />

                <Button
                  title={editingSetIndex !== null ? 'Update Set' : `Complete Set ${currentSet}`}
                  onPress={handleCompleteSet}
                  variant="primary"
                  size="large"
                  disabled={currentReps <= 0 || currentWeight.value <= 0}
                />
              </Card>
            )}

            {/* Exercise Navigation - Only when exercise is complete and not editing */}
            {isExerciseComplete && editingSetIndex === null && (
              <Card style={styles.navigationCard} variant="elevated">
                <Text style={[styles.completeText, { color: currentTheme.colors.accent }]}>
                  ✅ Exercise Complete!
                </Text>
                
                {completedExercises === activeSession.exercises.length ? (
                  <Button
                    title="Finish Workout"
                    onPress={handleFinishWorkout}
                    variant="primary"
                    size="large"
                  />
                ) : (
                  <Button
                    title="Next Exercise"
                    onPress={nextExercise}
                    variant="primary"
                    size="large"
                  />
                )}
              </Card>
            )}

          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 20,
    paddingTop: 0,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  
  // Current exercise styles
  currentExerciseCard: {
    marginBottom: 16,
    padding: 20,
  },
  exerciseHeader: {
    marginBottom: 8,
    alignItems: 'center',
  },
  exerciseProgress: {
    fontSize: 14,
  },
  exerciseName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  setProgress: {
    alignItems: 'center',
  },
  setProgressText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  targetReps: {
    fontSize: 14,
    opacity: 0.8,
  },
  
  // History styles
  historyCard: {
    marginBottom: 16,
    padding: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  historyCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyItem: {
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  
  // Input styles
  inputCard: {
    marginBottom: 16,
    padding: 16,
  },
  weightInput: {
    marginBottom: 16,
  },
  repsInput: {
    marginBottom: 16,
  },
  
  // Editing styles
  editingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editingText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Navigation styles
  navigationCard: {
    marginBottom: 20,
    padding: 16,
    alignItems: 'center',
  },
  completeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  workoutTimer: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Swipe indicator styles
  swipeIndicator: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  swipeHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  modalContainer: {
    flex: 1,
    marginTop: -40,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
}); 