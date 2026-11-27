// Home's lead: a holographic "rank card". Strength tier is the card itself (foil,
// edge and sheen escalate with rarity); account level rides in the corner like a
// card's power stat, with a tier-complementary XP bar and a striped ghost segment
// for what the next workout will add. Tap flips to a mini body graph.
//
// Translucent: the card is a light tier tint over the screen's tier gradient
// (ScreenBackground), so it blends into the page instead of sitting on it.
// Text uses the theme's ink ramp; only the tier letter and XP carry color.
// An equipped card camo (lib/gamification/cardCamos, components/home/CardCamo)
// paints a low-alpha pattern layer under the content and can retune the Sheen.
import BodyGraph from '@/components/gamification/BodyGraph';
import FlipCard from '@/components/gamification/FlipCard';
import CardCamo from '@/components/home/CardCamo';
import useEquippedCamo from '@/hooks/useEquippedCamo';
import { CardCamo as CardCamoSpec, camoSheen } from '@/lib/gamification/cardCamos';
import { sheenStops } from '@/lib/ui/camoPatterns';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { readableInkOn } from '@/lib/ui/contrast';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { RegionState } from '@/lib/gamification/bodyGraph';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { formatXp } from '@/lib/gamification/levelDisplay';
import { rankForLevel } from '@/lib/gamification/ranks';
import HexTierBadge from '@/components/gamification/HexTierBadge';
import RankEmblem from '@/components/gamification/RankEmblem';
import { radius, space, track } from '@/lib/ui/tokens';
import { tierFoil } from '@/lib/ui/tierFoil';
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

// Style A: hex tier badge + percentile lead; level/rank is a one-line footnote.
const CARD_HEIGHT = 168;

// Dark theme → the bright tier tint reads best; light theme → the saturated hue.
function useIsDarkTheme(): boolean {
  const { currentTheme } = useTheme();
  return readableInkOn(currentTheme.colors.background) === '#FFFFFF';
}

interface Props {
  percentile: number; // overall strength percentile, 0 = unranked
  level: LevelProgress | null;
  workouts: number;
  weekStreak: number;
  nextWorkoutXp: number;
  regions: RegionState[] | null; // back face; null while loading
  uri?: string | null; // profile picture for the avatar ring
  username?: string | null;
  onOpenCareer: () => void;
}

