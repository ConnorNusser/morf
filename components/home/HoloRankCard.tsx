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
import { rankAccentForLevel } from '@/lib/gamification/ranks';
import { radius, space } from '@/lib/ui/tokens';
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

const CARD_HEIGHT = 184;

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

function Front({ percentile, level, workouts, weekStreak, nextWorkoutXp, camo }: Props & { camo: CardCamoSpec }) {
  const foil = tierFoil(percentile);
  const sheen = camoSheen(foil, camo);
  const ink = useInk();
  const dark = useIsDarkTheme();
  const letter = dark ? foil.light : foil.color;
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
      style={[styles.card, { borderRadius: radius.card + 6 }]}
      onLayout={onLayout}
    >
      <CardCamo camo={camo} tierColor={foil.color} />
      <Sheen mode={sheen.mode} ms={sheen.ms} restMs={sheen.restMs} stops={sheenStops(sheen.tint, sheen.intensity)} width={width} />

      {/* Two balanced halves: strength (who you are) | level (what you've put in). */}
      <View style={styles.halves}>
        <View style={styles.half}>
          <Text variant="meta" weight="semiBold" tone="secondary">Strength</Text>
          <Text style={[styles.tier, { color: letter }]} numberOfLines={1} adjustsFontSizeToFit>
            {ranked ? band.tier : '—'}
          </Text>
          <Text variant="meta" tone="secondary" numberOfLines={1}>
            {ranked
              ? `${percentile}${getPercentileSuffix(percentile)} · ${band.nextTier ? `${band.toNext} to ${band.nextTier}` : 'max tier'}`
              : 'Log a ranked lift'}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: ink.hairline }]} />

        <View style={styles.half}>
          <Text variant="meta" weight="semiBold" tone="secondary">Level</Text>
          {level ? (
            <>
              <Text style={[styles.tier, { color: rankAccentForLevel(level.level, dark, level.progress) }]} numberOfLines={1}>
                {level.level}
              </Text>
              <Text variant="meta" tone="secondary" numberOfLines={1}>
                {level.title} · {formatXp(level.xpToNext)} to {level.level + 1}
              </Text>
            </>
          ) : (
            <Text style={[styles.tier, { color: letter }]}>—</Text>
          )}
        </View>
      </View>

      {level && (
        <>
          <View style={[styles.track, { backgroundColor: ink.ghost }]}>
            <View style={[styles.fill, { width: `${Math.max(2, progress * 100)}%`, backgroundColor: foil.xp }]} />
            {ghost > 0 && (
              <View style={[styles.ghost, { left: `${progress * 100}%`, width: `${ghost * 100}%`, backgroundColor: foil.xpSoft }]} />
            )}
          </View>
          <View style={styles.xpRow}>
            <Text variant="meta" tone="muted">{formatXp(level.xpIntoLevel)} / {formatXp(level.xpForNext)} XP</Text>
            <Text variant="meta" tone="secondary">
              <Text variant="meta" weight="bold" style={{ color: foil.xp }}>+{nextWorkoutXp}</Text> next workout
            </Text>
          </View>
        </>
      )}

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
  card: { flex: 1, padding: space.lg, overflow: 'hidden' },
  flex: { flex: 1 },
  halves: { flexDirection: 'row', alignItems: 'stretch' },
  half: { flex: 1, minWidth: 0 },
  divider: { width: StyleSheet.hairlineWidth, marginHorizontal: space.lg, marginVertical: space.xs },
  // Display glyphs (tier letter and level number share one size so the halves
  // balance), like CareerModal's hero tier: beyond the type scale on purpose.
  tier: { fontSize: 58, lineHeight: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: space.sm, borderRadius: radius.pill, overflow: 'hidden', marginTop: space.lg },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  ghost: { position: 'absolute', top: 0, bottom: 0, borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  sheen: { position: 'absolute', top: -CARD_HEIGHT, bottom: -CARD_HEIGHT },
  backHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  careerLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { textAlign: 'center' },
});
