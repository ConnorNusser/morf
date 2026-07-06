import { Text } from '@/components/Themed';
import StrengthHistoryModal from '@/components/StrengthHistoryModal';
import { useTheme } from '@/contexts/ThemeContext';
import { ExerciseWithMax, Gender, WeightUnit } from '@/types';
import {
  buildLiftSeries,
  buildStrengthIndexSeries,
  IndexTimeframe,
  MIN_SESSIONS,
  N,
  nearestLift,
} from '@/components/history/liftSeries';
import { computeActivityStatus } from '@/lib/history/activityStatus';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PAGE_PADDING = 20;
const CARD_PADDING = 18;
const CHART_H = 116;
const TOP = 8;
const USABLE_H = CHART_H - TOP * 2;
const MORPH_MS = 820;
const SWIPE_THRESHOLD = 40; // px of horizontal travel to flip to the next lift

const UP = '#34C759';
const DOWN = '#FF3B30';

const TIMEFRAMES: { key: IndexTimeframe; label: string }[] = [
  { key: '6W', label: '6W' },
  { key: '3M', label: '3M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

// How the period delta reads next to the score ("+18 this 3M" / "+9 all-time").
const TF_DELTA_LABEL: Record<IndexTimeframe, string> = {
  '6W': '6W',
  '3M': '3M',
  '1Y': '1Y',
  ALL: 'all-time',
};

function fmtMonth(d: Date) {
  const date = new Date(d);
  return `${date.toLocaleDateString(undefined, { month: 'short' })} '${String(date.getFullYear()).slice(-2)}`;
}

// Ordinal suffix for a percentile rank (1st, 2nd, 3rd, 45th) so the headline reads as
// a rank, not a raw percent — keeping the value and its delta on one shared scale.
function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Plain-language training level for the same percentile — replaces the gamified
// letter-grade tier chip. Descriptive, not a graded badge, and rendered in muted text.
function strengthLevel(p: number) {
  if (p >= 85) return 'Elite';
  if (p >= 50) return 'Advanced';
  if (p >= 25) return 'Intermediate';
  if (p >= 10) return 'Novice';
  return 'Beginner';
}

interface HistoryHeroProps {
  exerciseStats: ExerciseWithMax[];
  weightUnit: WeightUnit;
  // Percentiles are ratio-based, so the aggregate index needs bodyweight + gender.
  // When absent (profile not filled), the hero falls back to the per-lift PR carousel.
  bodyweightLbs?: number;
  gender?: Gender;
  age?: number;
}

// Build the smooth path by lerping from→to point arrays on the UI thread, so the
// curve actually morphs between series instead of cross-fading.
function morphPath(from: number[], to: number[], prog: number, x0: number, dx: number, close: boolean) {
  'worklet';
  if (!from || !to || from.length < N || to.length < N) return '';
  const y = (i: number) => {
    const v = from[i] + (to[i] - from[i]) * prog;
    return TOP + (1 - v) * USABLE_H;
  };
  let d = `M ${x0} ${y(0)}`;
  for (let i = 1; i < N; i++) {
    const px = x0 + (i - 1) * dx;
    const cx = px + dx / 2;
    d += ` C ${cx} ${y(i - 1)}, ${cx} ${y(i)}, ${x0 + i * dx} ${y(i)}`;
  }
  if (close) d += ` L ${x0 + (N - 1) * dx} ${TOP + USABLE_H} L ${x0} ${TOP + USABLE_H} Z`;
  return d;
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function HistoryHero({ exerciseStats, weightUnit, bodyweightLbs, gender, age }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const router = useRouter();

  const [timeframe, setTimeframe] = useState<IndexTimeframe>('3M');

  // The hero owns the single Q1 answer, so its full percentile-over-time drill-in (the old
  // standalone "Strength Over Time" card) now lives one tap behind the hero itself.
  const [showStrengthModal, setShowStrengthModal] = useState(false);

  // PRIMARY: the portfolio-level "am I stronger overall?" answer — a normalized 0–99
  // strength percentile (bounded, comparative, able to fall), not a summed-lbs vanity total.
  const index = useMemo(
    () =>
      bodyweightLbs && gender
        ? buildStrengthIndexSeries(exerciseStats, bodyweightLbs, gender, timeframe, age)
        : null,
    [exerciseStats, bodyweightLbs, gender, timeframe, age]
  );
  const indexMode = !!index?.hasData;

  // Per-lift PR curves — the swipeable fallback carousel used when the aggregate index
  // can't be built. In index mode the per-lift Q2 detail lives one tap away on the
  // Exercises tab (est-1RM + green delta + sparkline), so the hero stays a single focal
  // answer instead of re-rendering a competing per-lift strip the other tab already owns.
  const lifts = useMemo(() => buildLiftSeries(exerciseStats, weightUnit), [exerciseStats, weightUnit]);

  // When nothing qualifies yet, surface the lift closest to the 3-session gate so the
  // empty state is a concrete goal instead of a generic nudge.
  const nearest = useMemo(() => (lifts.length ? null : nearestLift(exerciseStats)), [lifts.length, exerciseStats]);

  // Freshness signal: a lapsed veteran (trained, then went quiet) gets "welcome back"
  // instead of a beginner nudge.
  const activity = useMemo(() => computeActivityStatus(exerciseStats, new Date()), [exerciseStats]);

  const chartW = Dimensions.get('window').width - PAGE_PADDING * 2 - CARD_PADDING * 2;
  const X0 = 2;
  const DX = (chartW - X0 * 2) / (N - 1);

  const fromPoints = useSharedValue<number[]>(new Array(N).fill(0));
  const toPoints = useSharedValue<number[]>(new Array(N).fill(0));
  const progress = useSharedValue(0);
  const prevPoints = useRef<number[] | null>(null);

  const [liftIndex, setLiftIndex] = useState(0);

  // keep the lift index in range if the list shrinks
  useEffect(() => {
    setLiftIndex(i => Math.min(i, Math.max(0, lifts.length - 1)));
  }, [lifts.length]);

  const step = useCallback(
    (dir: number) => setLiftIndex(i => Math.min(lifts.length - 1, Math.max(0, i + dir))),
    [lifts.length]
  );

  // swipe left/right to move through lifts (fallback carousel only)
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-16, 16])
        .onEnd(e => {
          if (e.translationX <= -SWIPE_THRESHOLD) runOnJS(step)(1);
          else if (e.translationX >= SWIPE_THRESHOLD) runOnJS(step)(-1);
        }),
    [step]
  );

  const activeLift = lifts[Math.min(liftIndex, Math.max(0, lifts.length - 1))];

  // The curve currently on screen: the aggregate index, or (fallback) the active lift.
  const heroNorm = indexMode ? index!.norm : activeLift?.norm;

  // morph to whatever series is active whenever it (or the timeframe / lift) changes
  useEffect(() => {
    if (!heroNorm) return;
    fromPoints.value = prevPoints.current ?? new Array(N).fill(0); // first reveal draws up from the floor
    toPoints.value = heroNorm;
    progress.value = 0;
    progress.value = withTiming(1, { duration: MORPH_MS, easing: Easing.inOut(Easing.cubic) });
    prevPoints.current = heroNorm;
  }, [heroNorm, fromPoints, toPoints, progress]);

  const lineProps = useAnimatedProps(() => ({ d: morphPath(fromPoints.value, toPoints.value, progress.value, X0, DX, false) }));
  const areaProps = useAnimatedProps(() => ({ d: morphPath(fromPoints.value, toPoints.value, progress.value, X0, DX, true) }));

  const deltaColor = index && index.delta >= 0 ? UP : DOWN;

  // Start-vs-now anchors for the index curve: a faint "was" dot at the left with the
  // starting score, and a solid "now" dot at the right. This gives the eye the
  // magnitude of personal progress (how much stronger) directly on the trend line,
  // not just its direction. Only drawn in index mode.
  const marker = useMemo(() => {
    if (!indexMode || !index) return null;
    const startY = TOP + (1 - index.norm[0]) * USABLE_H;
    const endY = TOP + (1 - index.norm[N - 1]) * USABLE_H;
    return {
      startX: X0,
      startY,
      endX: X0 + (N - 1) * DX,
      endY,
      startValue: index.previous,
      labelY: startY < 22 ? startY + 15 : startY - 7,
    };
  }, [indexMode, index, DX]);

  const renderChart = (mk: typeof marker) => (
    <RNView style={{ height: CHART_H }}>
      <Svg width={chartW} height={CHART_H}>
        <Defs>
          <SvgGradient id="hLine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.primary} />
          </SvgGradient>
          <SvgGradient id="hArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.26} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <AnimatedPath animatedProps={areaProps} fill="url(#hArea)" />
        <AnimatedPath
          animatedProps={lineProps}
          stroke="url(#hLine)"
          strokeWidth={2.75}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line
          x1={X0}
          y1={TOP + USABLE_H}
          x2={X0 + (N - 1) * DX}
          y2={TOP + USABLE_H}
          stroke={colors.text + '1A'}
          strokeWidth={1}
        />
        {mk && (
          <>
            <SvgText
              x={mk.startX + 7}
              y={mk.labelY}
              fontSize={10.5}
              fill={colors.text + '80'}
              fontWeight="600"
            >
              {mk.startValue}
            </SvgText>
            <Circle cx={mk.startX} cy={mk.startY} r={3.5} fill={colors.surface} stroke={colors.text + '66'} strokeWidth={1.5} />
            <Circle cx={mk.endX} cy={mk.endY} r={4.5} fill={colors.primary} stroke={colors.surface} strokeWidth={1.5} />
          </>
        )}
      </Svg>
    </RNView>
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={[
        styles.card,
        { borderRadius: currentTheme.borderRadius, backgroundColor: colors.surface, borderColor: colors.border, shadowColor: '#000' },
      ]}
    >
      {indexMode && index ? (
        // ── PRIMARY: aggregate Strength Index ──────────────────────────────────
        <RNView>
          <TouchableOpacity
            style={styles.headerTop}
            activeOpacity={0.7}
            onPress={() => setShowStrengthModal(true)}
          >
            <RNView style={styles.kickerRow}>
              <Text style={[styles.kicker, { color: colors.text + '99', fontWeight: '600' }]}>Strength Index</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.text + '55'} />
            </RNView>
          </TouchableOpacity>

          {/* Hierarchy inverted for Q1 ("am I stronger than my past self?"). The focal
              numeral is now a self-referential 0–100 strength score (the same normalized
              bodyweight-standards value, framed as a personal score, not a population
              rank), and directly under it the green/red period delta gives the magnitude
              of personal progress as the first thing read. The population framing
              ("Advanced · 45th percentile among lifters") drops to a demoted context
              line below, present but no longer the headline. */}
          <RNView style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: colors.text, fontWeight: '700' }]}>
              {index.current}
              <Text style={[styles.scoreUnit, { color: colors.text + '55', fontWeight: '500' }]}> /100</Text>
            </Text>
          </RNView>

          <RNView style={styles.deltaRow}>
            <Ionicons name={index.delta >= 0 ? 'arrow-up' : 'arrow-down'} size={16} color={deltaColor} />
            <Text style={[styles.deltaBig, { color: deltaColor, fontWeight: '700' }]}>
              {index.delta >= 0 ? '+' : '-'}
              {Math.abs(index.delta)} this {TF_DELTA_LABEL[timeframe]}
            </Text>
          </RNView>

          <Text style={[styles.contextLine, { color: colors.text + '70', fontWeight: '500' }]}>
            {strengthLevel(index.current)} · {index.current}
            {ordinal(index.current)} percentile among lifters
          </Text>

          {renderChart(marker)}

          {/* timeline x-axis */}
          <RNView style={[styles.axisRow, { width: chartW }]}>
            <Text style={[styles.axisLabel, { color: colors.text + '70', fontWeight: '500' }]}>
              {fmtMonth(index.startDate)}
            </Text>
            <Text style={[styles.axisLabel, { color: colors.text + '70', fontWeight: '500' }]}>
              {fmtMonth(index.endDate)}
            </Text>
          </RNView>

          {/* timeframe toggle — Robinhood-style, drives the curve */}
          <RNView style={styles.tfRow}>
            {TIMEFRAMES.map(tf => {
              const on = tf.key === timeframe;
              return (
                <TouchableOpacity
                  key={tf.key}
                  onPress={() => setTimeframe(tf.key)}
                  activeOpacity={0.7}
                  style={[styles.tfBtn, on && { backgroundColor: colors.primary }]}
                >
                  <Text
                    style={[
                      styles.tfBtnText,
                      { color: on ? '#fff' : colors.text + '80', fontWeight: on ? '600' : '500' },
                    ]}
                  >
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </RNView>

          <Animated.View key={`cap-${timeframe}`} entering={FadeIn.delay(120).duration(360)}>
            <Text style={[styles.caption, { color: colors.text + '70', fontWeight: '500' }]}>
              Across {index.liftCount} lift{index.liftCount !== 1 ? 's' : ''} vs bodyweight standards for your weight
            </Text>
          </Animated.View>
        </RNView>
      ) : activeLift ? (
        // ── FALLBACK: per-lift PR carousel (no bodyweight/gender for the index) ─
        <GestureDetector gesture={swipe}>
          <RNView>
            <RNView style={styles.headerTop}>
              <Text style={[styles.kicker, { color: colors.text + '99', fontWeight: '600' }]}>PR progression</Text>
              {lifts.length > 1 && (
                <RNView style={styles.dots}>
                  {lifts.map((_, i) => (
                    <RNView key={i} style={[styles.dot, { backgroundColor: i === liftIndex ? colors.primary : colors.text + '26' }]} />
                  ))}
                </RNView>
              )}
            </RNView>

            <RNView style={styles.titleRow}>
              <Animated.View key={activeLift.name} entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(200)} style={styles.titleSwap}>
                <RNView style={styles.titleLeft}>
                  <Text numberOfLines={1} style={[styles.liftName, { color: colors.text, fontWeight: '700' }]}>
                    {activeLift.name}
                  </Text>
                  {activeLift.gainLbs > 0 ? (
                    <Text style={[styles.gain, { color: colors.text + '99', fontWeight: '600' }]}>
                      +{activeLift.gainLbs} {weightUnit} all-time
                    </Text>
                  ) : null}
                </RNView>
                <Text style={[styles.value, { color: colors.text, fontWeight: '700' }]}>
                  {activeLift.current}
                  <Text style={[styles.valueUnit, { color: colors.text + '70', fontWeight: '500' }]}> {weightUnit}</Text>
                </Text>
              </Animated.View>
            </RNView>

            {renderChart(null)}

            <RNView style={[styles.axisRow, { width: chartW }]}>
              <Text style={[styles.axisLabel, { color: colors.text + '70', fontWeight: '500' }]}>
                {fmtMonth(activeLift.startDate)}
              </Text>
              <Text style={[styles.axisLabel, { color: colors.text + '70', fontWeight: '500' }]}>
                {fmtMonth(activeLift.endDate)}
              </Text>
            </RNView>

            <Animated.View key={`cap-${activeLift.name}`} entering={FadeIn.delay(150).duration(360)}>
              <Text style={[styles.caption, { color: colors.text + '70', fontWeight: '500' }]}>
                {activeLift.sessions} sessions logged · estimated 1RM{lifts.length > 1 ? ' · swipe to compare lifts' : ''}
              </Text>
            </Animated.View>
          </RNView>
        </GestureDetector>
      ) : activity.isLapsed && activity.daysSinceLastWorkout !== null ? (
        <RNView style={styles.empty}>
          <Text style={[styles.comebackTitle, { color: colors.text, fontWeight: '700' }]}>Welcome back</Text>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontWeight: '500' }]}>
            Last trained {activity.daysSinceLastWorkout} day{activity.daysSinceLastWorkout !== 1 ? 's' : ''} ago ·
            pick up where you left off.
          </Text>
          <TouchableOpacity
            style={[styles.comebackCta, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/workout')}
            activeOpacity={0.85}
          >
            <Ionicons name="barbell" size={16} color="#fff" />
            <Text style={[styles.comebackCtaText, { fontWeight: '600' }]}>Start a workout</Text>
          </TouchableOpacity>
        </RNView>
      ) : nearest ? (
        <RNView style={styles.empty}>
          <RNView style={styles.pips}>
            {Array.from({ length: MIN_SESSIONS }).map((_, i) => (
              <RNView
                key={i}
                style={[styles.pip, { backgroundColor: i < nearest.sessions ? colors.primary : colors.text + '1F' }]}
              />
            ))}
          </RNView>
          <Text style={[styles.emptyLift, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
            {nearest.name}
          </Text>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontWeight: '500' }]}>
            {nearest.sessions} of {MIN_SESSIONS} sessions logged · {MIN_SESSIONS - nearest.sessions} more to unlock its
            PR progression.
          </Text>
        </RNView>
      ) : (
        <RNView style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontWeight: '500' }]}>
            Log a lift a few times and your Strength Index will animate here.
          </Text>
        </RNView>
      )}

      {/* Full percentile-over-time detail — the hero's own drill-in, replacing the removed
          duplicate "Strength Over Time" card so Q1's detail keeps a home under one owner. */}
      <StrengthHistoryModal visible={showStrengthModal} onClose={() => setShowStrengthModal(false)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: CARD_PADDING,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  kicker: { fontSize: 13, letterSpacing: 0.2 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  titleRow: { height: 42, justifyContent: 'center' },
  titleSwap: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLeft: { flex: 1, marginRight: 12 },
  liftName: { fontSize: 20, letterSpacing: -0.4 },
  gain: { fontSize: 12, letterSpacing: 0.1, marginTop: 1 },
  value: { fontSize: 34, letterSpacing: -0.8 },
  valueUnit: { fontSize: 13, letterSpacing: 0 },
  // Index-mode focal score: the biggest, first-read numeral on the screen.
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  scoreValue: { fontSize: 46, letterSpacing: -1.2, lineHeight: 50 },
  scoreUnit: { fontSize: 16, letterSpacing: 0 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  deltaBig: { fontSize: 16, letterSpacing: 0.1 },
  contextLine: { fontSize: 12, letterSpacing: 0.2, marginTop: 8 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontSize: 11, letterSpacing: 0.2 },
  tfRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  tfBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  tfBtnText: { fontSize: 12.5, letterSpacing: 0.2 },
  caption: { fontSize: 11.5, letterSpacing: 0.2, marginTop: 10 },
  empty: { paddingVertical: 22, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
  emptyLift: { fontSize: 16, letterSpacing: -0.2, marginBottom: 3 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pip: { width: 22, height: 5, borderRadius: 2.5 },
  comebackTitle: { fontSize: 20, letterSpacing: -0.4, marginBottom: 6 },
  comebackCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    marginTop: 16,
  },
  comebackCtaText: { color: '#fff', fontSize: 15 },
});
