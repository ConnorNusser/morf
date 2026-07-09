// Post-workout celebration. The hero is a shareable recap card (ViewShot →
// system share sheet): brand, session title + stats, top lift, PRs, and the
// lifter's overall standing. Below it: the career-style percentile progression
// this session earned, plus any unlocked achievements.
// White-alpha palette throughout is a named exception — this screen is always
// dark regardless of theme.
import Button from '@/components/Button';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space, tint, track, trend } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { getExerciseBadgeInfo } from '@/components/workout/ExerciseBadge';
import { getStrengthTier, getTierColor, OneRMCalculator } from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import AchievementBadge from '@/components/gamification/AchievementBadge';
import { ACHIEVEMENT_EMBLEMS } from '@/lib/gamification/achievementEmblems';
import FlipCard from '@/components/gamification/FlipCard';
import CareerModal from '@/components/gamification/CareerModal';
import { formatCompact } from '@/lib/gamification/careerStats';
import { RARITY_META } from '@/lib/gamification/rarity';
import { SessionRewards } from '@/lib/gamification/sessionRewards';
import { captureAndShare } from '@/lib/ui/shareUtils';
import { getWorkoutById } from '@/lib/workout/workouts';
import { convertWeightForPreference, convertWeightToLbs } from '@/lib/utils/utils';
import { ParsedExercise, ParsedExerciseSummary } from '@/lib/workout/workoutNoteParser';
import { UserProfile, UserProgress, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import playHapticFeedback from '@/lib/utils/haptic';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Drop trailing "(Equipment)" so PR rows fit on one line.
const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

// Generated fallback titles ("Workout - 7/9/2026") read as filler on the share
// card — swap them for a clean day-based headline.
function cardTitleFor(title: string | null | undefined): string {
  const t = (title || '').trim();
  if (t && !/^workout\b/i.test(t)) return t;
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return `${day} workout`;
}

// Solid (non-alpha) card surface so ViewShot captures cleanly on the dark screen.
const CARD_BG = '#111116';
const CARD_BORDER = 'rgba(255,255,255,0.12)';
const CARD_HAIRLINE = 'rgba(255,255,255,0.08)';

interface PRInfo {
  exerciseName: string;
  exerciseId?: string;
  newPR: number;
  previousPR: number;
  improvement: number;
  percentile?: number;
}

export interface PercentileMove {
  before: number;
  after: number;
}

interface WorkoutCompleteScreenProps {
  stats: {
    exercises: number;
    sets: number;
    durationStr: string;
    volume?: number; // lbs
  };
  exercises: (ParsedExercise | ParsedExerciseSummary)[];
  userLifts: UserProgress[];
  userProfile: UserProfile | null;
  weightUnit: WeightUnit;
  onDone: () => void;
  isSmallScreen?: boolean;
  rewards?: SessionRewards | null;
  // Generated title of the just-saved session ("Push Day"); null until it lands.
  title?: string | null;
  // Overall strength percentile before → after this session.
  percentileMove?: PercentileMove | null;
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
  if (shownAch.length === 0) return null;

  // No artificial delay: this only mounts once async rewards land, so a delay just made it lag.
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.rewardsSection}>
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
    </Animated.View>
  );
}

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

// Percentile sweep: before → after with the tier color. RN Animated (not
// reanimated) because `from` is dynamic and the pattern matches WorkoutStatsCard.
function ProgressionBar({ from, to, color }: { from: number; to: number; color: string }) {
  const fill = useRef(new RNAnimated.Value(Math.max(2, Math.min(100, from)))).current;
  useEffect(() => {
    RNAnimated.timing(fill, {
      toValue: Math.max(2, Math.min(100, to)),
      duration: 1100,
      delay: 500,
      useNativeDriver: false,
    }).start();
  }, [to, fill]);
  const width = fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View style={styles.progressTrack}>
      <RNAnimated.View style={[styles.progressFill, { width, backgroundColor: color }]} />
    </View>
  );
}

// The percentile progression this session earned — the Career hero's language.
function ProgressionSection({ move }: { move: PercentileMove }) {
  // A 0 "before" means this is the first percentile ever computed — a delta
  // against nothing reads as noise, so only show earned movement.
  const delta = move.before > 0 ? move.after - move.before : 0;
  const tier = getStrengthTier(move.after);
  const color = getTierColor(tier);
  const band = getTierBandProgress(move.after);

  return (
    <Animated.View entering={FadeIn.delay(400)} style={styles.progressSection}>
      <View style={styles.progressHead}>
        <Text variant="meta" weight="bold" style={styles.progressLabel}>
          OVERALL STRENGTH
        </Text>
        <Text variant="meta" weight="semiBold" style={styles.progressValue}>
          {delta > 0 && (
            <Text variant="meta" weight="bold" style={{ color: trend.up }}>
              +{delta}{'  '}
            </Text>
          )}
          {move.after} percentile
        </Text>
      </View>
      <ProgressionBar from={move.before} to={move.after} color={color} />
      <Text variant="meta" style={styles.progressCaption}>
        {band.nextTier ? (
          <>
            <Text variant="meta" weight="semiBold" style={styles.progressCaptionStrong}>
              {band.toNext}
            </Text>
            {' to '}
            <Text variant="meta" weight="semiBold" style={{ color: getTierColor(band.nextTier) }}>
              {band.nextTier}
            </Text>
          </>
        ) : (
          'Max tier reached'
        )}
      </Text>
    </Animated.View>
  );
}

