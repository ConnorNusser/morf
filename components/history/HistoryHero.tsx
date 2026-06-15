import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { convertWeight, ExerciseWithMax, WeightUnit } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View as RNView } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const PR_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_ROWS = 4;
const MIN_BAR = 0.14; // floor so the lightest lift still reads as a bar

interface HistoryHeroProps {
  /** Per-exercise rollups (history + estimated 1RM), from the parent. */
  exerciseStats: ExerciseWithMax[];
  weightUnit: WeightUnit;
}

interface TopLift {
  name: string;
  weight: number; // best estimated 1RM, display unit
  isPR: boolean;  // fresh best within the PR window
}

// ── data ───────────────────────────────────────────────────────────────────

function useTopLifts(exerciseStats: ExerciseWithMax[], weightUnit: WeightUnit): TopLift[] {
  return React.useMemo(() => {
    const cutoff = Date.now() - PR_WINDOW_DAYS * MS_PER_DAY;
    const e1rmLbs = (e: { weight: number; reps: number; unit: WeightUnit }) =>
      OneRMCalculator.estimate(e.unit === 'kg' ? convertWeight(e.weight, 'kg', 'lbs') : e.weight, e.reps);
    const toUnit = (lbs: number) => (weightUnit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs);

    const lifts: TopLift[] = [];
    for (const ex of exerciseStats) {
      if (!ex.history?.length) continue;
      let bestRecent: number | null = null;
      let bestPrior: number | null = null;
      for (const h of ex.history) {
        const r = e1rmLbs(h);
        if (new Date(h.date).getTime() >= cutoff) bestRecent = Math.max(bestRecent ?? 0, r);
        else bestPrior = Math.max(bestPrior ?? 0, r);
      }
      const bestLbs = Math.max(bestRecent ?? 0, bestPrior ?? 0);
      if (bestLbs <= 0) continue;
      const isPR = bestRecent != null && (bestPrior == null || bestRecent > bestPrior + 1);
      lifts.push({ name: ex.name, weight: Math.round(toUnit(bestLbs)), isPR });
    }
    return lifts.sort((a, b) => b.weight - a.weight).slice(0, MAX_ROWS);
  }, [exerciseStats, weightUnit]);
}

// ── count-up ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1000, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let started = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (ts: number) => {
      if (!started) started = ts;
      const p = Math.min(1, (ts - started - delay) / duration);
      if (p < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      setValue(target * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return value;
}

// ── one lift row (bar grows in, value counts up) ───────────────────────────────

function LiftBar({
  lift,
  fraction,
  rank,
  unit,
  delay,
  colors,
  fonts,
}: {
  lift: TopLift;
  fraction: number; // 0..1 relative to the heaviest lift
  rank: number;
  unit: WeightUnit;
  delay: number;
  colors: { primary: string; accent: string; text: string };
  fonts: { medium: string; semiBold: string; bold: string };
}) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [grow, delay, fraction]);
  const value = useCountUp(lift.weight, 850, delay);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(MIN_BAR, fraction) * 100 * grow.value}%`,
  }));

  // The heaviest lift leads with the accent; the rest read in the primary tone.
  const lead = rank === 0;
  const barColors: [string, string] = lead ? [colors.primary, colors.accent] : [colors.primary, colors.primary];

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420)} style={styles.row}>
      <RNView style={styles.rowHead}>
        <RNView style={styles.nameWrap}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text + (lead ? 'FF' : 'CC'), fontFamily: fonts.semiBold }]}>
            {lift.name}
          </Text>
          {lift.isPR && (
            <RNView style={[styles.prTag, { backgroundColor: colors.accent + '24' }]}>
              <Text style={[styles.prText, { color: colors.accent, fontFamily: fonts.bold }]}>PR</Text>
            </RNView>
          )}
        </RNView>
        <Text style={[styles.value, { color: colors.text, fontFamily: fonts.bold }]}>
          {Math.round(value)}
          <Text style={[styles.valueUnit, { color: colors.text + '70', fontFamily: fonts.medium }]}> {unit}</Text>
        </Text>
      </RNView>

      <RNView style={[styles.track, { backgroundColor: colors.text + '12' }]}>
        <Animated.View style={[styles.fill, fillStyle]}>
          <LinearGradient
            colors={barColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fillGradient}
          />
        </Animated.View>
      </RNView>
    </Animated.View>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function HistoryHero({ exerciseStats, weightUnit }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;

  const lifts = useTopLifts(exerciseStats, weightUnit);
  const max = lifts.length ? lifts[0].weight : 0;

  // A single soft mount tick — matches the app's habit of a light haptic on hero reveal.
  useEffect(() => {
    if (Platform.OS !== 'web' && lifts.length) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [lifts.length]);

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={[
        styles.card,
        {
          borderRadius: currentTheme.borderRadius,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: '#000',
        },
      ]}
    >
      <RNView style={styles.header}>
        <Text style={[styles.kicker, { color: colors.text + '99', fontFamily: fonts.semiBold }]}>Top lifts</Text>
        <Text style={[styles.kickerSub, { color: colors.text + '55', fontFamily: fonts.medium }]}>estimated 1RM</Text>
      </RNView>

      {lifts.length ? (
        <RNView style={styles.list}>
          {lifts.map((lift, i) => (
            <LiftBar
              key={lift.name}
              lift={lift}
              rank={i}
              fraction={max > 0 ? lift.weight / max : 0}
              unit={weightUnit}
              delay={140 + i * 110}
              colors={{ primary: colors.primary, accent: colors.accent, text: colors.text }}
              fonts={{ medium: fonts.medium, semiBold: fonts.semiBold, bold: fonts.bold }}
            />
          ))}
        </RNView>
      ) : (
        <RNView style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontFamily: fonts.medium }]}>
            Log a weighted set and your biggest lifts will stack up here.
          </Text>
        </RNView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 16,
    // matches Card variant="elevated"
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  kicker: { fontSize: 13, letterSpacing: 0.2 },
  kickerSub: { fontSize: 11, letterSpacing: 0.3 },
  list: { gap: 13 },
  row: {},
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  nameWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12, gap: 7 },
  name: { fontSize: 14, letterSpacing: -0.1, flexShrink: 1 },
  prTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  prText: { fontSize: 9, letterSpacing: 0.5 },
  value: { fontSize: 17, letterSpacing: -0.3 },
  valueUnit: { fontSize: 11, letterSpacing: 0 },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fillGradient: { flex: 1 },
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
