import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import ExerciseBadge, { getExerciseBadgeInfo } from '@/components/workout/ExerciseBadge';
import WorkoutCompleteScreen from '@/components/workout/WorkoutCompleteScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { unlockedIds } from '@/lib/gamification/achievements';
import {
  buildRewardSnapshot,
  computeSessionRewards,
  SessionRewards,
} from '@/lib/gamification/sessionRewards';
import { getStrengthTier, getTierColor, OneRMCalculator } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import playHapticFeedback from '@/lib/utils/haptic';
import { calculateOverallPercentile, calculateWorkoutStats, convertWeightToLbs, formatDistance, formatDuration, formatSet, WorkoutStats } from '@/lib/utils/utils';
import { ParsedWorkout, workoutNoteParser } from '@/lib/workout/workoutNoteParser';
import { getWorkoutById } from '@/lib/workout/workouts';
import { convertWeight, UserProfile, UserProgress, WeightUnit, WorkoutTemplate } from '@/types';
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
  prebuiltWorkout?: ParsedWorkout | null; // structured draft → skip the AI parse
  duration?: number; // in seconds (optional for preview mode)
  weightUnit?: WeightUnit;
  onSave?: (parsedWorkout: ParsedWorkout) => Promise<void>;
  onCancel?: () => void;
  onComplete?: () => void;
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
  prebuiltWorkout,
  duration = 0,
  weightUnit = 'lbs',
  onSave,
  onCancel,
  onComplete,
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
  const [sessionRewards, setSessionRewards] = useState<SessionRewards | null>(null);

  // Parse workout when modal opens
  useEffect(() => {
    if (visible && noteText.trim()) {
      setModalState('parsing');
      setParsedWorkout(null);
      setError(null);
      setTemplateSaved(false);
      setSessionRewards(null);

      const parseWorkout = async () => {
        try {
          // The structured draft is already the workout — use it directly and
          // skip the AI parse. Only fall back to parsing raw text if no draft.
          const [parsed, lifts, profile] = await Promise.all([
            prebuiltWorkout ?? workoutNoteParser.parseWorkoutNote(noteText),
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
  }, [visible, noteText, prebuiltWorkout]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!parsedWorkout || !onSave) return;

    playHapticFeedback('light', false);
    setIsSaving(true);
    try {
      // Snapshot the career before saving so we can diff what this session earned.
      const beforeHistory = await storageService.getWorkoutHistory();
      const beforeLifts = userLifts;

      await onSave(parsedWorkout);
      playUnlock();
      playHapticFeedback('medium', false);
      setModalState('celebration');

      // Compute session rewards (XP / level-up / achievements / weekly challenge).
      // Best-effort — never let this block or fail the celebration.
      try {
        const [afterHistory, afterLifts, profile] = await Promise.all([
          storageService.getWorkoutHistory(),
          userService.getAllFeaturedLifts(),
          userService.getUserProfileOrDefault(),
        ]);
        const unit = profile.weightUnitPreference || weightUnit;
        const bodyWeightLbs = profile.weight
          ? convertWeight(profile.weight.value, profile.weight.unit, 'lbs')
          : 0;
        const overallBefore = beforeLifts.length
          ? calculateOverallPercentile(beforeLifts.map(l => l.percentileRanking))
          : 0;
        const overallAfter = afterLifts.length
          ? calculateOverallPercentile(afterLifts.map(l => l.percentileRanking))
          : 0;
        const before = buildRewardSnapshot(beforeHistory, { unit, overall: overallBefore, bodyWeightLbs });
        const after = buildRewardSnapshot(afterHistory, { unit, overall: overallAfter, bodyWeightLbs });
        const rewards = computeSessionRewards(before, after);
        setSessionRewards(rewards);

        // This is the primary celebration moment — acknowledge the unlocks here
        // so the Profile badge doesn't re-celebrate them.
        if (rewards.hasRewards) {
          await storageService.setSeenAchievements(unlockedIds(after.achievements));
        }
      } catch (rewardErr) {
        console.error('Error computing session rewards:', rewardErr);
      }
    } catch (err) {
      console.error('Error saving workout:', err);
      setError('Failed to save workout. Please try again.');
      playHapticFeedback('error', false);
    } finally {
      setIsSaving(false);
    }
  }, [parsedWorkout, onSave, playUnlock, userLifts, weightUnit]);

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

  // Get the exercises to display
  const displayExercises = useMemo(() => {
    return parsedWorkout?.exercises || [];
  }, [parsedWorkout]);

  // Calculate overall tier from exercises in this session.
  // Use the SAME per-session percentile the exercise badges and the post-completion
  // tiling screen show (getExerciseBadgeInfo: this workout's 1RM → percentile), rather
  // than the user's all-time career percentileRanking. This keeps the headline "Overall
  // Tier" consistent with the individual badges instead of averaging lifetime peaks.
  const overallTierInfo = useMemo(() => {
    if (displayExercises.length === 0) return null;

    const bodyWeightLbs = userProfile
      ? convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit)
      : undefined;

    // Get this-session percentiles for exercises that produced a tier badge
    const sessionPercentiles: number[] = [];
    for (const exercise of displayExercises) {
      const badgeInfo = getExerciseBadgeInfo(
        exercise.matchedExerciseId,
        exercise.isCustom,
        exercise.sets || [],
        userLifts,
        bodyWeightLbs,
        userProfile?.gender
      );
      if (badgeInfo?.type === 'tier') {
        sessionPercentiles.push(badgeInfo.percentile);
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
  }, [displayExercises, userLifts, userProfile]);

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
        // Honor the per-set check-off. Freeform-logged sets carry no completed flag
        // (undefined) and count as done; a check-off set left unchecked is `false`
        // and must NOT inflate the summary. Mirrors the persistence rule so the finish
        // screen matches what actually gets saved.
        completed: set.completed ?? true,
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

  // Render confirmation/summary state
  const renderConfirmation = () => {
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
            {''}
          </Text>
          <IconButton icon="close" onPress={handleCancel} variant="surface" />
        </View>

        {/* Content */}
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

            {/* Action Buttons */}
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
          </>
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
      rewards={sessionRewards}
    />
  );

  if (!visible) return null;

  // Parsing and celebration have a dark background
  const showDarkBackground = modalState === 'parsing' || modalState === 'celebration';

  // Determine what content to show
  const renderContent = () => {
    if (modalState === 'parsing') return renderParsing();
    if (modalState === 'celebration') return renderCelebration();
    return renderConfirmation();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
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
  setsSection: {
    gap: 4,
  },
});

export default WorkoutFinishModal;
