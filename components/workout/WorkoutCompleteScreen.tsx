import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { getExerciseBadgeInfo } from '@/components/workout/ExerciseBadge';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import AchievementBadge from '@/components/gamification/AchievementBadge';
import { ACHIEVEMENT_EMBLEMS } from '@/lib/gamification/achievementEmblems';
import FlipCard from '@/components/gamification/FlipCard';
import CareerModal from '@/components/gamification/CareerModal';
import { RARITY_META } from '@/lib/gamification/rarity';
import { SessionRewards } from '@/lib/gamification/sessionRewards';
import { getWorkoutById } from '@/lib/workout/workouts';
import { convertWeightToLbs } from '@/lib/utils/utils';
import { ParsedExercise, ParsedExerciseSummary } from '@/lib/workout/workoutNoteParser';
import { UserProfile, UserProgress, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import playHapticFeedback from '@/lib/utils/haptic';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// PR info for celebration
interface PRInfo {
  exerciseName: string;
  exerciseId?: string;
  newPR: number;
  previousPR: number;
  improvement: number;
  percentile?: number;
}

interface WorkoutCompleteScreenProps {
  stats: {
    exercises: number;
    sets: number;
    durationStr: string;
  };
  exercises: (ParsedExercise | ParsedExerciseSummary)[];
  userLifts: UserProgress[];
  userProfile: UserProfile | null;
  weightUnit: WeightUnit;
  onDone: () => void;
  isSmallScreen?: boolean;
  rewards?: SessionRewards | null;
}

// A single earned achievement that flips to reveal what it took to unlock it.
function AchievementRewardRow({
  achievement,
}: {
  achievement: SessionRewards['newAchievements'][number];
}) {
  const { currentTheme } = useTheme();
  const accent = RARITY_META[achievement.rarity].accent;

  const front = (
    <View style={[styles.achRowFace, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      <AchievementBadge
        icon={achievement.icon}
        emblem={ACHIEVEMENT_EMBLEMS[achievement.id]}
        rarity={achievement.rarity}
        size={34}
      />
      <View style={styles.achTextWrap}>
        <Text style={[styles.achTitle, { color: '#fff', fontWeight: '600' }]} numberOfLines={1}>
          {achievement.title}
        </Text>
        <Text style={[styles.achSub, { color: accent, fontWeight: '500' }]}>
          {RARITY_META[achievement.rarity].label} · unlocked
        </Text>
      </View>
      <Ionicons name="sync-outline" size={14} color="rgba(255,255,255,0.4)" />
    </View>
  );

  const back = (
    <View style={[styles.achRowFace, styles.achRowBack, { backgroundColor: accent + '1F', borderColor: accent }]}>
      <View style={styles.achTextWrap}>
        <Text style={[styles.achSub, { color: accent, fontWeight: '600' }]} numberOfLines={1}>
          {achievement.title}
        </Text>
        <Text style={[styles.achBackDesc, { color: '#fff', fontWeight: '400' }]} numberOfLines={2}>
          {achievement.description}
        </Text>
      </View>
    </View>
  );

  return <FlipCard front={front} back={back} height={66} style={styles.achRowWrap} />;
}

// Gamification rewards earned this session: new achievements. Sits below the PR
// highlights in the celebration screen. Tap a row to flip it and see what it took.
function RewardsSection({ rewards }: { rewards: SessionRewards }) {
  const { currentTheme } = useTheme();
  const { newAchievements } = rewards;
  const shownAch = newAchievements.slice(0, 3);

  return (
    <Animated.View entering={FadeIn.delay(450)} style={styles.rewardsSection}>
      {shownAch.length > 0 && (
        <View style={styles.achList}>
          {shownAch.map(a => (
            <AchievementRewardRow key={a.id} achievement={a} />
          ))}
          {newAchievements.length > shownAch.length && (
            <Text style={[styles.achMore, { color: 'rgba(255,255,255,0.5)', fontWeight: '400' }]}>
              +{newAchievements.length - shownAch.length} more unlocked
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
}

// Confetti particle
const Particle = ({ delay, startX, color }: { delay: number; startX: number; color: string }) => {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(startX);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 8 }));
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 100, { duration: 3000, easing: Easing.out(Easing.quad) })
    );
    const drift = (Math.random() - 0.5) * 100;
    translateX.value = withDelay(delay, withTiming(startX + drift, { duration: 3000 }));
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 1000 }), -1, false)
    );
    opacity.value = withDelay(delay + 2000, withTiming(0, { duration: 1000 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Animation runs once on mount
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.particle, { backgroundColor: color }, animatedStyle]} />
  );
};

