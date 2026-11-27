// Home's lead: a holographic "rank card". Strength tier is the card itself (foil,
// edge and sheen escalate with rarity); account level rides in the corner like a
// card's power stat, with a tier-complementary XP bar and a striped ghost segment
// for what the next workout will add. Tap flips to a mini body graph.
//
// Always-dark surface (like WorkoutCompleteScreen): the foil reads the same in
// every theme, so text colors are white-alpha here by design.
import BodyGraph from '@/components/gamification/BodyGraph';
import FlipCard from '@/components/gamification/FlipCard';
import { Text } from '@/components/Themed';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { RegionState } from '@/lib/gamification/bodyGraph';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { formatXp } from '@/lib/gamification/levelDisplay';
import { radius, space } from '@/lib/ui/tokens';
import { hexAlpha, tierFoil } from '@/lib/ui/tierFoil';
import { getPercentileSuffix } from '@/lib/utils/utils';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const WHITE = '#FFFFFF';
const SUB = 'rgba(255,255,255,0.72)';
const FAINT = 'rgba(255,255,255,0.5)';
const TRACK = 'rgba(255,255,255,0.14)';
const CARD_HEIGHT = 236;

interface Props {
  percentile: number; // overall strength percentile, 0 = unranked
  level: LevelProgress | null;
  workouts: number;
  weekStreak: number;
  nextWorkoutXp: number;
  regions: RegionState[] | null; // back face; null while loading
  onOpenCareer: () => void;
}

export default function HoloRankCard(props: Props) {
  const foil = tierFoil(props.percentile);
  const frame = {
    borderColor: hexAlpha(foil.color, foil.edgeOpacity),
    borderRadius: radius.card + 6,
  };
  return (
    <FlipCard
      height={CARD_HEIGHT}
      style={styles.wrap}
      front={<Front {...props} />}
      back={
        <LinearGradient colors={[foil.foil[0], foil.foil[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, frame]}>
          <View style={styles.backHead}>
            <Text variant="meta" weight="semiBold" style={{ color: SUB }}>Your body</Text>
            <TouchableOpacity onPress={props.onOpenCareer} hitSlop={10} style={styles.careerLink} accessibilityRole="button">
              <Text variant="meta" weight="semiBold" style={{ color: foil.xp }}>Open Career</Text>
              <Ionicons name="chevron-forward" size={14} color={foil.xp} />
            </TouchableOpacity>
          </View>
          <View style={styles.backBody}>
            {props.regions && props.regions.length > 0 ? (
              <BodyGraph regions={props.regions} compact view="both" surface="dark" />
            ) : (
              <Text variant="meta" style={{ color: FAINT }}>Add your bodyweight to see your body graph</Text>
            )}
          </View>
          <Text variant="meta" style={[styles.hint, { color: FAINT }]}>Tap to flip back</Text>
        </LinearGradient>
      }
    />
  );
}

function Front({ percentile, level, workouts, weekStreak, nextWorkoutXp }: Props) {
  const foil = tierFoil(percentile);
  const band = getTierBandProgress(percentile);
  const ranked = foil.base !== null;
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Ghost segment = next session's projected XP, clipped to the bar's end.
  const progress = level?.progress ?? 0;
  const ghost = level ? Math.min(1 - progress, nextWorkoutXp / level.xpForNext) : 0;

  return (
    <LinearGradient
      colors={[foil.foil[0], foil.foil[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: hexAlpha(foil.color, foil.edgeOpacity), borderRadius: radius.card + 6 }]}
      onLayout={onLayout}
    >
      <Sheen mode={foil.sheen} ms={foil.sheenMs} width={width} />

      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="meta" weight="semiBold" style={{ color: SUB }}>Strength rank</Text>
          <Text style={[styles.tier, { color: foil.light }]} numberOfLines={1} adjustsFontSizeToFit>
            {ranked ? band.tier : '—'}
          </Text>
          <Text variant="meta" style={{ color: SUB }} numberOfLines={1}>
            {ranked
              ? band.nextTier
                ? `${band.toNext} to ${band.nextTier}`
                : 'Max tier reached'
              : 'Log a ranked lift to earn your tier'}
          </Text>
        </View>
        {level && (
          <View style={styles.levelCol}>
            <Text variant="meta" weight="semiBold" style={{ color: SUB }}>LEVEL</Text>
            <Text style={[styles.levelNum, { color: foil.xp }]}>{level.level}</Text>
            <Text variant="meta" style={{ color: SUB }} numberOfLines={1}>{level.title}</Text>
          </View>
        )}
      </View>

      {level && (
        <>
          <View style={[styles.track, { backgroundColor: TRACK }]}>
            <View style={[styles.fill, { width: `${Math.max(2, progress * 100)}%`, backgroundColor: foil.xp }]} />
            {ghost > 0 && (
              <View style={[styles.ghost, { left: `${progress * 100}%`, width: `${ghost * 100}%`, backgroundColor: foil.xpSoft }]} />
            )}
          </View>
          <View style={styles.xpRow}>
            <Text variant="meta" style={{ color: SUB }}>{formatXp(level.xpToNext)} XP to Lv {level.level + 1}</Text>
            <Text variant="meta" style={{ color: SUB }}>
              <Text variant="meta" weight="bold" style={{ color: foil.xp }}>+{nextWorkoutXp}</Text> next workout
            </Text>
          </View>
        </>
      )}

      <View style={styles.stats}>
        <Stat value={ranked ? `${percentile}${getPercentileSuffix(percentile)}` : '—'} label="percentile" />
        <Stat value={String(workouts)} label="workouts" />
        <Stat value={weekStreak > 0 ? `${weekStreak} wk` : '—'} label="streak" />
      </View>
    </LinearGradient>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="emphasis" weight="bold" style={{ color: WHITE }} numberOfLines={1}>{value}</Text>
      <Text variant="meta" style={{ color: FAINT }}>{label}</Text>
    </View>
  );
}

// Diagonal light sweep. 'once' plays on mount; 'loop' repeats with a rest
// between passes. Off under Reduce Motion.
function Sheen({ mode, ms, width }: { mode: 'none' | 'once' | 'loop'; ms: number; width: number }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-1);

  useEffect(() => {
    if (mode === 'none' || reduced || width === 0) return;
    const pass = withTiming(1, { duration: ms, easing: Easing.inOut(Easing.quad) });
    x.value = -1;
    x.value =
      mode === 'once'
        ? withDelay(500, pass)
        : withRepeat(withSequence(withDelay(1800, pass), withTiming(-1, { duration: 0 })), -1);
  }, [mode, ms, width, reduced, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * width }, { rotate: '18deg' }] }));
  if (mode === 'none' || reduced || width === 0) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, { width: width * 0.6, left: width * 0.2 }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  card: { flex: 1, borderWidth: 1, padding: space.lg, overflow: 'hidden' },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  // Display glyph, like CareerModal's hero tier: beyond the type scale on purpose.
  tier: { fontSize: 64, lineHeight: 70, fontWeight: '800' },
  levelCol: { alignItems: 'flex-end', minWidth: 72 },
  levelNum: { fontSize: 40, lineHeight: 46, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: space.sm, borderRadius: radius.pill, overflow: 'hidden', marginTop: space.md },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  ghost: { position: 'absolute', top: 0, bottom: 0, borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.control,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheen: { position: 'absolute', top: -CARD_HEIGHT, bottom: -CARD_HEIGHT },
  backHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  careerLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { textAlign: 'center' },
});
