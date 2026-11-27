// Home's lead: a holographic "rank card". Strength tier is the card itself (foil,
// edge and sheen escalate with rarity); account level rides in the corner like a
// card's power stat, with a tier-complementary XP bar and a striped ghost segment
// for what the next workout will add. Tap flips to a mini body graph.
//
// Translucent: the card is a light tier tint over the screen's tier gradient
// (ScreenBackground), so it blends into the page instead of sitting on it.
// Text uses the theme's ink ramp; only the tier letter and XP carry color.
import BodyGraph from '@/components/gamification/BodyGraph';
import FlipCard from '@/components/gamification/FlipCard';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { readableInkOn } from '@/lib/ui/contrast';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { RegionState } from '@/lib/gamification/bodyGraph';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { formatXp } from '@/lib/gamification/levelDisplay';
import { rankForLevel } from '@/lib/gamification/ranks';
import StrengthHeadline from '@/components/ui/StrengthHeadline';
import RankMark from '@/components/ui/RankMark';
import RankEmblem from '@/components/gamification/RankEmblem';
import { radius, space, track } from '@/lib/ui/tokens';
import { tierFoil } from '@/lib/ui/tierFoil';
import { getPercentileSuffix } from '@/lib/utils/utils';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, TouchableOpacity, View } from 'react-native';

// Swiss minimal: strength headline + one neutral level line.
const CARD_HEIGHT = 262;

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
  const ink = useInk();
  const { currentTheme } = useTheme();
  // Swiss: both faces are flat. The back is a ruled panel, no foil or camo.
  return (
    <FlipCard
      height={CARD_HEIGHT}
      style={styles.wrap}
      front={<Front {...props} />}
      back={
        <View style={[styles.card, styles.back, { borderColor: ink.hairline, backgroundColor: currentTheme.colors.background }]}>
          <View style={styles.backHead}>
            <Text variant="meta" weight="semiBold" tone="secondary">Your body</Text>
            <TouchableOpacity onPress={props.onOpenCareer} hitSlop={10} style={styles.careerLink} accessibilityRole="button">
              <Text variant="meta" weight="semiBold" tone="primary">Open Career</Text>
              <Ionicons name="chevron-forward" size={14} color={ink.secondary} />
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
        </View>
      }
    />
  );
}

function Front({ percentile, level, nextWorkoutXp }: Props) {
  const ink = useInk();
  // Swiss minimal: flat, no card chrome. The strength headline leads; level/rank
  // is one neutral line under a hairline. Tap still flips to the body graph.
  return (
    <View style={styles.flat}>
      <StrengthHeadline percentile={percentile} letterSize={100} />
      {level ? (
        <View style={[styles.footer, { borderTopColor: ink.hairline }]}>
          <RankMark level={level.level} progress={level.progress} />
          <Text variant="meta" tone="muted" numberOfLines={1}>+{nextWorkoutXp} XP next workout</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  back: { borderWidth: StyleSheet.hairlineWidth },
  card: { flex: 1, paddingHorizontal: space.lg, paddingVertical: space.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  // Level mirrors Strength: right-aligned so the two read as a matched pair.
  // Display glyphs (tier letter and level number share one size so the halves
  // balance), like CareerModal's hero tier: beyond the type scale on purpose.
  caps: { letterSpacing: track.caps, textTransform: 'uppercase' },
  unranked: { width: 88, height: 88, borderRadius: radius.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  flat: { flex: 1, justifyContent: 'space-between', paddingTop: space.md },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  rankLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  identity: { flex: 1, minWidth: 0, gap: space.xs },
  strength: { alignItems: 'flex-end' },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden', marginTop: space.xs },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  ghost: { position: 'absolute', top: 0, bottom: 0, borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  backHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  careerLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { textAlign: 'center' },
});
