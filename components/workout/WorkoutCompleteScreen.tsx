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
import {
  convertWeightForPreference,
  convertWeightToLbs,
  getPercentileSuffix,
} from '@/lib/utils/utils';
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
  View as RNView,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
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

const EMBER_GOLD = require('@/assets/images/celebration/ember-gold.png');
const EMBER_BLUE = require('@/assets/images/celebration/ember-blue.png');
const CARD_BACKDROP = require('@/assets/images/celebration/card-backdrop.jpg');

// A glowing ember that rises from the bottom of the screen, drifts, and fades —
// the confetti replacement, built from generated glow sprites (real alpha).
const Ember = ({ delay, startX, size, sprite }: { delay: number; startX: number; size: number; sprite: number }) => {
  const translateY = useSharedValue(SCREEN_HEIGHT * (0.7 + Math.random() * 0.3));
  const translateX = useSharedValue(startX);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    const duration = 3200 + Math.random() * 1200;
    // One sequence per value — a second assignment would replace the first
    // animation before it ever runs.
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(0.9, { duration: 500 }),
        withDelay(duration - 1700, withTiming(0, { duration: 1200 })),
      ),
    );
    scale.value = withDelay(delay, withSpring(1, { damping: 10 }));
    translateY.value = withDelay(
      delay,
      withTiming(-size, { duration, easing: Easing.out(Easing.quad) })
    );
    const drift = (Math.random() - 0.5) * 140;
    translateX.value = withDelay(
      delay,
      withTiming(startX + drift, { duration, easing: Easing.inOut(Easing.sin) })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Animation runs once on mount
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Image
      source={sprite}
      style={[styles.ember, { width: size, height: size }, animatedStyle]}
    />
  );
};