// Pulsing badge for PR header
const PulsingBadge = ({ text, color }: { text: string; color: string }) => {
  const { currentTheme } = useTheme();
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    opacity.value = withDelay(
      400,
      withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.prBadge, { backgroundColor: color, borderColor: color }, animatedStyle]}>
      <Text style={[styles.prBadgeText, { color: '#fff', fontWeight: '700' }]}>
        {text}
      </Text>
    </Animated.View>
  );
};

// Animated counting number
const AnimatedCounter = ({
  value,
  suffix = '',
  duration = 1500,
  delay = 0,
  style,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  style?: any;
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDisplayValue(value), delay + duration);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Text style={style}>
      {displayValue}{suffix}
    </Text>
  );
};

// Interactive stat card
const StatCard = ({
  icon,
  value,
  label,
  suffix = '',
  delay = 0,
  onPress,
  isSmallScreen,
  primaryColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  suffix?: string;
  delay?: number;
  onPress?: () => void;
  isSmallScreen?: boolean;
  primaryColor: string;
}) => {
  const scale = useSharedValue(1);
  const { currentTheme } = useTheme();

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const content = (
    <Animated.View
      style={[
        styles.statCard,
        { backgroundColor: 'rgba(255,255,255,0.1)' },
        isSmallScreen && styles.statCardSmall,
        animatedStyle,
      ]}
    >
      <Ionicons name={icon} size={isSmallScreen ? 20 : 24} color={primaryColor} />
      {typeof value === 'number' ? (
        <AnimatedCounter
          value={value}
          suffix={suffix}
          delay={delay}
          style={[
            styles.statCardValue,
            { color: '#fff', fontWeight: '700' },
            isSmallScreen && styles.statCardValueSmall,
          ]}
        />
      ) : (
        <Text style={[
          styles.statCardValue,
          { color: '#fff', fontWeight: '700' },
          isSmallScreen && styles.statCardValueSmall,
        ]}>
          {value}
        </Text>
      )}
      <Text style={[styles.statCardLabel, { color: 'rgba(255,255,255,0.6)', fontWeight: '400' }]}>
        {label}
      </Text>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default function WorkoutCompleteScreen({
  stats,
  exercises,
  userLifts,
  userProfile,
  weightUnit,
  onDone,
  isSmallScreen = false,
  rewards,
}: WorkoutCompleteScreenProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showExerciseDetails, setShowExerciseDetails] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  // Simple scale animation for checkmark
  const checkScale = useSharedValue(0);
  // Breathing gold glow around the PR card — makes a new PR feel earned.
  const prGlow = useSharedValue(0);

  // Generate confetti particles
  const particles = useMemo(() => {
    const colors = [
      currentTheme.colors.primary,
      currentTheme.colors.accent,
      '#FFD700',
      '#FF6B6B',
      '#4ECDC4',
      '#A78BFA',
    ];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      delay: Math.random() * 500,
      startX: Math.random() * SCREEN_WIDTH,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, [currentTheme]);

  // Detect PRs from exercises
  const prs = useMemo((): PRInfo[] => {
    const detectedPRs: PRInfo[] = [];
    const bodyWeightLbs = userProfile ? convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit) : undefined;

    for (const exercise of exercises) {
      if (!exercise.matchedExerciseId || exercise.isCustom) continue;

      const sets = exercise.sets || [];
      if (sets.length === 0) continue;

      const badgeInfo = getExerciseBadgeInfo(
        exercise.matchedExerciseId,
        exercise.isCustom,
        sets,
        userLifts,
        bodyWeightLbs,
        userProfile?.gender
      );

      if (badgeInfo?.type === 'tier' && badgeInfo.isPR) {
        const exerciseInfo = getWorkoutById(exercise.matchedExerciseId);
        const userLift = userLifts.find(l => l.workoutId === exercise.matchedExerciseId);

        // Calculate best 1RM from this workout
        const best1RM = Math.max(
          ...sets.map(set => {
            if (set.reps === 0) return 0;
            return OneRMCalculator.estimate(set.weight, set.reps);
          }),
          0
        );

        const previousPR = userLift?.personalRecord || 0;
        const improvement = previousPR > 0 ? best1RM - previousPR : 0;

        detectedPRs.push({
          exerciseName: exerciseInfo?.name || exercise.name,
          exerciseId: exercise.matchedExerciseId,
          newPR: Math.round(best1RM),
          previousPR: Math.round(previousPR),
          improvement: Math.round(improvement),
          percentile: badgeInfo.percentile,
        });
      }
    }

    return detectedPRs;
  }, [exercises, userLifts, userProfile]);

  // Start celebration animation on mount
  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    // Land the celebration with a haptic — a heavier "success" when a PR was set.
    playHapticFeedback(prs.length > 0 ? 'success' : 'medium', false);
    if (prs.length > 0) {
      prGlow.value = withDelay(
        500,
        withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Pulsing border + soft halo on the PR card.
  const prGlowStyle = useAnimatedStyle(() => ({
    borderWidth: 1.5,
    borderColor: interpolateColor(
      prGlow.value,
      [0, 1],
      ['rgba(255,215,0,0.18)', 'rgba(255,215,0,0.85)'],
    ),
    shadowColor: '#FFD700',
    shadowOpacity: 0.25 + prGlow.value * 0.45,
    shadowRadius: 8 + prGlow.value * 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4 + prGlow.value * 8,
  }));

  const handleStatPress = useCallback(() => setShowExerciseDetails(v => !v), []);

  return (
    <Animated.View entering={FadeIn} style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Confetti particles */}
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          delay={particle.delay}
          startX={particle.startX}
          color={particle.color}
        />
      ))}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Logo */}
          <Animated.View style={[styles.logoHeader, checkAnimatedStyle]}>
            <Image
              source={require('@/assets/images/icon-original.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={[styles.logoText, { color: 'rgba(255,255,255,0.4)', fontWeight: '500' }]}>
              morf
            </Text>
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(200)}
            style={[styles.title, { color: '#fff', fontWeight: '700' }]}
          >
            Workout Complete!
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(300)}
            style={[styles.subtitle, { color: 'rgba(255,255,255,0.6)', fontWeight: '400' }]}
          >
            Great job crushing it today
          </Animated.Text>

          {/* PR Highlights Section */}
          {prs.length > 0 && (
            <View style={styles.prSection}>
              <PulsingBadge
                text={prs.length === 1 ? 'NEW PR' : `${prs.length} NEW PRs`}
                color="#3B82F6"
              />
              <Animated.View
                entering={FadeIn.delay(500)}
                style={[
                  styles.prCard,
                  {
                    backgroundColor: 'rgba(255,255,255,0.06)',
                  },
                  prGlowStyle,
                ]}
              >
                {prs.map((pr, index) => (
                  <Animated.View
                    key={pr.exerciseId || index}
                    entering={FadeIn.delay(600 + index * 100)}
                    style={styles.prRow}
                  >
                    <View style={[styles.prCardContent, { backgroundColor: 'transparent' }]}>
                      <Text style={[styles.prExerciseName, { color: 'rgba(255,255,255,0.7)', fontWeight: '400' }]}>
                        {pr.exerciseName}
                      </Text>
                      <View style={[styles.prValueRow, { backgroundColor: 'transparent' }]}>
                        <AnimatedCounter
                          value={pr.newPR}
                          delay={650 + index * 100}
                          duration={1200}
                          style={[styles.prValue, { color: '#fff', fontWeight: '700' }]}
                        />
                        <Text style={[styles.prUnit, { color: 'rgba(255,255,255,0.5)', fontWeight: '400' }]}>
                          {weightUnit}
                        </Text>
                        {pr.improvement > 0 && (
                          <Text style={[styles.improvementText, { color: '#4ADE80', fontWeight: '600' }]}>
                            ↑{pr.improvement}
                          </Text>
                        )}
                      </View>
                    </View>
                    {pr.percentile && (
                      <TierBadge percentile={pr.percentile} size="small" />
                    )}
                  </Animated.View>
                ))}
              </Animated.View>
            </View>
          )}

          {/* Gamification rewards: newly unlocked achievements */}
          {rewards?.hasRewards && <RewardsSection rewards={rewards} />}

          {/* Always-available entry to the full achievement collection */}
          <Animated.View entering={FadeIn.delay(550)} style={styles.viewAllWrap}>
            <TouchableOpacity
              style={[styles.viewAllButton, { borderColor: 'rgba(255,255,255,0.18)' }]}
              onPress={() => {
                playHapticFeedback('light', false);
                setShowAllAchievements(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="trophy-outline" size={16} color="#fff" />
              <Text style={[styles.viewAllText, { color: '#fff', fontWeight: '500' }]}>
                View all achievements
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </Animated.View>

          {/* Interactive Stats */}
          <Animated.View entering={FadeIn.delay(500)} style={[styles.statsContainer, isSmallScreen && styles.statsContainerSmall]}>
            <StatCard
              icon="time-outline"
              value={stats.durationStr}
              label="Duration"
              delay={600}
              isSmallScreen={isSmallScreen}
              primaryColor={currentTheme.colors.primary}
            />
            <StatCard
              icon="barbell-outline"
              value={stats.exercises}
              label="Exercises"
              delay={700}
              onPress={handleStatPress}
              isSmallScreen={isSmallScreen}
              primaryColor={currentTheme.colors.primary}
            />
            <StatCard
              icon="flame-outline"
              value={stats.sets}
              label="Sets"
              delay={800}
              onPress={handleStatPress}
              isSmallScreen={isSmallScreen}
              primaryColor={currentTheme.colors.primary}
            />
          </Animated.View>

          {/* Exercise Details (expandable) */}
          {showExerciseDetails && (
            <Animated.View entering={FadeIn} style={styles.exerciseDetailsContainer}>
              <Text style={[styles.exerciseDetailsTitle, { color: 'rgba(255,255,255,0.8)', fontWeight: '600' }]}>
                Exercises
              </Text>
              {exercises.map((exercise, index) => {
                const exerciseInfo = exercise.matchedExerciseId
                  ? getWorkoutById(exercise.matchedExerciseId)
                  : null;
                const setCount = exercise.sets?.length || (exercise as ParsedExerciseSummary).setCount || 0;

                return (
                  <View
                    key={index}
                    style={[styles.exerciseDetailRow, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}
                  >
                    <Text style={[styles.exerciseDetailName, { color: '#fff', fontWeight: '500' }]}>
                      {exerciseInfo?.name || exercise.name}
                    </Text>
                    <Text style={[styles.exerciseDetailSets, { color: 'rgba(255,255,255,0.6)', fontWeight: '400' }]}>
                      {setCount} {setCount === 1 ? 'set' : 'sets'}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          )}

        </View>
      </ScrollView>

      {/* Action buttons - pinned to bottom */}
      <Animated.View
        entering={FadeIn.delay(700)}
        style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        {/* Done button */}
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: currentTheme.colors.primary }]}
          onPress={onDone}
          activeOpacity={0.8}
        >
          <Text style={[styles.doneButtonText, { fontWeight: '600' }]}>
            Done
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Full achievement collection, opened from "View all achievements" */}
      <CareerModal visible={showAllAchievements} onClose={() => setShowAllAchievements(false)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerLogo: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  logoText: {
    fontSize: 15,
    letterSpacing: 1,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 36,
  },
  // PR Section
  prSection: {
    width: '100%',
    marginBottom: 32,
    gap: 12,
  },
  prBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#C15F3C',
  },
  prBadgeText: {
    fontSize: 14,
    color: '#000',
    letterSpacing: 0.5,
  },
  prCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  prCardContent: {
    flex: 1,
    gap: 2,
  },
  prExerciseName: {
    fontSize: 14,
  },
  prValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prValue: {
    fontSize: 18,
  },
  prUnit: {
    fontSize: 14,
  },
  improvementText: {
    fontSize: 13,
  },
  // Rewards (gamification)
  rewardsSection: {
    width: '100%',
    marginBottom: 32,
    gap: 12,
  },
  achList: {
    width: '100%',
    gap: 10,
  },
  achRowWrap: {
    width: '100%',
  },
  achRowFace: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  achRowBack: {
    paddingVertical: 10,
  },
  achTextWrap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  achTitle: {
    fontSize: 15,
  },
  achSub: {
    fontSize: 12,
    marginTop: 1,
  },
  achBackDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  achMore: {
    fontSize: 13,
    textAlign: 'center',
  },
  viewAllWrap: {
    width: '100%',
    marginBottom: 28,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  viewAllText: {
    fontSize: 14,
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 36,
  },
  statsContainerSmall: {
    gap: 8,
  },
  statCard: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 90,
  },
  statCardSmall: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 75,
  },
  statCardValue: {
    fontSize: 24,
    marginTop: 8,
  },
  statCardValueSmall: {
    fontSize: 20,
    marginTop: 6,
  },
  statCardLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  // Exercise Details
  exerciseDetailsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  exerciseDetailsTitle: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  exerciseDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  exerciseDetailName: {
    fontSize: 14,
    flex: 1,
  },
  exerciseDetailSets: {
    fontSize: 13,
  },
  // Buttons
  buttonContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  // Confetti
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
