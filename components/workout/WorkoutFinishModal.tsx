import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import ExerciseBadge from '@/components/workout/ExerciseBadge';
import WorkoutCompleteScreen from '@/components/workout/WorkoutCompleteScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { getStrengthTier, getTierColor, OneRMCalculator } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import playHapticFeedback from '@/lib/utils/haptic';
import { calculateWorkoutStats, convertWeightToLbs, formatDistance, formatDuration, formatSet, WorkoutStats } from '@/lib/utils/utils';
import { ParsedExerciseSummary, ParsedWorkout, workoutNoteParser } from '@/lib/workout/workoutNoteParser';
import { getWorkoutById } from '@/lib/workout/workouts';
import { convertWeight, UserProfile, UserProgress, WeightUnit, WorkoutTemplate } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ModalState = 'parsing' | 'confirmation' | 'celebration';

interface WorkoutFinishModalProps {
  visible: boolean;
  noteText: string;
  duration?: number; // in seconds (optional for preview mode)
  weightUnit?: WeightUnit;
  onSave?: (parsedWorkout: ParsedWorkout) => Promise<void>;
  onCancel?: () => void;
  onComplete?: () => void;
  // Preview mode props
  isPreviewMode?: boolean;
  exercises?: ParsedExerciseSummary[]; // Pre-parsed exercises for preview mode
  isLoading?: boolean;
  onDismiss?: () => void;
}

// Static Morph logo
const Logo = ({ size = 80 }: { size?: number }) => (
  <Image
    source={require('@/assets/images/icon-original.png')}
    style={[styles.logoImage, { width: size, height: size }]}
    resizeMode="contain"
  />
);

