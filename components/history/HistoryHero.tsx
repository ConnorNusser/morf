import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { convertWeight, GeneratedWorkout, WeightUnit } from '@/types';
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

interface HistoryHeroProps {
  workouts: GeneratedWorkout[];
  weightUnit: WeightUnit;
  /** Week-based streak (computed in the parent's quickStats). */
  streak: number;
  /** This week's volume in the user's preferred unit. */
  weekVolume: number;
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

const formatVolume = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`;

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

// ── main ─────────────────────────────────────────────────────────────────────

export default function HistoryHero({ workouts, weightUnit, streak, weekVolume }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const dark = isDarkColor(colors.background);

  const heroWidth = Dimensions.get('window').width - PAGE_PADDING * 2;
  const sparkWidth = heroWidth - HERO_PADDING * 2;
  const sparkHeight = 44;

  // Weekly volume series for the sparkline (oldest → newest, empty weeks = 0).
  const series = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const w of workouts) {
      const key = weekStartOf(new Date(w.createdAt)).getTime();
      let vol = 0;
      for (const ex of w.exercises) {
        for (const set of ex.completedSets || []) {
          vol += convertWeight(set.weight || 0, set.unit || 'lbs', weightUnit) * (set.reps || 0);
        }
      }
      buckets.set(key, (buckets.get(key) || 0) + vol);
    }
    const thisWeek = weekStartOf(new Date());
    const out: number[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      const wk = new Date(thisWeek);
      wk.setDate(wk.getDate() - i * 7);
      out.push(buckets.get(wk.getTime()) || 0);
    }
    return out;
  }, [workouts, weightUnit]);

  const totalWorkouts = workouts.length;

  // Build smooth sparkline + area paths from the series.
  const { linePath, areaPath, pathLen } = useMemo(() => {
    const max = Math.max(...series, 1);
    const n = series.length;
    const stepX = n > 1 ? sparkWidth / (n - 1) : sparkWidth;
    const padY = 6;
    const pts = series.map((v, i) => ({
      x: i * stepX,
      y: padY + (1 - v / max) * (sparkHeight - padY * 2),
    }));

    let line = `M ${pts[0].x} ${pts[0].y}`;
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[i - 1];
      const midX = (prev.x + p.x) / 2;
      // smooth with a midpoint cubic
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

  const streakVal = useCountUp(streak);
  const volVal = useCountUp(weekVolume);
  const workoutsVal = useCountUp(totalWorkouts);

  const tiles = [
    { key: 'streak', display: `${Math.round(streakVal)}`, label: 'WK STREAK', accent: true },
    { key: 'vol', display: formatVolume(volVal), unit: ` ${weightUnit}`, label: 'VOLUME · WK' },
    { key: 'workouts', display: `${Math.round(workoutsVal)}`, label: 'WORKOUTS' },
  ];

  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={[
        styles.hero,
        { height: HERO_HEIGHT, borderRadius: currentTheme.borderRadius + 6, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* aurora field */}
      <RNView style={StyleSheet.absoluteFill} pointerEvents="none">
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
      {/* contrast scrim — subtle darken/lighten toward the bottom for tile legibility */}
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
            <Text style={[styles.kicker, { color: colors.text + 'B0', fontFamily: fonts.semiBold }]}>MOMENTUM</Text>
          </RNView>
          <Text style={[styles.kickerRight, { color: colors.text + '70', fontFamily: fonts.medium }]}>
            last {WEEKS} weeks
          </Text>
        </RNView>

        <RNView style={styles.tilesRow}>
          {tiles.map((tile, i) => (
            <Animated.View
              key={tile.key}
              entering={FadeInDown.delay(120 + i * 90).duration(480)}
              style={styles.tileWrap}
            >
              <BlurView
                intensity={dark ? 24 : 18}
                tint={dark ? 'light' : 'default'}
                style={[styles.tile, { borderColor: colors.text + '1F', backgroundColor: colors.surface + (dark ? '40' : '55') }]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.tileValue, { color: tile.accent ? colors.primary : colors.text, fontFamily: fonts.bold }]}
                >
                  {tile.display}
                  {tile.unit ? (
                    <Text style={[styles.tileUnit, { color: colors.text + '70', fontFamily: fonts.medium }]}>{tile.unit}</Text>
                  ) : null}
                </Text>
                <Text style={[styles.tileLabel, { color: colors.text + '80', fontFamily: fonts.medium }]}>{tile.label}</Text>
              </BlurView>
            </Animated.View>
          ))}
        </RNView>

        {/* volume sparkline */}
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
  tilesRow: { flexDirection: 'row', gap: 10 },
  tileWrap: { flex: 1 },
  tile: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  tileValue: { fontSize: 26, letterSpacing: -0.5 },
  tileUnit: { fontSize: 13, letterSpacing: 0 },
  tileLabel: { fontSize: 10, letterSpacing: 0.8, marginTop: 3 },
  sparkWrap: { marginTop: 2 },
  shimmer: { position: 'absolute', top: -40, bottom: -40, left: 0 },
});
