import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ExerciseWithMax, WeightUnit } from '@/types';
import { buildLiftSeries, MIN_SESSIONS, N, nearestLift } from '@/components/history/liftSeries';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View as RNView } from 'react-native';
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
import Svg, { Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PAGE_PADDING = 20;
const CARD_PADDING = 18;
const CHART_H = 116;
const TOP = 8;
const USABLE_H = CHART_H - TOP * 2;
const MORPH_MS = 820;
const SWIPE_THRESHOLD = 40; // px of horizontal travel to flip to the next lift

function fmtMonth(d: Date) {
  const date = new Date(d);
  return `${date.toLocaleDateString(undefined, { month: 'short' })} '${String(date.getFullYear()).slice(-2)}`;
}

interface HistoryHeroProps {
  exerciseStats: ExerciseWithMax[];
  weightUnit: WeightUnit;
}

// Build the smooth path by lerping from→to point arrays on the UI thread, so the
// curve actually morphs between lifts instead of cross-fading.
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

export default function HistoryHero({ exerciseStats, weightUnit }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;

  const lifts = useMemo(() => buildLiftSeries(exerciseStats, weightUnit), [exerciseStats, weightUnit]);
  // When nothing qualifies yet, surface the lift closest to the 3-session gate so the
  // empty state is a concrete goal instead of a generic nudge.
  const nearest = useMemo(() => (lifts.length ? null : nearestLift(exerciseStats)), [lifts.length, exerciseStats]);

  const chartW = Dimensions.get('window').width - PAGE_PADDING * 2 - CARD_PADDING * 2;
  const X0 = 2;
  const DX = (chartW - X0 * 2) / (N - 1);

  const fromPoints = useSharedValue<number[]>(new Array(N).fill(0));
  const toPoints = useSharedValue<number[]>(new Array(N).fill(0));
  const progress = useSharedValue(0);
  const prevPoints = useRef<number[] | null>(null);

  const [index, setIndex] = useState(0);

  // keep the index in range if the lift list shrinks
  useEffect(() => {
    setIndex(i => Math.min(i, Math.max(0, lifts.length - 1)));
  }, [lifts.length]);

  const step = useCallback(
    (dir: number) => setIndex(i => Math.min(lifts.length - 1, Math.max(0, i + dir))),
    [lifts.length]
  );

  // swipe left/right to move through lifts (replaces auto-cycling)
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

  // morph to the active lift whenever it (or the data) changes
  useEffect(() => {
    const target = lifts[index]?.norm;
    if (!target) return;
    fromPoints.value = prevPoints.current ?? new Array(N).fill(0); // first reveal draws up from the floor
    toPoints.value = target;
    progress.value = 0;
    progress.value = withTiming(1, { duration: MORPH_MS, easing: Easing.inOut(Easing.cubic) });
    prevPoints.current = target;
  }, [index, lifts, fromPoints, toPoints, progress]);

  const lineProps = useAnimatedProps(() => ({ d: morphPath(fromPoints.value, toPoints.value, progress.value, X0, DX, false) }));
  const areaProps = useAnimatedProps(() => ({ d: morphPath(fromPoints.value, toPoints.value, progress.value, X0, DX, true) }));

  const active = lifts[Math.min(index, lifts.length - 1)];

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={[
        styles.card,
        { borderRadius: currentTheme.borderRadius, backgroundColor: colors.surface, borderColor: colors.border, shadowColor: '#000' },
      ]}
    >
      <RNView style={styles.headerTop}>
        <Text style={[styles.kicker, { color: colors.text + '99', fontFamily: fonts.semiBold }]}>PR progression</Text>
        {lifts.length > 1 && (
          <RNView style={styles.dots}>
            {lifts.map((_, i) => (
              <RNView key={i} style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.text + '26' }]} />
            ))}
          </RNView>
        )}
      </RNView>

      {active ? (
        <GestureDetector gesture={swipe}>
          <RNView>
          {/* swapping lift label + value */}
          <RNView style={styles.titleRow}>
            <Animated.View key={active.name} entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(200)} style={styles.titleSwap}>
              <RNView style={styles.titleLeft}>
                <Text numberOfLines={1} style={[styles.liftName, { color: colors.text, fontFamily: fonts.bold }]}>
                  {active.name}
                </Text>
                {active.gainLbs > 0 && (
                  <Text style={[styles.gain, { color: colors.text + '99', fontFamily: fonts.semiBold }]}>
                    +{active.gainLbs} {weightUnit} all-time
                  </Text>
                )}
              </RNView>
              <Text style={[styles.value, { color: colors.text, fontFamily: fonts.bold }]}>
                {active.current}
                <Text style={[styles.valueUnit, { color: colors.text + '70', fontFamily: fonts.medium }]}> {weightUnit}</Text>
              </Text>
            </Animated.View>
          </RNView>

          {/* morphing PR curve */}
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
              {/* x-axis baseline */}
              <Line
                x1={X0}
                y1={TOP + USABLE_H}
                x2={X0 + (N - 1) * DX}
                y2={TOP + USABLE_H}
                stroke={colors.text + '1A'}
                strokeWidth={1}
              />
            </Svg>
          </RNView>

          {/* timeline x-axis */}
          <RNView style={[styles.axisRow, { width: chartW }]}>
            <Text style={[styles.axisLabel, { color: colors.text + '70', fontFamily: fonts.medium }]}>
              {fmtMonth(active.startDate)}
            </Text>
            <Text style={[styles.axisLabel, { color: colors.text + '70', fontFamily: fonts.medium }]}>
              {fmtMonth(active.endDate)}
            </Text>
          </RNView>

          <Animated.View key={`cap-${active.name}`} entering={FadeIn.delay(150).duration(360)}>
            <Text style={[styles.caption, { color: colors.text + '70', fontFamily: fonts.medium }]}>
              {active.sessions} sessions logged · estimated 1RM{lifts.length > 1 ? ' · swipe to compare lifts' : ''}
            </Text>
          </Animated.View>
          </RNView>
        </GestureDetector>
      ) : nearest ? (
        <RNView style={styles.empty}>
          {/* progress toward unlocking the curve — one filled pip per logged day */}
          <RNView style={styles.pips}>
            {Array.from({ length: MIN_SESSIONS }).map((_, i) => (
              <RNView
                key={i}
                style={[
                  styles.pip,
                  { backgroundColor: i < nearest.sessions ? colors.primary : colors.text + '1F' },
                ]}
              />
            ))}
          </RNView>
          <Text style={[styles.emptyLift, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
            {nearest.name}
          </Text>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontFamily: fonts.medium }]}>
            {nearest.sessions} of {MIN_SESSIONS} sessions logged · {MIN_SESSIONS - nearest.sessions} more to unlock its
            PR progression.
          </Text>
        </RNView>
      ) : (
        <RNView style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontFamily: fonts.medium }]}>
            Log a lift a few times and its PR progression will animate here.
          </Text>
        </RNView>
      )}
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
  value: { fontSize: 26, letterSpacing: -0.6 },
  valueUnit: { fontSize: 13, letterSpacing: 0 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { fontSize: 11, letterSpacing: 0.2 },
  caption: { fontSize: 11.5, letterSpacing: 0.2, marginTop: 8 },
  empty: { paddingVertical: 22, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
  emptyLift: { fontSize: 16, letterSpacing: -0.2, marginBottom: 3 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pip: { width: 22, height: 5, borderRadius: 2.5 },
});
