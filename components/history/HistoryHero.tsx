import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { convertWeight, ExerciseWithMax, WeightUnit } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View as RNView } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PAGE_PADDING = 20; // matches history.tsx scrollContent
const CARD_PADDING = 18;
const RECENT_DAYS = 28; // "last 4 weeks"
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MOVE_THRESHOLD = 1.5; // % change before a lift counts as climbing/slipping
const MAX_ROWS = 5;
const DELTA_CLAMP = 12; // % change that reaches the top/bottom of the chart

const CHART_H = 122;
const UP = '#34C759';
const DOWN = '#FF3B30';

type Trend = 'climbing' | 'holding' | 'slipping';

interface PulseLift {
  name: string;
  trend: Trend;
  deltaPct: number;
  recentSessions: number;
}

interface HistoryHeroProps {
  /** Per-exercise rollups (history + estimated 1RM), from the parent. */
  exerciseStats: ExerciseWithMax[];
  weightUnit: WeightUnit;
}

// ── data ───────────────────────────────────────────────────────────────────

function useProgressPulse(exerciseStats: ExerciseWithMax[]) {
  return useMemo(() => {
    const cutoff = Date.now() - RECENT_DAYS * MS_PER_DAY;
    const e1rmLbs = (e: { weight: number; reps: number; unit: WeightUnit }) =>
      OneRMCalculator.estimate(e.unit === 'kg' ? convertWeight(e.weight, 'kg', 'lbs') : e.weight, e.reps);

    const lifts: PulseLift[] = [];
    for (const ex of exerciseStats) {
      if (!ex.history?.length) continue;
      let recentBest = 0;
      let priorBest = 0;
      const recentDays = new Set<string>();
      for (const h of ex.history) {
        const t = new Date(h.date).getTime();
        const r = e1rmLbs(h);
        if (t >= cutoff) {
          recentBest = Math.max(recentBest, r);
          recentDays.add(new Date(h.date).toDateString());
        } else {
          priorBest = Math.max(priorBest, r);
        }
      }
      if (recentDays.size === 0 || recentBest <= 0) continue; // not trained in window

      let trend: Trend = 'holding';
      let deltaPct = 0;
      if (priorBest > 0) {
        deltaPct = ((recentBest - priorBest) / priorBest) * 100;
        if (deltaPct >= MOVE_THRESHOLD) trend = 'climbing';
        else if (deltaPct <= -MOVE_THRESHOLD) trend = 'slipping';
      }
      lifts.push({ name: ex.name, trend, deltaPct, recentSessions: recentDays.size });
    }

    const top = lifts.sort((a, b) => b.recentSessions - a.recentSessions).slice(0, MAX_ROWS);
    const climbing = top.filter(l => l.trend === 'climbing').length;
    return { lifts: top, climbing, total: top.length, hasAnyHistory: exerciseStats.some(e => e.history?.length) };
  }, [exerciseStats]);
}

// ── count-up ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700, delay = 300) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let started = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (ts: number) => {
      if (!started) started = ts;
      const p = Math.min(1, (ts - started - delay) / duration);
      if (p >= 0) setValue(target * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
}

// ── one momentum trail (draws on from the origin) ──────────────────────────────

function Trail({ d, length, color, delay }: { d: string; length: number; color: string; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 820, easing: Easing.out(Easing.cubic) }));
  }, [p, delay, d]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - p.value) }));
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={2.5}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={length}
      animatedProps={animatedProps}
    />
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

const trendColor = (t: Trend, neutral: string) => (t === 'climbing' ? UP : t === 'slipping' ? DOWN : neutral);

