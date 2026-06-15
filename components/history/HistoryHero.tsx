import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { convertWeight, ExerciseWithMax, WeightUnit } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View as RNView } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PAGE_PADDING = 20;
const CARD_PADDING = 18;
const N = 14; // samples per lift (fixed so curves can morph into each other)
const CHART_H = 116;
const TOP = 8;
const USABLE_H = CHART_H - TOP * 2;
const CYCLE_MS = 3400;
const MORPH_MS = 820;
const MIN_SESSIONS = 3; // need a few points to draw a progression

interface LiftSeries {
  name: string;
  norm: number[]; // N values 0..1, the lift's cumulative-best curve scaled to itself
  current: number; // latest best e1RM, display unit
  gainPct: number; // all-time gain across the logged window
  sessions: number;
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

// ── data ───────────────────────────────────────────────────────────────────

function useLiftSeries(exerciseStats: ExerciseWithMax[], weightUnit: WeightUnit): LiftSeries[] {
  return useMemo(() => {
    const e1rmLbs = (e: { weight: number; reps: number; unit: WeightUnit }) =>
      OneRMCalculator.estimate(e.unit === 'kg' ? convertWeight(e.weight, 'kg', 'lbs') : e.weight, e.reps);
    const toUnit = (lbs: number) => (weightUnit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs);

    const out: LiftSeries[] = [];
    for (const ex of exerciseStats) {
      if (!ex.history || ex.history.length < MIN_SESSIONS) continue;
      const sorted = [...ex.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      // cumulative best (PR curve) in lbs
      const cum: number[] = [];
      let best = 0;
      for (const h of sorted) {
        best = Math.max(best, e1rmLbs(h));
        cum.push(best);
      }
      const L = cum.length;
      // resample to N evenly-spaced points
      const pts: number[] = [];
      for (let k = 0; k < N; k++) {
        const pos = (k / (N - 1)) * (L - 1);
        const lo = Math.floor(pos);
        const hi = Math.ceil(pos);
        pts.push(cum[lo] + (cum[hi] - cum[lo]) * (pos - lo));
      }
      const min = Math.min(...pts);
      const max = Math.max(...pts);
      const norm = pts.map(v => (max > min ? (v - min) / (max - min) : 0.5));
      const current = Math.round(toUnit(cum[L - 1]));
      const first = cum[0];
      const gainPct = first > 0 ? Math.round(((cum[L - 1] - first) / first) * 100) : 0;
      out.push({ name: ex.name, norm, current, gainPct, sessions: L });
    }
    // most-logged lifts first, capped
    return out.sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  }, [exerciseStats, weightUnit]);
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function HistoryHero({ exerciseStats, weightUnit }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;

  const lifts = useLiftSeries(exerciseStats, weightUnit);

  const chartW = Dimensions.get('window').width - PAGE_PADDING * 2 - CARD_PADDING * 2;
  const X0 = 2;
  const DX = (chartW - X0 * 2) / (N - 1);

  const fromPoints = useSharedValue<number[]>(new Array(N).fill(0));
  const toPoints = useSharedValue<number[]>(new Array(N).fill(0));
  const progress = useSharedValue(0);
  const prevPoints = useRef<number[] | null>(null);

  const [index, setIndex] = useState(0);

  // auto-cycle lift → lift
  useEffect(() => {
    if (lifts.length < 2) return;
    const id = setInterval(() => setIndex(i => (i + 1) % lifts.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [lifts.length]);

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
        <>
          {/* swapping lift label + value */}
          <RNView style={styles.titleRow}>
            <Animated.View key={active.name} entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(200)} style={styles.titleSwap}>
              <RNView style={styles.titleLeft}>
                <Text numberOfLines={1} style={[styles.liftName, { color: colors.text, fontFamily: fonts.bold }]}>
                  {active.name}
                </Text>
                {active.gainPct > 0 && (
                  <Text style={[styles.gain, { color: '#34C759', fontFamily: fonts.semiBold }]}>+{active.gainPct}% all-time</Text>
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
            </Svg>
          </RNView>

          <Animated.View key={`cap-${active.name}`} entering={FadeIn.delay(150).duration(360)}>
            <Text style={[styles.caption, { color: colors.text + '70', fontFamily: fonts.medium }]}>
              {active.sessions} sessions logged · estimated 1RM
            </Text>
          </Animated.View>
        </>
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
  caption: { fontSize: 11.5, letterSpacing: 0.2, marginTop: 8 },
  empty: { paddingVertical: 22, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