export default function WorkoutCompleteScreen({
  stats,
  exercises,
  userLifts,
  userProfile,
  weightUnit,
  onDone,
  isSmallScreen = false,
  rewards,
  title,
  percentileMove,
}: WorkoutCompleteScreenProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const shareRef = useRef<ViewShot>(null);

  const particles = useMemo(() => {
    const colors = [
      currentTheme.colors.primary,
      currentTheme.colors.accent,
      '#FFD700',
      '#FF6B6B',
      '#4ECDC4',
      '#A78BFA',
    ];
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      delay: Math.random() * 500,
      startX: Math.random() * SCREEN_WIDTH,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, [currentTheme]);

  const prs = useMemo((): PRInfo[] => {
    // The history diff is the source of truth for PRs — it covers every
    // featured lift, including secondary lifts the badge scan below misses
    // (which the app already pushes to friends). The badge scan is only the
    // fallback while rewards are still computing (or failed best-effort).
    if (rewards) {
      return rewards.newPRs.map(({ lift, previous }) => ({
        exerciseName: lift.name,
        exerciseId: lift.exerciseId,
        newPR: Math.round(lift.estimatedOneRM),
        previousPR: Math.round(previous ?? 0),
        improvement: previous !== null ? Math.round(lift.estimatedOneRM - previous) : 0,
        percentile: userLifts.find(l => l.workoutId === lift.exerciseId)?.percentileRanking,
      }));
    }

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
  }, [rewards, exercises, userLifts, userProfile]);

  // The session's heaviest statement: best e1RM set across weighted lifts.
  const topLift = useMemo(() => {
    let best: { name: string; weight: number; reps: number; e1rm: number } | null = null;
    for (const exercise of exercises) {
      if (exercise.trackingType && exercise.trackingType !== 'reps') continue;
      for (const set of exercise.sets || []) {
        if ((set.weight || 0) <= 0 || (set.reps || 0) <= 0) continue;
        const e1rm = OneRMCalculator.estimate(set.weight, set.reps);
        if (!best || e1rm > best.e1rm) {
          const info = exercise.matchedExerciseId ? getWorkoutById(exercise.matchedExerciseId) : null;
          best = {
            name: (info?.name || exercise.name).replace(/\s*\([^)]*\)\s*$/, '').trim(),
            weight: Math.round(set.weight),
            reps: set.reps,
            e1rm: Math.round(e1rm),
          };
        }
      }
    }
    return best;
  }, [exercises]);

  useEffect(() => {
    playHapticFeedback(prs.length > 0 ? 'success' : 'medium', false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only haptic
  }, []);

  // Celebrate diff-only PRs that land after mount too.
  const prCelebrated = useRef(false);
  useEffect(() => {
    if (prs.length === 0 || prCelebrated.current) return;
    prCelebrated.current = true;
    playHapticFeedback('success', false);
  }, [prs]);

  // "2 PRs · 1 achievement unlocked" — the session's wins in one line.
  const winsLine = useMemo(() => {
    const parts: string[] = [];
    if (prs.length > 0) parts.push(`${prs.length} ${prs.length === 1 ? 'PR' : 'PRs'}`);
    const achCount = rewards?.newAchievements.length ?? 0;
    if (achCount > 0) parts.push(`${achCount} ${achCount === 1 ? 'achievement' : 'achievements'}`);
    return parts.length > 0 ? `${parts.join(' · ')} unlocked` : 'Great job crushing it today';
  }, [prs, rewards]);

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const volumeDisplay =
    stats.volume && stats.volume > 0
      ? `${formatCompact(Math.round(convertWeightForPreference(stats.volume, 'lbs', weightUnit)))} ${weightUnit}`
      : null;
  const overallAfter = percentileMove?.after ?? 0;

  const handleShare = () => {
    playHapticFeedback('light', false);
    captureAndShare(shareRef as React.RefObject<ViewShot>);
  };

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
        <View style={[styles.content, isSmallScreen && styles.contentSmall]}>
          <Animated.Text entering={FadeIn.delay(150)} style={styles.title}>
            Workout Complete
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(250)} style={styles.subtitle}>
            {winsLine}
          </Animated.Text>

          {/* ---- Shareable recap card ---- */}
          <Animated.View entering={FadeIn.delay(350)} style={styles.cardWrap}>
            <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
              <View style={styles.card}>
                <View style={styles.cardBrandRow}>
                  <Image
                    source={require('@/assets/images/icon-original.png')}
                    style={styles.cardLogo}
                    resizeMode="contain"
                  />
                  <Text variant="meta" weight="semiBold" style={styles.cardBrand}>
                    morf
                  </Text>
                  <View style={styles.flex} />
                  <Text variant="meta" style={styles.cardDate}>
                    {dateStr}
                  </Text>
                </View>

                <Text style={styles.cardTitle} numberOfLines={1}>
                  {cardTitleFor(title)}
                </Text>
                <Text variant="meta" style={styles.cardMeta}>
                  {stats.durationStr} · {stats.sets} {stats.sets === 1 ? 'set' : 'sets'}
                  {volumeDisplay ? ` · ${volumeDisplay} lifted` : ''}
                </Text>

                {topLift && (
                  <View style={[styles.cardSection, { borderTopColor: CARD_HAIRLINE }]}>
                    <Text variant="meta" weight="bold" style={styles.cardLabel}>
                      TOP LIFT
                    </Text>
                    <View style={styles.cardRow}>
                      <Text variant="body" weight="semiBold" style={styles.cardRowName} numberOfLines={1}>
                        {topLift.name}
                      </Text>
                      <Text variant="body" weight="bold" style={styles.cardRowValue}>
                        {topLift.weight} × {topLift.reps}
                      </Text>
                    </View>
                  </View>
                )}

                {prs.length > 0 && (
                  <View style={[styles.cardSection, { borderTopColor: CARD_HAIRLINE }]}>
                    <Text variant="meta" weight="bold" style={[styles.cardLabel, { color: '#FFD700' }]}>
                      {prs.length === 1 ? 'NEW PR' : `${prs.length} NEW PRS`}
                    </Text>
                    {prs.map((pr, index) => (
                      <View key={pr.exerciseId || index} style={styles.cardRow}>
                        <Text variant="body" weight="semiBold" style={styles.cardRowName} numberOfLines={1}>
                          {shortName(pr.exerciseName)}
                        </Text>
                        <View style={styles.prValueCluster}>
                          <AnimatedCounter
                            value={pr.newPR}
                            delay={600 + index * 100}
                            duration={1000}
                            style={styles.prValue}
                          />
                          <Text variant="meta" style={styles.prUnit}>
                            {weightUnit}
                          </Text>
                          {pr.improvement > 0 && (
                            <Text variant="meta" weight="bold" style={styles.improvementText}>
                              ↑{pr.improvement}
                            </Text>
                          )}
                          {pr.percentile != null && <TierBadge percentile={pr.percentile} size="small" />}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {overallAfter > 0 && (
                  <View style={[styles.cardFooter, { borderTopColor: CARD_HAIRLINE }]}>
                    <TierBadge percentile={overallAfter} size="small" />
                    <Text variant="meta" weight="medium" style={styles.cardFooterText}>
                      Stronger than {overallAfter}% of lifters
                    </Text>
                  </View>
                )}
              </View>
            </ViewShot>
          </Animated.View>

          {percentileMove && percentileMove.after > 0 && <ProgressionSection move={percentileMove} />}

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
        </View>
      </ScrollView>

      <Animated.View
        entering={FadeIn.delay(700)}
        style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
      >
        <Button
          title="Share"
          onPress={handleShare}
          variant="secondary"
          size="large"
          style={styles.shareButton}
          textStyle={styles.shareButtonText}
        />
        {/* White label kept: this screen is always dark regardless of theme (named palette exception). */}
        <Button
          title="Done"
          onPress={onDone}
          variant="primary"
          size="large"
          style={styles.doneButton}
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
  flex: { flex: 1 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 72,
  },
  content: {
    paddingHorizontal: space.section,
    paddingBottom: 40,
  },
  contentSmall: {
    paddingHorizontal: space.lg,
  },
  title: {
    fontSize: type.statHero,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: space.sm,
  },
  subtitle: {
    fontSize: type.body,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 28,
  },

  cardWrap: {
    width: '100%',
    marginBottom: 28,
  },
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.xl,
  },
  cardBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.lg,
  },
  cardLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  cardBrand: {
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: track.caps,
  },
  cardDate: {
    color: 'rgba(255,255,255,0.4)',
  },
  cardTitle: {
    fontSize: type.header,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: track.display,
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.55)',
    marginTop: space.xs,
    marginBottom: space.lg,
  },
  cardSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
    marginBottom: space.md,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: track.caps,
    marginBottom: space.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
  },
  cardRowName: {
    color: '#fff',
    flexShrink: 1,
  },
  cardRowValue: {
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  prValueCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  prValue: {
    fontSize: type.emphasis,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  prUnit: {
    color: 'rgba(255,255,255,0.5)',
  },
  improvementText: {
    color: trend.up,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
  },
  cardFooterText: {
    color: 'rgba(255,255,255,0.7)',
  },

  progressSection: {
    width: '100%',
    marginBottom: 28,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: track.caps,
  },
  progressValue: {
    color: 'rgba(255,255,255,0.75)',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressCaption: {
    color: 'rgba(255,255,255,0.45)',
    marginTop: space.sm,
    textAlign: 'right',
  },
  progressCaptionStrong: {
    color: 'rgba(255,255,255,0.75)',
  },

  rewardsSection: {
    width: '100%',
    marginBottom: 28,
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
  buttonContainer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.section,
    paddingTop: space.lg,
  },
  shareButton: {
    flex: 1,
  },
  shareButtonText: {
    color: '#fff',
  },
  doneButton: {
    flex: 2,
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