// One soft bloom behind the header on arrival — swells in, then settles low.
const BurstGlow = () => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withSequence(
      withTiming(0.55, { duration: 700 }),
      withDelay(1100, withTiming(0.3, { duration: 1500 })),
    );
    scale.value = withSpring(1, { damping: 12, stiffness: 60 });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Animation runs once on mount
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.Image source={EMBER_GOLD} style={[styles.burst, style]} />
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
        <View style={styles.progressValueRow}>
          {delta > 0 && (
            <Text variant="meta" weight="bold" style={{ color: trend.up }}>
              +{delta}
            </Text>
          )}
          <AnimatedCounter value={move.after} delay={500} duration={1100} style={styles.progressNum} />
          <Text variant="meta" style={styles.progressValue}>
            percentile
          </Text>
        </View>
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
  // card = framed poster on the generated backdrop; sticker = transparent
  // stats-only PNG to overlay on your own photo (IG-story style).
  const [shareMode, setShareMode] = useState<'card' | 'sticker'>('card');
  // Which card layout is showing — tap the card to flip to the next one.
  const [cardIndex, setCardIndex] = useState(0);
  const cardRotY = useSharedValue(0);
  const shareRef = useRef<ViewShot>(null);

  // Rising embers, gold-heavy with a few theme-blue sparks mixed in.
  const embers = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        delay: Math.random() * 900,
        startX: Math.random() * SCREEN_WIDTH,
        size: 16 + Math.random() * 26,
        sprite: i % 3 === 2 ? EMBER_BLUE : EMBER_GOLD,
      })),
    [],
  );

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

  // The single-lift brag: the highest-percentile featured lift trained this
  // session ("stronger than 85% of Bench Press lifters") — the share moment.
  const liftSpotlight = useMemo(() => {
    let best: {
      name: string;
      percentile: number;
      e1rm: number;
      weight: number;
      reps: number;
    } | null = null;
    for (const exercise of exercises) {
      if (!exercise.matchedExerciseId) continue;
      const lift = userLifts.find((l) => l.workoutId === exercise.matchedExerciseId);
      if (!lift || lift.percentileRanking <= 0) continue;
      let top: { e1rm: number; weight: number; reps: number } | null = null;
      for (const set of exercise.sets || []) {
        if ((set.weight || 0) <= 0 || (set.reps || 0) <= 0) continue;
        const e1rm = OneRMCalculator.estimate(set.weight, set.reps);
        if (!top || e1rm > top.e1rm) top = { e1rm, weight: set.weight, reps: set.reps };
      }
      if (!top) continue;
      if (!best || lift.percentileRanking > best.percentile) {
        const info = getWorkoutById(exercise.matchedExerciseId);
        best = {
          name: shortName(info?.name || exercise.name),
          percentile: lift.percentileRanking,
          e1rm: Math.round(top.e1rm),
          weight: Math.round(top.weight),
          reps: top.reps,
        };
      }
    }
    return best;
  }, [exercises, userLifts]);

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

  const overallTier = overallAfter > 0 ? getStrengthTier(overallAfter) : null;

  // Card layouts on offer — tap the card to flip through them.
  const cardVariants = useMemo(() => {
    const v: ('overall' | 'lift' | 'prs')[] = ['overall'];
    if (liftSpotlight) v.push('lift');
    if (prs.length > 0) v.push('prs');
    return v;
  }, [liftSpotlight, prs]);
  const activeVariant = cardVariants[Math.min(cardIndex, cardVariants.length - 1)];

  const flipCard = () => {
    if (cardVariants.length < 2) return;
    playHapticFeedback('light', false);
    const next = (cardIndex + 1) % cardVariants.length;
    cardRotY.value = withTiming(
      90,
      { duration: 150, easing: Easing.in(Easing.quad) },
      (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setCardIndex)(next);
          cardRotY.value = -90;
          cardRotY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) });
        }
      },
    );
  };
  const flipStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${cardRotY.value}deg` }],
  }));

  // The session line every layout carries, so each capture stays branded/context-ful.
  const sessionLine = (
    <Text variant="meta" style={styles.cardHeroMeta} numberOfLines={1}>
      {cardTitleFor(title)} · {stats.durationStr} · {stats.sets}{' '}
      {stats.sets === 1 ? 'set' : 'sets'}
      {volumeDisplay ? ` · ${volumeDisplay}` : ''}
    </Text>
  );

  // Middle of the card, by layout: overall standing / single-lift brag / PR haul.
  const cardBody =
    activeVariant === 'lift' && liftSpotlight ? (
      <View style={styles.cardHero}>
        <Text variant="meta" weight="bold" style={styles.cardLabel}>
          {liftSpotlight.name.toUpperCase()}
        </Text>
        <Text
          style={[
            styles.cardHeroTier,
            { color: getTierColor(getStrengthTier(liftSpotlight.percentile)) },
          ]}
        >
          {liftSpotlight.percentile}
          {getPercentileSuffix(liftSpotlight.percentile)}
        </Text>
        <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
          Stronger than {liftSpotlight.percentile}% of {liftSpotlight.name} lifters
        </Text>
        <Text variant="meta" style={styles.cardHeroMeta}>
          {liftSpotlight.e1rm} {weightUnit} e1RM · best set {liftSpotlight.weight} ×{' '}
          {liftSpotlight.reps}
        </Text>
        {sessionLine}
      </View>
    ) : activeVariant === 'prs' ? (
      <>
        <View style={styles.cardHero}>
          <Text style={[styles.cardHeroTier, styles.cardHeroGold]}>
            {prs.length} {prs.length === 1 ? 'PR' : 'PRs'}
          </Text>
          <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
            New personal {prs.length === 1 ? 'record' : 'records'} today
          </Text>
          {sessionLine}
        </View>
        <View style={[styles.cardSection, { borderTopColor: CARD_HAIRLINE }]}>
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
      </>
    ) : (
      <>
        <View style={styles.cardHero}>
          {overallTier ? (
            <>
              <Text style={[styles.cardHeroTier, { color: getTierColor(overallTier) }]}>
                {overallTier}
              </Text>
              <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
                Stronger than {overallAfter}% of lifters
              </Text>
            </>
          ) : (
            volumeDisplay && (
              <>
                <Text style={styles.cardHeroVolume}>{volumeDisplay}</Text>
                <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
                  lifted today
                </Text>
              </>
            )
          )}
          {sessionLine}
        </View>

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
      </>
    );

  const cardContent = (
    <View style={styles.cardInner}>
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

      {cardBody}

      <View style={[styles.cardTagline, { borderTopColor: CARD_HAIRLINE }]}>
        <Text variant="meta" style={styles.cardTaglineText}>
          morf · AI strength training
        </Text>
      </View>
    </View>
  );

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      <BurstGlow />

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
            <TouchableOpacity activeOpacity={0.92} onPress={flipCard} disabled={cardVariants.length < 2}>
              <Animated.View style={flipStyle}>
                <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
                  {/* One stable wrapper — swapping wrapper types would remount the
                      content and restart the PR counters on every mode toggle. */}
                  <RNView style={[styles.card, shareMode === 'sticker' && styles.cardSticker]}>
                    {shareMode === 'card' && (
                      <Image source={CARD_BACKDROP} style={styles.cardBgAbs} resizeMode="cover" />
                    )}
                    {cardContent}
                  </RNView>
                </ViewShot>
              </Animated.View>
            </TouchableOpacity>

            {cardVariants.length > 1 && (
              <RNView style={styles.dotsRow}>
                {cardVariants.map((v, i) => (
                  <RNView
                    key={v}
                    style={[
                      styles.dot,
                      i === Math.min(cardIndex, cardVariants.length - 1) && styles.dotActive,
                    ]}
                  />
                ))}
                <Text variant="meta" style={styles.dotsHint}>
                  tap card for more layouts
                </Text>
              </RNView>
            )}
          </Animated.View>

          {/* Card = the framed poster; Sticker = transparent stats to overlay on
              your own gym photo in an IG story (the Hevy-style share). */}
          <Animated.View entering={FadeIn.delay(450)} style={styles.modeRow}>
            {(['card', 'sticker'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  playHapticFeedback('selection', false);
                  setShareMode(m);
                }}
                style={[styles.modeChip, shareMode === m && styles.modeChipActive]}
              >
                <Text
                  variant="meta"
                  weight="semiBold"
                  style={{ color: shareMode === m ? '#fff' : 'rgba(255,255,255,0.45)' }}
                >
                  {m === 'card' ? 'Card' : 'Sticker'}
                </Text>
              </TouchableOpacity>
            ))}
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

      {/* Above the content so the rise is visible; pointerEvents none in style
          keeps them from swallowing taps while they float. */}
      {embers.map((e) => (
        <Ember key={e.id} delay={e.delay} startX={e.startX} size={e.size} sprite={e.sprite} />
      ))}

      <Animated.View
        entering={FadeIn.delay(700)}
        style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
      >
        {/* White labels + fixed dark surface: this screen is always dark
            regardless of theme (named palette exception). Share is the hero
            action — it's why this screen exists. */}
        <Button
          title="Done"
          onPress={onDone}
          variant="secondary"
          size="large"
          style={styles.doneButton}
          textStyle={styles.doneButtonText}
        />
        <Button
          title="Share"
          icon="share-outline"
          onPress={handleShare}
          variant="primary"
          size="large"
          style={styles.shareButton}
          textStyle={styles.shareButtonText}
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
    marginBottom: space.md,
  },
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cardBgAbs: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  cardSticker: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  cardInner: {
    padding: space.xl,
  },
  cardHero: {
    alignItems: 'center',
    paddingVertical: space.lg,
  },
  // The tier letter is the app's display glyph (Career hero uses 72) — sized
  // for the card, same named type-scale exception.
  cardHeroTier: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 62,
  },
  cardHeroVolume: {
    fontSize: type.header,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: track.display,
  },
  cardHeroLine: {
    color: '#fff',
    marginTop: space.xs,
  },
  cardHeroMeta: {
    color: 'rgba(255,255,255,0.55)',
    marginTop: space.sm,
  },
  cardTagline: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
    alignItems: 'center',
  },
  cardTaglineText: {
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: track.caps,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
    marginBottom: 28,
  },
  modeChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modeChipActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.4)',
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
    color: 'rgba(255,255,255,0.55)',
  },
  progressValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  progressNum: {
    fontSize: type.emphasis,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
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
    flex: 1.5,
  },
  shareButtonText: {
    color: '#fff',
  },
  doneButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  doneButtonText: {
    color: '#fff',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dotsHint: {
    color: 'rgba(255,255,255,0.35)',
    marginLeft: space.xs,
  },
  cardHeroGold: {
    color: '#FFD700',
  },
  ember: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
  // Soft bloom behind the header; sized off the screen so it reads as light, not a sprite.
  burst: {
    position: 'absolute',
    top: -SCREEN_WIDTH * 0.35,
    alignSelf: 'center',
    width: SCREEN_WIDTH * 1.3,
    height: SCREEN_WIDTH * 1.3,
    pointerEvents: 'none',
  },
});
