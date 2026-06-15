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
  FadeIn,
  FadeInDown,
  interpolate,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const PAGE_PADDING = 20; // matches history.tsx scrollContent
const HERO_PADDING = 18;
const HERO_HEIGHT = 212;
const RACK_HEIGHT = 96;
const PR_WINDOW_DAYS = 30; // "recent" PR window
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Plate loading order is heaviest-first (loads from the collar inward, like real
// life), capped so a monster lift still fits the bar.
const BAR_WEIGHT: Record<WeightUnit, number> = { lbs: 45, kg: 20 };
const PLATE_SIZES: Record<WeightUnit, number[]> = {
  lbs: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};
const MAX_PLATES_PER_SIDE = 6;

// Color-coded like competition bumper plates — lifters read these at a glance,
// which is what keeps it from feeling like a generic chart. Height/width scale
// with the denomination so the stack has real heft.
interface PlateLook { h: number; w: number; color: string }
const PLATE_LOOK: Record<WeightUnit, Record<number, PlateLook>> = {
  lbs: {
    45: { h: 74, w: 13, color: '#3B5BDB' },
    35: { h: 66, w: 12, color: '#F2B705' },
    25: { h: 56, w: 11, color: '#2F9E44' },
    10: { h: 44, w: 10, color: '#E8590C' },
    5: { h: 36, w: 9, color: '#E03131' },
    2.5: { h: 30, w: 8, color: '#ADB5BD' },
  },
  kg: {
    25: { h: 74, w: 13, color: '#E03131' },
    20: { h: 68, w: 12, color: '#3B5BDB' },
    15: { h: 60, w: 11, color: '#F2B705' },
    10: { h: 50, w: 10, color: '#2F9E44' },
    5: { h: 40, w: 9, color: '#E9ECEF' },
    2.5: { h: 32, w: 8, color: '#868E96' },
    1.25: { h: 28, w: 7, color: '#ADB5BD' },
  },
};

interface HistoryHeroProps {
  /** Per-exercise rollups (history + estimated 1RM), from the parent. */
  exerciseStats: ExerciseWithMax[];
  weightUnit: WeightUnit;
}

// ── helpers ──────────────────────────────────────────────────────────────────

// Perceived luminance of a #rrggbb color → pick blur tint / overlay polarity.
const isDarkColor = (hex: string) => {
  const m = hex.replace('#', '');
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
};

// Greedy plate breakdown for one side of the bar, heaviest-first.
function platesForSide(total: number, unit: WeightUnit): number[] {
  const bar = BAR_WEIGHT[unit];
  let perSide = Math.max(0, (total - bar) / 2);
  const out: number[] = [];
  for (const s of PLATE_SIZES[unit]) {
    while (perSide >= s - 1e-6 && out.length < MAX_PLATES_PER_SIDE) {
      out.push(s);
      perSide -= s;
    }
  }
  return out;
}

// requestAnimationFrame count-up with an ease-out cubic. Runs once per target.
function useCountUp(target: number, duration = 1300) {
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

// The headline lift: the one that hit a fresh estimated-1RM best in the last 30
// days with the biggest jump; otherwise the heaviest lift on record. e1RM is the
// right number to "put on the bar" — it's what you could theoretically rack.
function useHeadlineLift(exerciseStats: ExerciseWithMax[], weightUnit: WeightUnit) {
  return useMemo(() => {
    const cutoff = Date.now() - PR_WINDOW_DAYS * MS_PER_DAY;
    const e1rmLbs = (e: { weight: number; reps: number; unit: WeightUnit }) =>
      OneRMCalculator.estimate(e.unit === 'kg' ? convertWeight(e.weight, 'kg', 'lbs') : e.weight, e.reps);
    const toUnit = (lbs: number) => (weightUnit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs);

    type Lift = { name: string; weight: number; prev: number; isPR: boolean };
    const lifts: Lift[] = [];
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
      lifts.push({
        name: ex.name,
        weight: Math.round(toUnit(bestLbs)),
        prev: bestPrior != null ? Math.round(toUnit(bestPrior)) : 0,
        isPR,
      });
    }

    const prs = lifts.filter(l => l.isPR).sort((a, b) => (b.weight - b.prev) - (a.weight - a.prev));
    const heaviest = [...lifts].sort((a, b) => b.weight - a.weight);
    const headline = prs[0] ?? heaviest[0] ?? null;
    return { headline, prCount: prs.length, hasLifts: lifts.length > 0 };
  }, [exerciseStats, weightUnit]);
}

// ── one weight plate ───────────────────────────────────────────────────────────

function Plate({
  look,
  side,
  loadIndex,
  dark,
}: {
  look: PlateLook;
  side: 'left' | 'right';
  loadIndex: number; // 0 = heaviest, loaded first
  dark: boolean;
}) {
  const entering = (side === 'left' ? SlideInLeft : SlideInRight)
    .delay(340 + loadIndex * 120)
    .springify()
    .damping(15)
    .stiffness(150)
    .mass(0.7);
  return (
    <Animated.View
      entering={entering}
      style={[
        styles.plate,
        {
          width: look.w,
          height: look.h,
          backgroundColor: look.color,
          borderColor: dark ? '#FFFFFF30' : '#00000020',
        },
      ]}
    >
      {/* glossy top edge so the plate reads as solid, not a flat rectangle */}
      <RNView style={[styles.plateSheen, { backgroundColor: dark ? '#FFFFFF38' : '#FFFFFF55' }]} />
    </Animated.View>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function HistoryHero({ exerciseStats, weightUnit }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const dark = isDarkColor(colors.background);

  const heroWidth = Dimensions.get('window').width - PAGE_PADDING * 2;

  const { headline, prCount, hasLifts } = useHeadlineLift(exerciseStats, weightUnit);
  const weight = headline?.weight ?? 0;
  const plates = useMemo(() => platesForSide(weight, weightUnit), [weight, weightUnit]);
  const gain = headline?.isPR ? headline.weight - headline.prev : 0;
  const weightVal = useCountUp(weight);

  // Right sleeve loads heaviest→outward; left mirrors it. Track each plate's
  // load order so both sides clink on in sync.
  const rightPlates = plates.map((size, i) => ({ size, loadIndex: i }));
  const leftPlates = [...rightPlates].reverse();

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

  // Clink a haptic as each plate seats, timed to the slide-on stagger. Heaviest
  // plate lands with a meatier thud.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timers = plates.map((_, i) =>
      setTimeout(() => {
        Haptics.impactAsync(
          i === 0 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        ).catch(() => {});
      }, 340 + i * 120 + 180)
    );
    return () => timers.forEach(clearTimeout);
  }, [plates]);

  const subtitle = !hasLifts
    ? 'Log a weighted set and load up the bar'
    : gain > 0
      ? `+${gain} ${weightUnit} since last month${prCount > 1 ? ` · ${prCount} PRs` : ''}`
      : 'your heaviest estimated 1RM';

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
        colors={[colors.surface + '00', colors.surface + (dark ? '55' : '7A')]}
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
        {/* the barbell */}
        <RNView style={styles.rack}>
          {/* steel bar behind the plates (rounded ends = sleeves) */}
          <LinearGradient
            pointerEvents="none"
            colors={dark ? ['#CED4DA', '#868E96', '#495057'] : ['#F1F3F5', '#ADB5BD', '#868E96']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.bar}
          />
          <RNView style={styles.platesRow}>
            <RNView style={styles.group}>
              {leftPlates.map((p, i) => (
                <Plate key={`l-${i}`} look={PLATE_LOOK[weightUnit][p.size]} side="left" loadIndex={p.loadIndex} dark={dark} />
              ))}
            </RNView>
            {/* bare knurled grip in the middle */}
            <RNView style={styles.grip} />
            <RNView style={styles.group}>
              {rightPlates.map((p, i) => (
                <Plate key={`r-${i}`} look={PLATE_LOOK[weightUnit][p.size]} side="right" loadIndex={p.loadIndex} dark={dark} />
              ))}
            </RNView>
          </RNView>
        </RNView>

        {/* readout */}
        <Animated.View entering={FadeIn.delay(500).duration(500)} style={styles.readout}>
          <RNView style={styles.readoutLine}>
            {headline ? (
              <Text numberOfLines={1} style={[styles.liftName, { color: colors.text + 'C0', fontFamily: fonts.semiBold }]}>
                {headline.name.toUpperCase()}
              </Text>
            ) : (
              <Text style={[styles.liftName, { color: colors.text + 'C0', fontFamily: fonts.semiBold }]}>EMPTY BAR</Text>
            )}
            <Text style={[styles.weight, { color: colors.text, fontFamily: fonts.bold }]}>
              {Math.round(weightVal)}
              <Text style={[styles.weightUnit, { color: colors.text + '80', fontFamily: fonts.medium }]}> {weightUnit}</Text>
            </Text>
          </RNView>
          <Text numberOfLines={1} style={[styles.subtitle, { color: gain > 0 ? colors.primary : colors.text + '80', fontFamily: fonts.medium }]}>
            {subtitle}
          </Text>
        </Animated.View>
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
  rack: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    top: RACK_HEIGHT / 2 - 3,
    borderRadius: 3,
  },
  platesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: RACK_HEIGHT,
  },
  group: { flexDirection: 'row', alignItems: 'center' },
  grip: { width: 48 },
  plate: {
    marginHorizontal: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  plateSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    opacity: 0.7,
  },
  readout: {
    alignItems: 'flex-start',
  },
  readoutLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    width: '100%',
  },
  liftName: { fontSize: 14, letterSpacing: 2, flex: 1, marginRight: 12 },
  weight: { fontSize: 30, letterSpacing: -0.5 },
  weightUnit: { fontSize: 14, letterSpacing: 0 },
  subtitle: { fontSize: 12, letterSpacing: 0.2, marginTop: 2 },
  shimmer: { position: 'absolute', top: -40, bottom: -40, left: 0 },
});
