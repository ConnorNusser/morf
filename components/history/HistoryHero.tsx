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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const PAGE_PADDING = 20; // matches history.tsx scrollContent
const HERO_PADDING = 18;
const HERO_HEIGHT = 212;
const PR_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Split-flap character sets — tiles riffle forward through these to their target,
// the way a real departure board scrolls through the alphabet.
const ALPHA_SET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./'";
const DIGIT_SET = ' 0123456789';
const FLAP_STEP_MS = 58; // time per intermediate character
const FLAP_COL_STAGGER = 55; // ripple delay between columns
const CYCLE_MS = 3800; // how long each record holds before flipping to the next

// Board geometry (dark "device" tiles, theme-independent — that's its identity).
const NAME_COLS_MIN = 5;
const NAME_COLS_MAX = 10;
const TILE = { board: '#0D0E11', text: '#F4F1E8', seam: '#00000088' };

interface HistoryHeroProps {
  /** Per-exercise rollups (history + estimated 1RM), from the parent. */
  exerciseStats: ExerciseWithMax[];
  weightUnit: WeightUnit;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const isDarkColor = (hex: string) => {
  const m = hex.replace('#', '');
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
};

// Forward-walk (wrapping) the character set from `from` to `to`, returning each
// character passed through — the riffle sequence for one tile.
function flapSequence(from: string, to: string, set: string): string[] {
  const a = Math.max(0, set.indexOf(from));
  const b = set.indexOf(to);
  if (b < 0) return [to]; // off-set char: just land on it
  const out: string[] = [];
  let i = a;
  let guard = 0;
  while (i !== b && guard < set.length) {
    i = (i + 1) % set.length;
    out.push(set[i]);
    guard++;
  }
  return out.length ? out : [to];
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

// ── records to flip through ────────────────────────────────────────────────────

interface FlipRecord { name: string; weight: number; gain: number; isPR: boolean }

function useFlipRecords(exerciseStats: ExerciseWithMax[], weightUnit: WeightUnit) {
  return useMemo(() => {
    const cutoff = Date.now() - PR_WINDOW_DAYS * MS_PER_DAY;
    const e1rmLbs = (e: { weight: number; reps: number; unit: WeightUnit }) =>
      OneRMCalculator.estimate(e.unit === 'kg' ? convertWeight(e.weight, 'kg', 'lbs') : e.weight, e.reps);
    const toUnit = (lbs: number) => (weightUnit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs);

    const lifts: FlipRecord[] = [];
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
      const weight = Math.round(toUnit(bestLbs));
      const prev = bestPrior != null ? Math.round(toUnit(bestPrior)) : 0;
      lifts.push({ name: ex.name, weight, gain: isPR ? weight - prev : 0, isPR });
    }

    const prs = lifts.filter(l => l.isPR).sort((a, b) => b.gain - a.gain);
    const heaviest = [...lifts].sort((a, b) => b.weight - a.weight);
    const records = (prs.length ? prs : heaviest).slice(0, 4);
    return { records, hasPRs: prs.length > 0, hasLifts: lifts.length > 0 };
  }, [exerciseStats, weightUnit]);
}

// ── one split-flap tile ────────────────────────────────────────────────────────

function FlapTile({
  target,
  delay,
  set,
  width,
  height,
  fontSize,
  fontFamily,
  onLand,
}: {
  target: string;
  delay: number;
  set: string;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  onLand?: () => void;
}) {
  const [ch, setCh] = useState(' ');
  const flip = useSharedValue(1);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setCh(prev => {
      const seq = flapSequence(prev, target, set);
      seq.forEach((c, i) => {
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setCh(c);
            flip.value = 0;
            flip.value = withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) });
            if (i === seq.length - 1) onLand?.();
          }, delay + i * FLAP_STEP_MS)
        );
      });
      return prev;
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const charStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 220 }, { rotateX: `${interpolate(flip.value, [0, 1], [-82, 0])}deg` }],
    opacity: interpolate(flip.value, [0, 1], [0.35, 1]),
  }));

  return (
    <RNView style={[styles.tile, { width, height }]}>
      <Animated.Text style={[styles.tileChar, { fontSize, fontFamily, color: TILE.text }, charStyle]}>
        {ch === ' ' ? '' : ch}
      </Animated.Text>
      <RNView pointerEvents="none" style={styles.seam} />
    </RNView>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function HistoryHero({ exerciseStats, weightUnit }: HistoryHeroProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const dark = isDarkColor(colors.background);

  const heroWidth = Dimensions.get('window').width - PAGE_PADDING * 2;

  const { records, hasLifts } = useFlipRecords(exerciseStats, weightUnit);
  const cards: FlipRecord[] = useMemo(
    () => (records.length ? records : [{ name: hasLifts ? 'TOP LIFT' : 'GET LIFTING', weight: 0, gain: 0, isPR: false }]),
    [records, hasLifts]
  );

  // Cycle through the records on a timer (only if there's more than one).
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (cards.length < 2) return;
    const id = setInterval(() => setPage(p => (p + 1) % cards.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [cards.length]);
  const current = cards[Math.min(page, cards.length - 1)];

  // Fixed board width so the flaps stay aligned as records cycle.
  const nameCols = useMemo(
    () => Math.min(NAME_COLS_MAX, Math.max(NAME_COLS_MIN, ...cards.map(c => c.name.length))),
    [cards]
  );
  const weightCols = useMemo(
    () => Math.max(3, ...cards.map(c => String(c.weight).length)),
    [cards]
  );

  const nameStr = current.name.toUpperCase().slice(0, nameCols).padEnd(nameCols, ' ');
  const weightStr = String(current.weight).padStart(weightCols, ' ');

  // Clink as the weight flaps settle (native only). Re-fires each time the board flips.
  useEffect(() => {
    if (Platform.OS === 'web' || current.weight <= 0) return;
    const timers = Array.from({ length: weightCols }, (_, i) =>
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 300 + i * FLAP_COL_STAGGER)
    );
    return () => timers.forEach(clearTimeout);
  }, [current.name, current.weight, weightCols]);

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
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0, 0.45, 0]),
  }));

  const nameTileW = 22;
  const nameTileH = 30;
  const weightTileW = 38;
  const weightTileH = 56;

  const caption = !hasLifts
    ? 'log a weighted set'
    : current.isPR && current.gain > 0
      ? `NEW PR · +${current.gain} ${weightUnit}`
      : 'estimated 1RM';

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

      <BlurView
        intensity={Platform.OS === 'android' ? 28 : 36}
        tint={dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        pointerEvents="none"
        colors={[colors.surface + '00', colors.surface + (dark ? '55' : '7A')]}
        style={StyleSheet.absoluteFill}
      />

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

      {/* split-flap board */}
      <RNView style={styles.content}>
        <RNView style={styles.boardWrap}>
          {/* lift name row */}
          <RNView style={styles.flapRow}>
            {nameStr.split('').map((c, i) => (
              <FlapTile
                key={`n-${i}`}
                target={c}
                delay={i * FLAP_COL_STAGGER}
                set={ALPHA_SET}
                width={nameTileW}
                height={nameTileH}
                fontSize={16}
                fontFamily={fonts.bold}
              />
            ))}
          </RNView>

          {/* weight row */}
          <RNView style={styles.flapRow}>
            {weightStr.split('').map((c, i) => (
              <FlapTile
                key={`w-${i}`}
                target={c}
                delay={300 + i * FLAP_COL_STAGGER}
                set={DIGIT_SET}
                width={weightTileW}
                height={weightTileH}
                fontSize={36}
                fontFamily={fonts.bold}
              />
            ))}
            <Text style={[styles.unit, { color: colors.text + '90', fontFamily: fonts.semiBold }]}>{weightUnit}</Text>
          </RNView>
        </RNView>

        {/* caption + page dots */}
        <RNView style={styles.captionRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.caption,
              { color: current.isPR && current.gain > 0 ? colors.primary : colors.text + '80', fontFamily: fonts.semiBold },
            ]}
          >
            {caption}
          </Text>
          {cards.length > 1 && (
            <RNView style={styles.dots}>
              {cards.map((_, i) => (
                <RNView
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === page ? colors.primary : colors.text + '30' },
                  ]}
                />
              ))}
            </RNView>
          )}
        </RNView>
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
    justifyContent: 'center',
    gap: 14,
  },
  boardWrap: {
    alignItems: 'center',
    gap: 8,
  },
  flapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    marginHorizontal: 2,
    borderRadius: 4,
    backgroundColor: TILE.board,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF14',
  },
  tileChar: {
    letterSpacing: 0.5,
    includeFontPadding: false,
    textAlign: 'center',
  },
  seam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: TILE.seam,
  },
  unit: {
    fontSize: 15,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  caption: {
    fontSize: 11.5,
    letterSpacing: 1,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  shimmer: { position: 'absolute', top: -40, bottom: -40, left: 0 },
});
