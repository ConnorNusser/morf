import Button from '@/components/Button';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space, tint, track, trend } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
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

function AchievementRewardRow({
  achievement,
}: {
  achievement: SessionRewards['newAchievements'][number];
}) {
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
        <Text variant="body" weight="semiBold" style={styles.achTitle} numberOfLines={1}>
          {achievement.title}
        </Text>
        <Text variant="meta" weight="medium" style={[styles.achSub, { color: accent }]}>
          {RARITY_META[achievement.rarity].label} · unlocked
        </Text>
      </View>
      <Ionicons name="sync-outline" size={14} color="rgba(255,255,255,0.4)" />
    </View>
  );

  const back = (
    <View style={[styles.achRowFace, styles.achRowBack, { backgroundColor: tint(accent), borderColor: accent }]}>
      <View style={styles.achTextWrap}>
        <Text variant="meta" weight="semiBold" style={[styles.achSub, { color: accent }]} numberOfLines={1}>
          {achievement.title}
        </Text>
        <Text variant="meta" style={styles.achBackDesc} numberOfLines={2}>
          {achievement.description}
        </Text>
      </View>
    </View>
  );

  // height 76 absorbs the 12→14pt type-floor snap without clipping the two-line back face.
  return <FlipCard front={front} back={back} height={76} style={styles.achRowWrap} />;
}