export default function HoloRankCard(props: Props) {
  const foil = tierFoil(props.percentile);
  const frame = { borderRadius: radius.card + 6 };
  // Equipped camo (standard when camos are off, locked, or level is loading).
  const { camo } = useEquippedCamo(props.level?.level ?? null);
  return (
    <FlipCard
      height={CARD_HEIGHT}
      style={styles.wrap}
      front={<Front {...props} camo={camo} />}
      back={
        <LinearGradient colors={[foil.foil[0], foil.foil[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, frame]}>
          <CardCamo camo={camo} tierColor={foil.color} animate={false} />
          <View style={styles.backHead}>
            <Text variant="meta" weight="semiBold" tone="secondary">Your body</Text>
            <TouchableOpacity onPress={props.onOpenCareer} hitSlop={10} style={styles.careerLink} accessibilityRole="button">
              <Text variant="meta" weight="semiBold" style={{ color: foil.xp }}>Open Career</Text>
              <Ionicons name="chevron-forward" size={14} color={foil.xp} />
            </TouchableOpacity>
          </View>
          <View style={styles.backBody}>
            {props.regions && props.regions.length > 0 ? (
              <BodyGraph regions={props.regions} compact view="both" />
            ) : (
              <Text variant="meta" tone="muted">Add your bodyweight to see your body graph</Text>
            )}
          </View>
          <Text variant="meta" tone="faint" style={styles.hint}>Tap to flip back</Text>
        </LinearGradient>
      }
    />
  );
}

function Front({ percentile, level, nextWorkoutXp, camo }: Props & { camo: CardCamoSpec }) {
  const foil = tierFoil(percentile);
  const sheen = camoSheen(foil, camo);
  const ink = useInk();
  const band = getTierBandProgress(percentile);
  const ranked = foil.base !== null;
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Style A: the tier as an object (hex badge) leads, percentile + progress beside
  // it. Level/rank sits under a rule as one neutral line with the small crest.
  const nextLine = !ranked
    ? 'Log a ranked lift'
    : band.nextTier
      ? `${band.toNext} to ${band.nextTier}`
      : 'Top tier';

  return (
    <LinearGradient
      colors={[foil.foil[0], foil.foil[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderRadius: radius.card + 6, borderColor: foil.color + '59' }]}
      onLayout={onLayout}
    >
      <CardCamo camo={camo} tierColor={foil.color} />
      <Sheen mode={sheen.mode} ms={sheen.ms} restMs={sheen.restMs} stops={sheenStops(sheen.tint, sheen.intensity)} width={width} />

      <View style={styles.row}>
        {ranked ? (
          <HexTierBadge tier={band.tier} size={88} />
        ) : (
          <View style={[styles.unranked, { borderColor: ink.ghost }]}>
            <Text variant="statHero" weight="bold" tone="muted">—</Text>
          </View>
        )}
        <View style={styles.identity}>
          <Text variant="meta" weight="bold" tone="muted" style={styles.caps}>Overall strength</Text>
          <Text variant="heading" weight="bold" tone="primary" numberOfLines={1}>
            {ranked ? `${percentile}${getPercentileSuffix(percentile)} percentile` : 'Unranked'}
          </Text>
          <View style={[styles.track, { backgroundColor: ink.ghost }]}>
            <View style={[styles.fill, { width: `${Math.max(2, (ranked ? band.progress : 0) * 100)}%`, backgroundColor: foil.color }]} />
          </View>
          <Text variant="meta" tone="muted" numberOfLines={1}>{nextLine}</Text>
        </View>
      </View>

      {level ? (
        <View style={[styles.footer, { borderTopColor: ink.hairline }]}>
          <View style={styles.rankLine}>
            <RankEmblem level={level.level} progress={level.progress} size={20} />
            <Text variant="meta" tone="secondary" numberOfLines={1}>
              Lv {level.level} · {rankForLevel(level.level).name}
            </Text>
          </View>
          <Text variant="meta" tone="muted" numberOfLines={1}>+{nextWorkoutXp} XP next workout</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

// Diagonal light sweep. 'once' plays on mount; 'loop' repeats with a rest
// between passes. Off under Reduce Motion. `stops` come from the equipped camo
// (default: the white 20% sweep).
function Sheen({
  mode,
  ms,
  restMs,
  stops,
  width,
}: {
  mode: 'none' | 'once' | 'loop';
  ms: number;
  restMs: number;
  stops: string[];
  width: number;
}) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-1);

  useEffect(() => {
    if (mode === 'none' || reduced || width === 0) return;
    const pass = withTiming(1, { duration: ms, easing: Easing.inOut(Easing.quad) });
    x.value = -1;
    x.value =
      mode === 'once'
        ? withDelay(500, pass)
        : withRepeat(withSequence(withDelay(restMs, pass), withTiming(-1, { duration: 0 })), -1);
  }, [mode, ms, restMs, width, reduced, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * width }, { rotate: '18deg' }] }));
  if (mode === 'none' || reduced || width === 0) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.sheen, { width: width * 0.6, left: width * 0.2 }, style]}>
      <LinearGradient
        colors={stops as [string, string, ...string[]]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  card: { flex: 1, paddingHorizontal: space.lg, paddingVertical: space.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  // Level mirrors Strength: right-aligned so the two read as a matched pair.
  // Display glyphs (tier letter and level number share one size so the halves
  // balance), like CareerModal's hero tier: beyond the type scale on purpose.
  caps: { letterSpacing: track.caps, textTransform: 'uppercase' },
  unranked: { width: 88, height: 88, borderRadius: radius.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  rankLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  identity: { flex: 1, minWidth: 0, gap: space.xs },
  strength: { alignItems: 'flex-end' },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden', marginTop: space.xs },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  ghost: { position: 'absolute', top: 0, bottom: 0, borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  sheen: { position: 'absolute', top: -CARD_HEIGHT, bottom: -CARD_HEIGHT },
  backHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  careerLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { textAlign: 'center' },
});
