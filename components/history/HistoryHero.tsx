import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { convertWeight, ExerciseWithMax, WeightUnit } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View as RNView } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PAGE_PADDING = 20; // matches history.tsx scrollContent
const HERO_PADDING = 18;
const HERO_HEIGHT = 212;
const WEEKS = 12; // sparkline window
const PR_WINDOW_DAYS = 30; // "recent" PR window
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface HistoryHeroProps {
  /** Per-exercise rollups (history + estimated 1RM), from the parent. */
  exerciseStats: ExerciseWithMax[];
  weightUnit: WeightUnit;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const weekStartOf = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay()); // Sunday-start, matches history.tsx
  return s;
};

// Perceived luminance of a #rrggbb color → pick blur tint / overlay polarity.
const isDarkColor = (hex: string) => {
  const m = hex.replace('#', '');
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
};

// requestAnimationFrame count-up with an ease-out cubic. Runs once per target.
function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setValue(target * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ── drifting aurora blob ─────────────────────────────────────────────────────

interface BlobProps {
  size: number;
  colors: [string, string];
  from: { x: number; y: number };
  to: { x: number; y: number };
  duration: number;
  delay: number;
}

function AuroraBlob({ size, colors, from, to, duration, delay }: BlobProps) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [t, duration, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [from.x, to.x]) },
      { translateY: interpolate(t.value, [0, 1], [from.y, to.y]) },
      { scale: interpolate(t.value, [0, 1], [1, 1.35]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2 }}
      />
    </Animated.View>
  );
}

// ── lift / PR derivation ──────────────────────────────────────────────────────

interface LiftRow {
  name: string;
  current: number; // best estimated 1RM in display unit
  prev: number;    // best before the PR window (0 if none)
  isPR: boolean;   // beat the prior best within the last 30 days
}

// Strength story for the hero: which lifts hit a fresh estimated-1RM best in the
// last 30 days, and the top lift's 12-week e1RM line for the sparkline. e1RM is
// the right currency here — it's the strength tab's language, and (unlike volume)
// it persists across weeks, so a flat line means "holding", not "did nothing".
function useLiftStory(exerciseStats: ExerciseWithMax[], weightUnit: WeightUnit) {
  return useMemo(() => {
    const cutoff = Date.now() - PR_WINDOW_DAYS * MS_PER_DAY;
    const e1rmLbs = (e: { weight: number; reps: number; unit: WeightUnit }) =>
      OneRMCalculator.estimate(e.unit === 'kg' ? convertWeight(e.weight, 'kg', 'lbs') : e.weight, e.reps);
    const toUnit = (lbs: number) => (weightUnit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs);

    const lifts: (LiftRow & { ex: ExerciseWithMax })[] = [];
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
      // A PR needs a clear beat (≥1 unit) so rounding noise doesn't fake one.
      const isPR = bestRecent != null && (bestPrior == null || bestRecent > bestPrior + 1);
      lifts.push({
        name: ex.name,
        current: Math.round(toUnit(bestLbs)),
        prev: bestPrior != null ? Math.round(toUnit(bestPrior)) : 0,
        isPR,
        ex,
      });
    }

    // PRs first (biggest jump leads), then the heaviest lifts as fallback content.
    const prs = lifts.filter(l => l.isPR).sort((a, b) => (b.current - b.prev) - (a.current - a.prev));
    const byStrength = [...lifts].sort((a, b) => b.current - a.current);
    const rows = (prs.length ? prs : byStrength).slice(0, 2);

    // Sparkline = the headline lift's e1RM across the last 12 weeks, carried
    // forward through gap weeks (strength holds; it doesn't drop to zero).
    const topLift = rows[0]?.ex ?? byStrength[0]?.ex;
    let series: number[] = [];
    if (topLift) {
      const weekly = new Map<number, number>();
      for (const h of topLift.history) {
        const k = weekStartOf(new Date(h.date)).getTime();
        weekly.set(k, Math.max(weekly.get(k) ?? 0, toUnit(e1rmLbs(h))));
      }
      const thisWeek = weekStartOf(new Date());
      let last = 0;
      for (let i = WEEKS - 1; i >= 0; i--) {
        const wk = new Date(thisWeek);
        wk.setDate(wk.getDate() - i * 7);
        const v = weekly.get(wk.getTime());
        if (v != null) last = v;
        series.push(last);
      }
      // Backfill the leading zeros (before first data) to the first known value
      // so the line starts at a level, not on the floor.
      const firstReal = series.find(v => v > 0) ?? 0;
      series = series.map(v => (v === 0 ? firstReal : v));
    }

    return {
      rows,
      prCount: prs.length,
      hasPRs: prs.length > 0,
      hasLifts: lifts.length > 0,
      topLiftName: topLift?.name ?? '',
      series,
    };
  }, [exerciseStats, weightUnit]);
}