function RewardsSection({ rewards }: { rewards: SessionRewards }) {
  const { newAchievements } = rewards;
  const shownAch = newAchievements.slice(0, 3);

  // No artificial delay: this only mounts once async rewards land, so a delay just made it lag.
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.rewardsSection}>
      {shownAch.length > 0 && (
        <View style={styles.achList}>
          {shownAch.map(a => (
            <AchievementRewardRow key={a.id} achievement={a} />
          ))}
          {newAchievements.length > shownAch.length && (
            <Text variant="meta" style={styles.achMore}>
              +{newAchievements.length - shownAch.length} more unlocked
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const Particle =({ delay, startX, color }: { delay: number; startX: number; color: string }) => {
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
    // Spin only while falling, then stop (an infinite withRepeat kept all 30 draining the UI thread).
    rotate.value = withDelay(
      delay,
      withTiming(360 * 3, { duration: 3000, easing: Easing.linear })
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

const PulsingBadge =({ text, color }: { text: string; color: string }) => {
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
      <Text variant="meta" weight="bold" style={styles.prBadgeText}>
        {text}
      </Text>
    </Animated.View>
  );
};

const AnimatedCounter =({
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
    // Count up 0 → value via RAF rather than hard-jumping when the timeout fires.
    let raf = 0;
    let start: number | null = null;
    const begin = setTimeout(() => {
      const tick = (now: number) => {
        if (start === null) start = now;
        const p = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplayValue(Math.round(value * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(begin); if (raf) cancelAnimationFrame(raf); };
  }, [value, delay, duration]);

  return (
    <Text style={style}>
      {displayValue}{suffix}
    </Text>
  );
};

const StatCard =({
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
            isSmallScreen && styles.statCardValueSmall,
          ]}
        />
      ) : (
        <Text style={[
          styles.statCardValue,
          isSmallScreen && styles.statCardValueSmall,
        ]}>
          {value}
        </Text>
      )}
      <Text variant="meta" style={styles.statCardLabel}>
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

  const checkScale = useSharedValue(0);
  const prGlow = useSharedValue(0);

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

  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 12, stiffness: 100 });
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
    <Animated.View entering={FadeIn} style={styles.container}>
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
          <Animated.View style={[styles.logoHeader, checkAnimatedStyle]}>
            <Image
              source={require('@/assets/images/icon-original.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text variant="body" weight="medium" style={styles.logoText}>
              morf
            </Text>
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(200)}
            style={styles.title}
          >
            Workout Complete!
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(300)}
            style={styles.subtitle}
          >
            Great job crushing it today
          </Animated.Text>

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
                    <View style={styles.prCardContent}>
                      <Text variant="meta" style={styles.prExerciseName}>
                        {pr.exerciseName}
                      </Text>
                      <View style={styles.prValueRow}>
                        <AnimatedCounter
                          value={pr.newPR}
                          delay={650 + index * 100}
                          duration={1200}
                          style={styles.prValue}
                        />
                        <Text variant="meta" style={styles.prUnit}>
                          {weightUnit}
                        </Text>
                        {pr.improvement > 0 && (
                          <Text variant="meta" weight="semiBold" style={styles.improvementText}>
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

          {rewards?.hasRewards && <RewardsSection rewards={rewards} />}

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
              <Text variant="meta" weight="semiBold" style={styles.viewAllText}>
                View all achievements
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </Animated.View>

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

          {showExerciseDetails && (
            <Animated.View entering={FadeIn} style={styles.exerciseDetailsContainer}>
              <Text variant="meta" weight="semiBold" style={styles.exerciseDetailsTitle}>
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
                    <Text variant="meta" weight="medium" style={styles.exerciseDetailName}>
                      {exerciseInfo?.name || exercise.name}
                    </Text>
                    <Text variant="meta" style={styles.exerciseDetailSets}>
                      {setCount} {setCount === 1 ? 'set' : 'sets'}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          )}

        </View>
      </ScrollView>

      <Animated.View
        entering={FadeIn.delay(700)}
        style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
      >
        {/* White label kept: this screen is always dark regardless of theme (named palette exception). */}
        <Button
          title="Done"
          onPress={onDone}
          variant="primary"
          size="large"
          textStyle={styles.doneButtonText}
        />
      </Animated.View>

      <CareerModal visible={showAllAchievements} onClose={() => setShowAllAchievements(false)} />
    </Animated.View>
  );
}

// White-alpha palette is a named exception (screen is always dark); 28/32/36 rhythm is structural.
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
    paddingHorizontal: space.section,
    paddingTop: space.lg,
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
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: track.caps,
    marginTop: space.md,
  },
  title: {
    fontSize: type.statHero,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: space.md,
  },
  subtitle: {
    fontSize: type.body,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 36,
  },
  prSection: {
    width: '100%',
    marginBottom: 32,
    gap: space.md,
  },
  prBadge: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.badge,
    alignSelf: 'center',
    borderWidth: 1.5,
  },
  prBadgeText: {
    color: '#fff',
  },
  prCard: {
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  prCardContent: {
    flex: 1,
    gap: 2,
  },
  prExerciseName: {
    color: 'rgba(255,255,255,0.7)',
  },
  prValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  prValue: {
    fontSize: type.emphasis,
    fontWeight: '700',
    color: '#fff',
  },
  prUnit: {
    color: 'rgba(255,255,255,0.5)',
  },
  improvementText: {
    color: trend.up,
  },
  rewardsSection: {
    width: '100%',
    marginBottom: 32,
    gap: space.md,
  },
  achList: {
    width: '100%',
    gap: space.md,
  },
  achRowWrap: {
    width: '100%',
  },
  achRowFace: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  achRowBack: {
    paddingVertical: space.md,
  },
  achTextWrap: {
    flex: 1,
  },
  achTitle: {
    color: '#fff',
  },
  achSub: {
    marginTop: 1,
  },
  achBackDesc: {
    color: '#fff',
    marginTop: 2,
    lineHeight: lineHeightFor(type.meta),
  },
  achMore: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  viewAllWrap: {
    width: '100%',
    marginBottom: 28,
  },
  // White-alpha border is the dark-screen palette exception.
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  viewAllText: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: 36,
  },
  statsContainerSmall: {
    gap: space.sm,
  },
  statCard: {
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.card,
    minWidth: 90,
  },
  statCardSmall: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minWidth: 75,
  },
  statCardValue: {
    fontSize: type.statHero,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: track.display,
    marginTop: space.sm,
  },
  statCardValueSmall: {
    fontSize: type.title,
    marginTop: space.sm,
  },
  statCardLabel: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: space.xs,
  },
  exerciseDetailsContainer: {
    width: '100%',
    marginBottom: space.section,
  },
  exerciseDetailsTitle: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: space.md,
    textAlign: 'center',
  },
  exerciseDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    marginBottom: space.sm,
  },
  exerciseDetailName: {
    color: '#fff',
    flex: 1,
  },
  exerciseDetailSets: {
    color: 'rgba(255,255,255,0.6)',
  },
  buttonContainer: {
    paddingHorizontal: space.section,
    paddingTop: space.lg,
    gap: space.md,
  },
  doneButtonText: {
    color: '#fff',
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
