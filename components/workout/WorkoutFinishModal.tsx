import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import ExerciseBadge, { getExerciseBadgeInfo } from '@/components/workout/ExerciseBadge';
import WorkoutCompleteScreen, { PercentileMove } from '@/components/workout/WorkoutCompleteScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { unlockedIds } from '@/lib/gamification/achievements';
import { maybeAskForReview } from '@/lib/services/appReview';
import {
  buildRewardSnapshot,
  computeSessionRewards,
  SessionRewards,
} from '@/lib/gamification/sessionRewards';
import { getStrengthTier, getTierColor, OneRMCalculator } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { radius, screenGutter, space, track, trend } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import { calculateOverallPercentile, calculateWorkoutStats, convertWeightToLbs, formatDistance, formatDuration, formatSet, WorkoutStats } from '@/lib/utils/utils';
import { ParsedWorkout, workoutNoteParser } from '@/lib/workout/workoutNoteParser';
import { getWorkoutById } from '@/lib/workout/workouts';
import { convertWeight, UserProfile, UserProgress, WeightUnit } from '@/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
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
  // strengthWin (PR / achievement / percentile move) routes the caller: win → History, else → feed.
  onComplete?: (strengthWin: boolean) => void;
}

// Arcane hourglass that flips over while the parse runs — the in-theme spinner.
const PixelHourglass = () => {
  const rotate = useSharedValue(0);
  useEffect(() => {
    rotate.value = withRepeat(
      withSequence(
        withDelay(700, withTiming(180, { duration: 550, easing: Easing.inOut(Easing.cubic) })),
        withDelay(700, withTiming(360, { duration: 550, easing: Easing.inOut(Easing.cubic) })),
      ),
      -1,
      false,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs for the screen's lifetime
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  return (
    <Animated.Image
      source={require('@/assets/images/sl/hourglass.png')}
      style={[styles.hourglass, style]}
      resizeMode="contain"
    />
  );
};

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

  const { play: playTap } = useSound('tapVariant1');
  const { play: playUnlock } = useSound('unlock');

  const [modalState, setModalState] = useState<ModalState>('parsing');
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLifts, setUserLifts] = useState<UserProgress[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sessionRewards, setSessionRewards] = useState<SessionRewards | null>(null);
  const [strengthWin, setStrengthWin] = useState(false);
  const [percentileMove, setPercentileMove] = useState<PercentileMove | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  useEffect(() => {
    if (visible && noteText.trim()) {
      setModalState('parsing');
      setParsedWorkout(null);
      setError(null);
      setSessionRewards(null);
      setStrengthWin(false);
      setPercentileMove(null);
      setSavedTitle(null);

      const parseWorkout = async () => {
        try {
          // A structured draft is already the workout; only parse raw text when there's no draft.
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

      // Compute session rewards, best-effort — never let this block or fail the celebration.
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
        setPercentileMove({ before: overallBefore, after: overallAfter });
        // The just-saved session (newest by createdAt) carries the generated title for the share card.
        const newest = afterHistory.reduce<(typeof afterHistory)[number] | null>(
          (best, w) => (!best || new Date(w.createdAt) > new Date(best.createdAt) ? w : best),
          null,
        );
        if (newest?.title) setSavedTitle(newest.title);
        // Strength win = PR/achievement, or the overall percentile moved; drives History vs feed.
        setStrengthWin(rewards.hasRewards || overallAfter !== overallBefore);

        // Maybe ask for an App Store review — on the celebration, after a win,
        // heavily gated (see lib/workout/reviewPrompt). Fire-and-forget.
        maybeAskForReview({
          totalWorkouts: afterHistory.length,
          hadWin: rewards.hasRewards || overallAfter > overallBefore,
        });

        // Primary celebration moment — acknowledge unlocks so the Profile badge doesn't re-celebrate.
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

  const handleCancel = useCallback(() => {
    playTap();
    playHapticFeedback('light', false);
    onCancel?.();
  }, [onCancel, playTap]);

  const handleDone = useCallback(() => {
    playTap();
    playHapticFeedback('light', false);
    onComplete?.(strengthWin);
  }, [onComplete, playTap, strengthWin]);

  const displayExercises = useMemo(() => {
    return parsedWorkout?.exercises || [];
  }, [parsedWorkout]);

  // Uses the same per-session percentile as the exercise badges (this workout's 1RM),
  // not the all-time career ranking, so the headline tier stays consistent with the badges.
  const overallTierInfo = useMemo(() => {
    if (displayExercises.length === 0) return null;

    const bodyWeightLbs = userProfile
      ? convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit)
      : undefined;

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

    const avgPercentile = Math.round(
      sessionPercentiles.reduce((sum, p) => sum + p, 0) / sessionPercentiles.length
    );
    const tier = getStrengthTier(avgPercentile);
    const tierColor = getTierColor(tier);
    return { tier, tierColor, percentile: avgPercentile };
  }, [displayExercises, userLifts, userProfile]);

  const stats = useMemo(() => {
    const exerciseCount = displayExercises.length;

    const exercisesForStats = displayExercises.map(ex => ({
      id: ex.matchedExerciseId || ex.name,
      trackingType: ex.trackingType,
      completedSets: ex.sets?.map(set => ({
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        duration: set.duration,
        distance: set.distance,
        // Freeform sets (no flag) count as done; an unchecked check-off set is `false` and must
        // not inflate the summary. Mirrors the persistence rule so the finish screen matches saves.
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
      hasCardio: workoutStats.hasCardioExercises,
      totalDistanceMeters: workoutStats.totalDistanceMeters,
      totalCardioDurationSeconds: workoutStats.totalCardioDurationSeconds,
    };
  }, [displayExercises, duration]);

  const renderParsing = () => (
    <View style={styles.centerContainer}>
      <PixelHourglass />
      <Text variant="title" weight="semiBold" style={styles.parsingText}>
        Analyzing your workout…
      </Text>
      {error && (
        <Animated.View entering={FadeIn} style={styles.errorContainer}>
          <Text variant="meta" weight="medium" style={styles.errorText}>
            {error}
          </Text>
          <Button title="Go Back" onPress={() => onCancel?.()} variant="primary" />
        </Animated.View>
      )}
    </View>
  );

  const renderConfirmation = () => {
    return (
      <View style={[styles.confirmationContainer, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header,{ borderBottomColor: currentTheme.colors.border, paddingTop: Math.max(space.lg, insets.top) }]}>
          <View style={styles.headerLeft}>
            <Image
              source={require('@/assets/images/icon-original.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text variant="meta" weight="semiBold" tone="primary">
              morf
            </Text>
          </View>
          <Text variant="emphasis" weight="semiBold" tone="primary" style={styles.headerTitle}>
            {''}
          </Text>
          <IconButton icon="close" onPress={handleCancel} />
        </View>

        <>
            <View style={[styles.statsContainer,{ backgroundColor: currentTheme.colors.surface }]}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text variant="statHero" weight="bold" tone="primary" style={styles.statValue}>
                    {stats.durationStr || '--'}
                  </Text>
                  <Text variant="meta" tone="secondary" style={styles.statLabel}>
                    Duration
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
                <View style={styles.statItem}>
                  <Text variant="statHero" weight="bold" tone="primary" style={styles.statValue}>
                    {stats.exercises}
                  </Text>
                  <Text variant="meta" tone="secondary" style={styles.statLabel}>
                    Exercises
                  </Text>
                </View>
              </View>
              <View style={[styles.statsRowDivider, { backgroundColor: currentTheme.colors.border }]} />
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text variant="statHero" weight="bold" tone="primary" style={styles.statValue}>
                    {stats.sets}
                  </Text>
                  <Text variant="meta" tone="secondary" style={styles.statLabel}>
                    Sets
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
                <View style={styles.statItem}>
                  {overallTierInfo ? (
                    <TierBadge tier={overallTierInfo.tier} size="medium" variant="text" />
                  ) : (
                    <Text variant="statHero" weight="bold" tone="primary" style={styles.statValue}>
                      --
                    </Text>
                  )}
                  <Text variant="meta" tone="secondary" style={styles.statLabel}>
                    Overall Tier
                  </Text>
                </View>
              </View>

              {stats.hasCardio &&(stats.totalDistanceMeters > 0 || stats.totalCardioDurationSeconds > 0) && (
                <>
                  <View style={[styles.statsRowDivider, { backgroundColor: currentTheme.colors.border }]} />
                  <View style={styles.statsRow}>
                    {stats.totalDistanceMeters > 0 && (
                      <>
                        <View style={styles.statItem}>
                          <Text variant="statHero" weight="bold" tone="primary" style={styles.statValue}>
                            {formatDistance(stats.totalDistanceMeters)}
                          </Text>
                          <Text variant="meta" tone="secondary" style={styles.statLabel}>
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
                        <Text variant="statHero" weight="bold" tone="primary" style={styles.statValue}>
                          {formatDuration(stats.totalCardioDurationSeconds)}
                        </Text>
                        <Text variant="meta" tone="secondary" style={styles.statLabel}>
                          Cardio Time
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>

            <ScrollView style={styles.exercisesList}contentContainerStyle={styles.exercisesContent} showsVerticalScrollIndicator={false}>
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
                        <Text variant="body" weight="semiBold" tone="primary">
                          {exerciseInfo?.name || exercise.name}
                        </Text>
                        {best1RM > 0 && (
                          <Text variant="meta" weight="semiBold">
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
                              <Text variant="meta" weight="medium" tone="muted" style={styles.setNumber}>
                                Set {setIndex + 1}
                              </Text>
                              <Text variant="meta" weight="medium" tone="primary">
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

            <View style={[
              styles.actionsContainer,
              { backgroundColor: currentTheme.colors.background, borderTopColor: currentTheme.colors.border, paddingBottom: Math.max(space.lg, insets.bottom) }
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

  const renderCelebration = () => (
    <WorkoutCompleteScreen
      stats={stats}
      exercises={displayExercises}
      userLifts={userLifts}
      userProfile={userProfile}
      weightUnit={weightUnit}
      onDone={handleDone}
      isSmallScreen={isSmallScreen}
      rewards={sessionRewards}
      title={savedTitle}
      percentileMove={percentileMove}
    />
  );

  if (!visible) return null;

  const showDarkBackground = modalState === 'parsing' || modalState === 'celebration';

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
    // Extra-wide gutter is structural to the centered parsing composition.
    paddingHorizontal: 32,
  },
  // Dark parsing overlay keeps its white text (named palette exception).
  parsingText: {
    color: '#fff',
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: space.section,
    alignItems: 'center',
  },
  errorText: {
    color: trend.down,
    textAlign: 'center',
    marginBottom: space.lg,
  },
  confirmationContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
    paddingBottom: space.md,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  statsContainer: {
    marginHorizontal: space.lg,
    marginTop: space.lg,
    borderRadius: radius.card,
    paddingVertical: space.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statsRowDivider: {
    height: 1,
    marginVertical: space.md,
    marginHorizontal: space.xl,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    letterSpacing: track.display,
  },
  statLabel: {
    marginTop: space.xs,
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesContent: {
    padding: space.lg,
    paddingBottom: 32,
  },
  exerciseCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    marginBottom: space.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.md,
    gap: space.md,
  },
  exerciseNameContainer: {
    flex: 1,
    gap: 2,
  },
  setsContainer: {
    gap: space.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumber: {
    width: 50,
  },
  actionsContainer: {
    padding: space.lg,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmButton: {
    width: '100%',
  },
  hourglass: {
    width: 72,
    height: 72,
    marginBottom: space.section,
  },
  setsSection: {
    gap: space.xs,
  },
});

export default WorkoutFinishModal;
