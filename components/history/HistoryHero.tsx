import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { convertWeight, ExerciseWithMax, WeightUnit } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const RECENT_DAYS = 28; // "last 4 weeks"
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MOVE_THRESHOLD = 1.5; // % change before a lift counts as climbing/slipping
const MAX_ROWS = 5;

// Semantic colors used app-wide (green = progress, red = regression).
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

const TREND_RANK: Record<Trend, number> = { climbing: 0, holding: 1, slipping: 2 };

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
      // Only lifts trained in the window belong in a "last 4 weeks" pulse.
      if (recentSessionsGuard(recentDays.size, recentBest)) continue;

      let trend: Trend = 'holding';
      let deltaPct = 0;
      if (priorBest > 0) {
        deltaPct = ((recentBest - priorBest) / priorBest) * 100;
        if (deltaPct >= MOVE_THRESHOLD) trend = 'climbing';
        else if (deltaPct <= -MOVE_THRESHOLD) trend = 'slipping';
      }
      lifts.push({ name: ex.name, trend, deltaPct, recentSessions: recentDays.size });
    }

    // Most-trained lifts lead the selection, then group by trend for display.
    const top = lifts.sort((a, b) => b.recentSessions - a.recentSessions).slice(0, MAX_ROWS);
    top.sort((a, b) => TREND_RANK[a.trend] - TREND_RANK[b.trend] || Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

    const climbing = top.filter(l => l.trend === 'climbing').length;
    const slipping = top.filter(l => l.trend === 'slipping').length;
    return { lifts: top, climbing, slipping, total: top.length, hasAnyHistory: exerciseStats.some(e => e.history?.length) };
  }, [exerciseStats]);
}

// A lift counts only if it was actually trained recently.
function recentSessionsGuard(recentDays: number, recentBest: number): boolean {
  return recentDays === 0 || recentBest <= 0;
}

// ── count-up ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700, delay = 250) {
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

// ── main ─────────────────────────────────────────────────────────────────────

const TREND_META: Record<Trend, { word: string; icon: keyof typeof Ionicons.glyphMap; color: (text: string) => string }> = {
  climbing: { word: 'climbing', icon: 'trending-up', color: () => UP },
  holding: { word: 'holding', icon: 'remove', color: text => text + '55' },
  slipping: { word: 'slipping', icon: 'trending-down', color: () => DOWN },
};

export default function HistoryHero({ exerciseStats }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;

  const { lifts, climbing, total, hasAnyHistory } = useProgressPulse(exerciseStats);
  const climbingCount = Math.round(useCountUp(climbing));

  const segColor = (t: Trend) => (t === 'climbing' ? UP : t === 'slipping' ? DOWN : colors.text + '26');

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
        <Text style={[styles.kickerSub, { color: colors.text + '55', fontFamily: fonts.medium }]}>last 4 weeks</Text>
      </RNView>

      {total > 0 ? (
        <>
          {/* glanceable mix of climbing / holding / slipping */}
          <RNView style={styles.pulseBar}>
            {lifts.map((l, i) => (
              <Animated.View
                key={l.name}
                entering={FadeIn.delay(160 + i * 70).duration(360)}
                style={[styles.pulseSeg, { backgroundColor: segColor(l.trend) }]}
              />
            ))}
          </RNView>

          {/* per-lift detail */}
          <RNView style={styles.list}>
            {lifts.map((l, i) => {
              const meta = TREND_META[l.trend];
              const color = meta.color(colors.text);
              return (
                <Animated.View key={l.name} entering={FadeInDown.delay(220 + i * 70).duration(380)} style={styles.row}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.text + 'E6', fontFamily: fonts.medium }]}>
                    {l.name}
                  </Text>
                  <RNView style={styles.trendWrap}>
                    {l.trend !== 'holding' && l.deltaPct !== 0 && (
                      <Text style={[styles.delta, { color, fontFamily: fonts.semiBold }]}>
                        {l.deltaPct > 0 ? '+' : ''}{Math.round(l.deltaPct)}%
                      </Text>
                    )}
                    <Text style={[styles.trendWord, { color, fontFamily: fonts.semiBold }]}>{meta.word}</Text>
                    <Ionicons name={meta.icon} size={14} color={color} />
                  </RNView>
                </Animated.View>
              );
            })}
          </RNView>

          <Text style={[styles.summary, { color: colors.text + '99', fontFamily: fonts.medium }]}>
            <Text style={[styles.summaryNum, { color: climbing > 0 ? UP : colors.text + '99', fontFamily: fonts.bold }]}>
              {climbingCount}
            </Text>
            {` of ${total} lift${total === 1 ? '' : 's'} moving up`}
          </Text>
        </>
      ) : (
        <RNView style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontFamily: fonts.medium }]}>
            {hasAnyHistory
              ? 'No lifts trained in the last 4 weeks — log a session to see your progress pulse.'
              : 'Log a few weighted sets and your lifts’ progress will show up here.'}
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
  pulseBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16,
  },
  pulseSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  list: { gap: 11 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { fontSize: 14, letterSpacing: -0.1, flex: 1, marginRight: 12 },
  trendWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  delta: { fontSize: 12, letterSpacing: 0 },
  trendWord: { fontSize: 13, letterSpacing: 0.1 },
  summary: {
    fontSize: 13,
    letterSpacing: 0.1,
    marginTop: 14,
  },
  summaryNum: { fontSize: 14 },
  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
