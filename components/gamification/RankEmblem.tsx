// The level rank as an object: the same hex letter badge overall strength uses
// (HexTierBadge), showing the rank grade ("C+"). One badge language for every
// grade in the app — the old metal crests are gone. Optional step pips under
// it show the position inside the tier (−, plain, +).
import HexTierBadge from '@/components/gamification/HexTierBadge';
import { useInk } from '@/components/Themed';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { rankForLevel, rankGradientForLevel } from '@/lib/gamification/ranks';
import { space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  level: number;
  /** 0..1 through the current level (kept for API compatibility). */
  progress?: number;
  size?: number;
  /** Step pips under the badge: 3 per tier (−, plain, +). */
  showPips?: boolean;
  /** Empty-pip color; defaults to theme ink. Pass one on always-dark screens. */
  pipTrackColor?: string;
}

export default function RankEmblem({ level, progress = 0, size = 48, showPips = false, pipTrackColor }: Props) {
  const ink = useInk();
  const rank = rankForLevel(level);
  const [soft] = rankGradientForLevel(level, progress);
  const filled = rank.emblem.pips; // − = 1, plain = 2, + = 3

  return (
    <View style={styles.wrap} accessibilityLabel={`Rank ${rank.name}, level ${level}`}>
      <HexTierBadge tier={rank.name as StrengthTier} size={size} />
      {showPips ? (
        <View style={styles.pips}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={[
                styles.pip,
                { width: Math.max(4, size * 0.08), height: Math.max(4, size * 0.08), backgroundColor: i < filled ? soft : pipTrackColor ?? ink.ghost },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pips: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  pip: { borderRadius: 999 },
});