export default function HistoryHero({ exerciseStats, weightUnit }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;

  const { lifts, climbing, total, hasAnyHistory } = useProgressPulse(exerciseStats);
  const climbingCount = Math.round(useCountUp(climbing));

  const chartW = Dimensions.get('window').width - PAGE_PADDING * 2 - CARD_PADDING * 2;

  // Lay out each lift as a trail from a shared left origin (4 weeks ago, neutral)
  // to the right, rising/falling by its % change. Endpoints are relaxed apart so
  // labels never collide, while sign + color still read as climbing/slipping.
  const layout = useMemo(() => {
    const originX = 3;
    const endX = chartW * 0.6;
    const midY = CHART_H / 2;
    const amp = CHART_H / 2 - 16;
    const yOf = (d: number) => midY - (Math.max(-DELTA_CLAMP, Math.min(DELTA_CLAMP, d)) / DELTA_CLAMP) * amp;

    const pts = lifts.map(l => ({ l, y: yOf(l.deltaPct) })).sort((a, b) => a.y - b.y);
    const gap = 23;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y - pts[i - 1].y < gap) pts[i].y = pts[i - 1].y + gap;
    }
    const overflow = pts.length ? pts[pts.length - 1].y - (CHART_H - 10) : 0;
    if (overflow > 0) pts.forEach(p => (p.y -= overflow));
    pts.forEach(p => (p.y = Math.max(10, p.y)));

    const cx = originX + (endX - originX) * 0.55;
    return pts.map(({ l, y }) => {
      const d = `M ${originX} ${midY} C ${cx} ${midY}, ${cx} ${y}, ${endX} ${y}`;
      const length = Math.hypot(endX - originX, y - midY) * 1.25 + 40;
      return { lift: l, y, endX, d, length };
    });
  }, [lifts, chartW]);

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={[
        styles.card,
        { borderRadius: currentTheme.borderRadius, backgroundColor: colors.surface, borderColor: colors.border, shadowColor: '#000' },
      ]}
    >
      <RNView style={styles.header}>
        <Text style={[styles.kicker, { color: colors.text + '99', fontFamily: fonts.semiBold }]}>Progress</Text>
        <Text style={[styles.kickerSub, { color: colors.text + '55', fontFamily: fonts.medium }]}>vs 4 weeks ago</Text>
      </RNView>

      {total > 0 ? (
        <>
          <RNView style={{ height: CHART_H }}>
            <Svg width={chartW} height={CHART_H} style={StyleSheet.absoluteFill}>
              {/* no-change reference line */}
              <Line
                x1={3}
                y1={CHART_H / 2}
                x2={chartW * 0.6}
                y2={CHART_H / 2}
                stroke={colors.text + '14'}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              {layout.map((t, i) => (
                <Trail key={t.lift.name} d={t.d} length={t.length} color={trendColor(t.lift.trend, colors.text + '55')} delay={180 + i * 90} />
              ))}
            </Svg>

            {/* origin node — where every trail starts */}
            <RNView style={[styles.origin, { top: CHART_H / 2 - 4, backgroundColor: colors.text + '40' }]} />

            {/* endpoint dots + labels */}
            {layout.map((t, i) => {
              const color = trendColor(t.lift.trend, colors.text + '70');
              return (
                <React.Fragment key={t.lift.name}>
                  <Animated.View
                    entering={FadeIn.delay(560 + i * 90).duration(320)}
                    style={[styles.dot, { left: t.endX - 4, top: t.y - 4, backgroundColor: color }]}
                  />
                  <Animated.View
                    entering={FadeIn.delay(620 + i * 90).duration(320)}
                    style={[styles.label, { left: t.endX + 10, top: t.y - 9, maxWidth: chartW - t.endX - 12 }]}
                  >
                    <Text numberOfLines={1} style={[styles.labelName, { color: colors.text + 'DD', fontFamily: fonts.medium }]}>
                      {t.lift.name}
                    </Text>
                    {t.lift.trend !== 'holding' && (
                      <Text style={[styles.labelDelta, { color, fontFamily: fonts.bold }]}>
                        {t.lift.deltaPct > 0 ? '+' : ''}{Math.round(t.lift.deltaPct)}%
                      </Text>
                    )}
                  </Animated.View>
                </React.Fragment>
              );
            })}
          </RNView>

          <Text style={[styles.summary, { color: colors.text + '99', fontFamily: fonts.medium }]}>
            <Text style={[styles.summaryNum, { color: climbing > 0 ? UP : colors.text + '99', fontFamily: fonts.bold }]}>
              {climbingCount}
            </Text>
            {` of ${total} lift${total === 1 ? '' : 's'} trending up`}
          </Text>
        </>
      ) : (
        <RNView style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontFamily: fonts.medium }]}>
            {hasAnyHistory
              ? 'No lifts trained in the last 4 weeks — log a session to see your momentum.'
              : 'Log a few weighted sets and your lifts’ momentum will show up here.'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kicker: { fontSize: 13, letterSpacing: 0.2 },
  kickerSub: { fontSize: 11, letterSpacing: 0.3 },
  origin: {
    position: 'absolute',
    left: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelName: { fontSize: 13, letterSpacing: -0.1, flexShrink: 1 },
  labelDelta: { fontSize: 12, letterSpacing: 0 },
  summary: { fontSize: 13, letterSpacing: 0.1, marginTop: 16 },
  summaryNum: { fontSize: 14 },
  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