const WorkoutFinishModal: React.FC<WorkoutFinishModalProps> = ({
  visible,
  noteText,
  duration = 0,
  weightUnit = 'lbs',
  onSave,
  onCancel,
  onComplete,
  // Preview mode props
  isPreviewMode = false,
  exercises: previewExercises,
  isLoading: previewLoading = false,
  onDismiss,
}) => {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380; // iPhone SE, iPhone 12/13 mini

  // Sound effects
  const { play: playSuccess } = useSound('selectionComplete');
  const { play: playTap } = useSound('tapVariant1');
  const { play: playUnlock } = useSound('unlock');

  const [modalState, setModalState] = useState<ModalState>('parsing');
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [userLifts, setUserLifts] = useState<UserProgress[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Fetch user lifts for preview mode
  useEffect(() => {
    if (isPreviewMode && visible) {
      Promise.all([
        userService.getAllFeaturedLifts(),
        userService.getUserProfileOrDefault()
      ]).then(([lifts, profile]) => {
        setUserLifts(lifts);
        setUserProfile(profile);
      }).catch(console.error);
    }
  }, [isPreviewMode, visible]);

  // Parse workout when modal opens (finish mode only)
  useEffect(() => {
    if (!isPreviewMode && visible && noteText.trim()) {
      setModalState('parsing');
      setParsedWorkout(null);
      setError(null);
      setTemplateSaved(false);

      const parseWorkout = async () => {
        try {
          const [parsed, lifts, profile] = await Promise.all([
            workoutNoteParser.parseWorkoutNote(noteText),
            userService.getAllFeaturedLifts(),
            userService.getUserProfileOrDefault(),
          ]);
          setParsedWorkout(parsed);
          setUserLifts(lifts);
          setUserProfile(profile);
          setModalState('confirmation');
        } catch (err) {
          console.error('Error parsing workout:', err);
          setError('Failed to parse workout. Please try again.');
        }
      };

      parseWorkout();
    }
  }, [visible, noteText, isPreviewMode]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!parsedWorkout || !onSave) return;

    playHapticFeedback('light', false);
    setIsSaving(true);
    try {
      await onSave(parsedWorkout);
      playUnlock();
      playHapticFeedback('medium', false);
      setModalState('celebration');
    } catch (err) {
      console.error('Error saving workout:', err);
      setError('Failed to save workout. Please try again.');
      playHapticFeedback('error', false);
    } finally {
      setIsSaving(false);
    }
  }, [parsedWorkout, onSave, playUnlock]);

  // Handle cancel with haptic
  const handleCancel = useCallback(() => {
    playTap();
    playHapticFeedback('light', false);
    onCancel?.();
  }, [onCancel, playTap]);

  // Handle done with haptic
  const handleDone = useCallback(() => {
    playTap();
    playHapticFeedback('light', false);
    onComplete?.();
  }, [onComplete, playTap]);

  // Handle save as template
  const handleSaveAsTemplate = useCallback(async () => {
    if (templateSaved) return;

    playTap();
    playHapticFeedback('medium', false);

    // Generate a name based on date and exercises
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const exerciseNames = parsedWorkout?.exercises.slice(0, 2).map(e => {
      const info = e.matchedExerciseId ? getWorkoutById(e.matchedExerciseId) : null;
      return info?.name || e.name;
    }).join(', ') || 'Workout';
    const suffix = (parsedWorkout?.exercises.length || 0) > 2 ? '...' : '';

    const template: WorkoutTemplate = {
      id: `template_${Date.now()}`,
      name: `${exerciseNames}${suffix} - ${dateStr}`,
      noteText: noteText,
      createdAt: new Date(),
    };

    try {
      await storageService.saveWorkoutTemplate(template);
      setTemplateSaved(true);
      playSuccess();
    } catch (err) {
      console.error('Error saving template:', err);
      playHapticFeedback('error', false);
    }
  }, [templateSaved, parsedWorkout, noteText, playTap, playSuccess]);

  // Get the exercises to display (from parsed workout or preview mode)
  const displayExercises = useMemo(() => {
    if (isPreviewMode && previewExercises) {
      return previewExercises;
    }
    return parsedWorkout?.exercises || [];
  }, [isPreviewMode, previewExercises, parsedWorkout]);

  // Calculate overall tier from exercises in this session
  const overallTierInfo = useMemo(() => {
    if (displayExercises.length === 0 || userLifts.length === 0) return null;

    // Get percentiles for exercises in this workout that have tracked data
    const sessionPercentiles: number[] = [];
    for (const exercise of displayExercises) {
      if (exercise.matchedExerciseId && !exercise.isCustom) {
        const userLift = userLifts.find(l => l.workoutId === exercise.matchedExerciseId);
        if (userLift && userLift.percentileRanking > 0) {
          sessionPercentiles.push(userLift.percentileRanking);
        }
      }
    }

    if (sessionPercentiles.length === 0) return null;

    // Calculate average percentile for this session
    const avgPercentile = Math.round(
      sessionPercentiles.reduce((sum, p) => sum + p, 0) / sessionPercentiles.length
    );
    const tier = getStrengthTier(avgPercentile);
    const tierColor = getTierColor(tier);
    return { tier, tierColor, percentile: avgPercentile };
  }, [displayExercises, userLifts]);

  // Calculate stats using the universal utility
  const stats = useMemo(() => {
    const exerciseCount = displayExercises.length;

    // Convert displayExercises to format expected by calculateWorkoutStats
    const exercisesForStats = displayExercises.map(ex => ({
      id: ex.matchedExerciseId || ex.name,
      trackingType: ex.trackingType,
      completedSets: ex.sets?.map(set => ({
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        duration: set.duration,
        distance: set.distance,
        completed: true,
      })),
    }));

    const workoutStats: WorkoutStats = calculateWorkoutStats(exercisesForStats);

    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

    return {
      exercises: exerciseCount,
      sets: workoutStats.totalSets,
      volume: workoutStats.totalVolumeLbs,
      durationStr,
      // Cardio-specific stats
      hasCardio: workoutStats.hasCardioExercises,
      totalDistanceMeters: workoutStats.totalDistanceMeters,
      totalCardioDurationSeconds: workoutStats.totalCardioDurationSeconds,
    };
  }, [displayExercises, duration]);

  // Render parsing state
  const renderParsing = () => (
    <View style={[styles.centerContainer, { backgroundColor: 'transparent' }]}>
      <Logo />
      <ActivityIndicator
        size="large"
        color={currentTheme.colors.primary}
        style={styles.loadingIndicator}
      />
      <Text style={[styles.parsingText, { color: '#fff', fontFamily: currentTheme.fonts.semiBold }]}>
        Analyzing your workout...
      </Text>
      {error && (
        <Animated.View entering={FadeIn} style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: '#FF6B6B', fontFamily: currentTheme.fonts.medium }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={onCancel}
          >
            <Text style={[styles.retryButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );

  // Render preview loading state
  const renderPreviewLoading = () => (
    <View style={styles.loadingContainer}>
      <Text style={[styles.loadingText, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
        Parsing your workout notes...
      </Text>
    </View>
  );

  // Render preview empty state
  const renderPreviewEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={currentTheme.colors.text + '30'} />
      <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.medium }]}>
        No exercises detected
      </Text>
      <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.regular }]}>
        {"Try adding exercises like \"Bench 135x8\" or \"Squats 225 for 5 reps\""}
      </Text>
    </View>
  );

  // Render confirmation/summary state (used by both preview and finish mode)
  const renderConfirmation = () => {
    const handleClose = isPreviewMode ? (onDismiss ?? (() => {})) : handleCancel;
    const isLoading = isPreviewMode && previewLoading;
    const isEmpty = isPreviewMode && !previewLoading && displayExercises.length === 0;

    const getTitle = () => {
      if (isLoading) return 'Analyzing...';
      if (isPreviewMode) return 'Summary';
      return '';
    };

    return (
      <View style={[styles.confirmationContainer, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border, paddingTop: Math.max(16, insets.top) }]}>
          <View style={styles.headerLeft}>
            <Image
              source={require('@/assets/images/icon-original.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={[styles.headerLogoText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              morf
            </Text>
          </View>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
            {getTitle()}
          </Text>
          <IconButton icon="close" onPress={handleClose} variant="surface" />
        </View>

        {/* Loading State */}
        {isLoading && renderPreviewLoading()}

        {/* Empty State */}
        {isEmpty && renderPreviewEmpty()}

        {/* Content - only show when not loading and has exercises */}
        {!isLoading && !isEmpty && (
          <>
            {/* Stats Section */}
            <View style={[styles.statsContainer, { backgroundColor: currentTheme.colors.surface }]}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                    {stats.durationStr || '--'}
                  </Text>
                  <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                    Duration
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                    {stats.exercises}
                  </Text>
                  <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                    Exercises
                  </Text>
                </View>
              </View>
              <View style={[styles.statsRowDivider, { backgroundColor: currentTheme.colors.border }]} />
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                    {stats.sets}
                  </Text>
                  <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                    Sets
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
                <View style={styles.statItem}>
                  {overallTierInfo ? (
                    <TierBadge tier={overallTierInfo.tier} size="medium" variant="text" />
                  ) : (
                    <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                      --
                    </Text>
                  )}
                  <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                    Overall Tier
                  </Text>
                </View>
              </View>

              {/* Cardio stats row - only show if workout has cardio exercises */}
              {stats.hasCardio && (stats.totalDistanceMeters > 0 || stats.totalCardioDurationSeconds > 0) && (
                <>
                  <View style={[styles.statsRowDivider, { backgroundColor: currentTheme.colors.border }]} />
                  <View style={styles.statsRow}>
                    {stats.totalDistanceMeters > 0 && (
                      <>
                        <View style={styles.statItem}>
                          <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                            {formatDistance(stats.totalDistanceMeters)}
                          </Text>
                          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                            Distance
                          </Text>
                        </View>
                        {stats.totalCardioDurationSeconds > 0 && (
                          <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
                        )}
                      </>
                    )}
                    {stats.totalCardioDurationSeconds > 0 && (
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                          {formatDuration(stats.totalCardioDurationSeconds)}
                        </Text>
                        <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                          Cardio Time
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>

            {/* Exercises List */}
            <ScrollView style={styles.exercisesList} contentContainerStyle={styles.exercisesContent} showsVerticalScrollIndicator={false}>
              {displayExercises.map((exercise, index) => {
                const exerciseInfo = exercise.matchedExerciseId
                  ? getWorkoutById(exercise.matchedExerciseId)
                  : null;

                const best1RM = exercise.sets ? Math.max(
                  ...exercise.sets.map(set =>
                    set.weight > 0 && set.reps > 0
                      ? OneRMCalculator.estimate(set.weight, set.reps)
                      : 0
                  ),
                  0
                ) : 0;

                return (
                  <View
                    key={index}
                    style={[styles.exerciseCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                  >
                    <View style={styles.exerciseHeader}>
                      <View style={styles.exerciseNameContainer}>
                        <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                          {exerciseInfo?.name || exercise.name}
                        </Text>
                        {best1RM > 0 && (
                          <Text style={[styles.estimated1RM, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                            ~{Math.round(best1RM)} {weightUnit} 1RM
                          </Text>
                        )}
                      </View>
                      <ExerciseBadge
                        matchedExerciseId={exercise.matchedExerciseId}
                        isCustom={exercise.isCustom}
                        sets={exercise.sets || []}
                        userLifts={userLifts}
                        weightUnit={weightUnit}
                        bodyWeightLbs={userProfile ? convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit) : undefined}
                        gender={userProfile?.gender}
                      />
                    </View>

                    <View style={styles.setsContainer}>
                      {exercise.recommendedSets && exercise.recommendedSets.length > 0 && (
                        <View style={styles.setsSection}>
                          <Text style={[styles.sectionLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.semiBold }]}>
                            Target
                          </Text>
                          {exercise.recommendedSets.map((set, setIndex) => (
                            <View key={setIndex} style={styles.setRow}>
                              <Text style={[styles.setNumber, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                                Set {setIndex + 1}
                              </Text>
                              <Text style={[styles.setDetails, { color: currentTheme.colors.text + '70', fontFamily: currentTheme.fonts.regular }]}>
                                {formatSet(set, { trackingType: exercise.trackingType, showUnit: true })}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {exercise.sets && exercise.sets.length > 0 && (
                        <View style={styles.setsSection}>
                          {exercise.sets.map((set, setIndex) => (
                            <View key={setIndex} style={styles.setRow}>
                              <Text style={[styles.setNumber, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.medium }]}>
                                Set {setIndex + 1}
                              </Text>
                              <Text style={[styles.setDetails, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                                {formatSet(set, { trackingType: exercise.trackingType, showUnit: true })}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}

            </ScrollView>

            {/* Action Buttons - Only show in finish mode */}
            {!isPreviewMode && (
              <View style={[
                styles.actionsContainer,
                { backgroundColor: currentTheme.colors.background, borderTopColor: currentTheme.colors.border, paddingBottom: Math.max(16, insets.bottom) }
              ]}>
                <Button
                  title={isSaving ? "Saving..." : "Finish Workout"}
                  onPress={handleSave}
                  variant="primary"
                  size="large"
                  style={styles.confirmButton}
                  disabled={isSaving}
                />
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  // Render celebration state using the new WorkoutCompleteScreen component
  const renderCelebration = () => (
    <WorkoutCompleteScreen
      stats={stats}
      exercises={displayExercises}
      userLifts={userLifts}
      userProfile={userProfile}
      weightUnit={weightUnit}
      templateSaved={templateSaved}
      onSaveAsTemplate={handleSaveAsTemplate}
      onDone={handleDone}
      isSmallScreen={isSmallScreen}
    />
  );

  if (!visible) return null;

  // For finish mode: parsing and celebration have dark background
  const showDarkBackground = !isPreviewMode && (modalState === 'parsing' || modalState === 'celebration');

  // Determine what content to show
  const renderContent = () => {
    if (!isPreviewMode) {
      if (modalState === 'parsing') return renderParsing();
      if (modalState === 'celebration') return renderCelebration();
    }
    // Both preview and finish confirmation use renderConfirmation
    return renderConfirmation();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={isPreviewMode ? onDismiss : onCancel}
    >
      <View style={[styles.modalContainer, { backgroundColor: showDarkBackground ? 'rgba(0,0,0,0.95)' : currentTheme.colors.background }]}>
        {renderContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingIndicator: {
    marginVertical: 24,
  },
  parsingText: {
    fontSize: 20,
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  confirmationContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: {
    width: 40,
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    minWidth: 50,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerLogoText: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    flex: 1,
    textAlign: 'center',
  },
  statsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statsRowDivider: {
    height: 1,
    marginVertical: 12,
    marginHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  exerciseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  exerciseNameContainer: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontSize: 16,
  },
  estimated1RM: {
    fontSize: 13,
  },
  setsContainer: {
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumber: {
    width: 50,
    fontSize: 13,
  },
  setDetails: {
    fontSize: 14,
  },
  actionsContainer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  confirmButton: {
    width: '100%',
  },
  // Logo image style (used in parsing state)
  logoImage: {
    width: 80,
    height: 80,
  },
  // Preview mode styles
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 17,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  setsSection: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});

export default WorkoutFinishModal;