// ── PR row (count-up on the headline number) ──────────────────────────────────

function LiftStatRow({
  row,
  unit,
  showPrev,
  accent,
  textColor,
  fonts,
  delay,
}: {
  row: LiftRow;
  unit: WeightUnit;
  showPrev: boolean;
  accent: string;
  textColor: string;
  fonts: { medium: string; bold: string; regular: string };
  delay: number;
}) {
  const v = useCountUp(row.current);
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(480)} style={styles.liftRow}>
      <Text numberOfLines={1} style={[styles.liftName, { color: textColor, fontFamily: fonts.medium }]}>
        {row.name}
      </Text>
      <RNView style={styles.liftValue}>
        {showPrev && row.prev > 0 && (
          <Text style={[styles.liftPrev, { color: textColor + '66', fontFamily: fonts.regular }]}>
            {row.prev} →
          </Text>
        )}
        <Text style={[styles.liftNew, { color: accent, fontFamily: fonts.bold }]}>
          {Math.round(v)}
          <Text style={[styles.liftUnit, { color: textColor + '80', fontFamily: fonts.medium }]}> {unit}</Text>
        </Text>
      </RNView>
    </Animated.View>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function HistoryHero({ exerciseStats, weightUnit }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const dark = isDarkColor(colors.background);

  const heroWidth = Dimensions.get('window').width - PAGE_PADDING * 2;
  const sparkWidth = heroWidth - HERO_PADDING * 2;
  const sparkHeight = 44;

  const { rows, prCount, hasPRs, hasLifts, topLiftName, series } = useLiftStory(exerciseStats, weightUnit);

  // Build smooth sparkline + area paths from the series.
  const { linePath, areaPath, pathLen } = useMemo(() => {
    if (series.length < 2) return { linePath: '', areaPath: '', pathLen: 0 };
    const max = Math.max(...series, 1);
    const min = Math.min(...series);
    const span = max - min || 1; // scale to the visible range so trend reads clearly
    const n = series.length;
    const stepX = n > 1 ? sparkWidth / (n - 1) : sparkWidth;
    const padY = 6;
    const pts = series.map((v, i) => ({
      x: i * stepX,
      y: padY + (1 - (v - min) / span) * (sparkHeight - padY * 2),
    }));

    let line = `M ${pts[0].x} ${pts[0].y}`;
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[i - 1];
      const midX = (prev.x + p.x) / 2;
      line += ` C ${midX} ${prev.y}, ${midX} ${p.y}, ${p.x} ${p.y}`;
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
    }
    const area = `${line} L ${pts[n - 1].x} ${sparkHeight} L ${pts[0].x} ${sparkHeight} Z`;
    return { linePath: line, areaPath: area, pathLen: Math.ceil(len) + 8 };
  }, [series, sparkWidth]);

  // Draw-on: stroke the line from 0 → full length.
  const draw = useSharedValue(0);
  useEffect(() => {
    draw.value = withDelay(260, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [draw]);
  const lineAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLen * (1 - draw.value),
  }));

  // Horizontal shimmer sweep across the whole hero.
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmer.value, [0, 1], [-heroWidth, heroWidth]) },
      { rotateZ: '18deg' },
    ],
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0, 0.55, 0]),
  }));

  // Mount haptic (native only).
  useEffect(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const kicker = hasPRs ? 'GETTING STRONGER' : hasLifts ? 'PERSONAL BESTS' : 'KEEP LOGGING';
  const kickerRight = hasPRs ? `last ${PR_WINDOW_DAYS} days` : hasLifts ? 'estimated 1RM' : '';
  const footer = hasPRs
    ? `${prCount} PR${prCount === 1 ? '' : 's'} this month`
    : hasLifts
      ? 'No new PRs in 30 days — keep pushing'
      : 'Log a few weighted sets to track your lifts';

  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={[
        styles.hero,
        { height: HERO_HEIGHT, borderRadius: currentTheme.borderRadius + 6, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* aurora field */}
      <RNView style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} pointerEvents="none">
        <AuroraBlob
          size={heroWidth * 0.85}
          colors={[colors.primary, colors.accent]}
          from={{ x: -heroWidth * 0.18, y: -HERO_HEIGHT * 0.25 }}
          to={{ x: heroWidth * 0.05, y: HERO_HEIGHT * 0.05 }}
          duration={7000}
          delay={0}
        />
        <AuroraBlob
          size={heroWidth * 0.72}
          colors={[colors.accent, colors.primary]}
          from={{ x: heroWidth * 0.52, y: -HERO_HEIGHT * 0.18 }}
          to={{ x: heroWidth * 0.34, y: HERO_HEIGHT * 0.12 }}
          duration={9000}
          delay={400}
        />
        <AuroraBlob
          size={heroWidth * 0.68}
          colors={[colors.accent, colors.primary]}
          from={{ x: heroWidth * 0.12, y: HERO_HEIGHT * 0.42 }}
          to={{ x: heroWidth * 0.45, y: HERO_HEIGHT * 0.72 }}
          duration={8000}
          delay={800}
        />
      </RNView>

      {/* smear the blobs into an aurora */}
      <BlurView
        intensity={Platform.OS === 'android' ? 28 : 36}
        tint={dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* contrast scrim — subtle darken/lighten toward the bottom for legibility */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.surface + '00', colors.surface + (dark ? '40' : '66')]}
        style={StyleSheet.absoluteFill}
      />

      {/* shimmer sweep */}
      <RNView style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.shimmer, { width: heroWidth * 0.4 }, shimmerStyle]}>
          <LinearGradient
            colors={['#FFFFFF00', dark ? '#FFFFFF22' : '#FFFFFF55', '#FFFFFF00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </RNView>

      {/* content */}
      <RNView style={styles.content}>
        <RNView style={styles.headerRow}>
          <RNView style={styles.headerLeft}>
            <RNView style={[styles.dot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.kicker, { color: colors.text + 'B0', fontFamily: fonts.semiBold }]}>{kicker}</Text>
          </RNView>
          {kickerRight ? (
            <Text style={[styles.kickerRight, { color: colors.text + '70', fontFamily: fonts.medium }]}>
              {kickerRight}
            </Text>
          ) : null}
        </RNView>

        {/* lift list — PR jumps (prev → new) or current bests */}
        <RNView style={styles.liftList}>
          {rows.length > 0 ? (
            rows.map((row, i) => (
              <LiftStatRow
                key={row.name}
                row={row}
                unit={weightUnit}
                showPrev={hasPRs}
                accent={hasPRs ? colors.primary : colors.text}
                textColor={colors.text}
                fonts={{ medium: fonts.medium, bold: fonts.bold, regular: fonts.regular }}
                delay={120 + i * 90}
              />
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.text + '90', fontFamily: fonts.medium }]}>
              Add weighted sets and your lifts will show up here.
            </Text>
          )}
        </RNView>

        {/* top-lift e1RM sparkline */}
        {series.length >= 2 && (
          <Animated.View entering={FadeInDown.delay(380).duration(480)} style={styles.sparkWrap}>
            <Svg width={sparkWidth} height={sparkHeight}>
              <Defs>
                <SvgLinearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={colors.accent} />
                  <Stop offset="1" stopColor={colors.primary} />
                </SvgLinearGradient>
                <SvgLinearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              <Path d={areaPath} fill="url(#heroArea)" />
              <AnimatedPath
                d={linePath}
                stroke="url(#heroLine)"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={pathLen}
                animatedProps={lineAnimProps}
              />
            </Svg>
          </Animated.View>
        )}

        <Text style={[styles.footer, { color: colors.text + '80', fontFamily: fonts.medium }]} numberOfLines={1}>
          {topLiftName && series.length >= 2 ? `${topLiftName} · ${footer}` : footer}
        </Text>
      </RNView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  content: {
    flex: 1,
    padding: HERO_PADDING,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  kicker: { fontSize: 12, letterSpacing: 1.5 },
  kickerRight: { fontSize: 11, letterSpacing: 0.3 },
  liftList: { gap: 6 },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  liftName: { fontSize: 15, letterSpacing: -0.2, flex: 1, marginRight: 12 },
  liftValue: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  liftPrev: { fontSize: 13, letterSpacing: 0 },
  liftNew: { fontSize: 22, letterSpacing: -0.5 },
  liftUnit: { fontSize: 12, letterSpacing: 0 },
  emptyText: { fontSize: 13, letterSpacing: 0 },
  sparkWrap: { marginTop: 2 },
  footer: { fontSize: 11, letterSpacing: 0.3 },
  shimmer: { position: 'absolute', top: -40, bottom: -40, left: 0 },
});
