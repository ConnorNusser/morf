// Swiss-minimal rank mark: a flat metal swatch, three division ticks and the
// rank name in small caps. Replaces the shaded crest on the strength-first
// surfaces so the rank reads as typography, not an illustration. The metal is
// the muted ladder color (ranks.ts), so it never competes with the tier hue.
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { rankForLevel, rankGradientForLevel } from '@/lib/gamification/ranks';
import { readableInkOn } from '@/lib/ui/contrast';
import { space, track } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  level: number;
  progress?: number;
  /** Appends " · Lv N". */
  showLevel?: boolean;
  /** Header pill form: swatch + ticks + "Lv N" (no rank name). */
  compact?: boolean;
}

export default function RankMark({ level, progress = 0, showLevel = true, compact = false }: Props) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const dark = readableInkOn(currentTheme.colors.background) === '#FFFFFF';
  const rank = rankForLevel(level);
  const [soft, deep] = rankGradientForLevel(level, progress);
  const metal = dark ? soft : deep;
  const pips = rank.emblem.pips; // III = 1, II = 2, I = 3; 0 on master tiers

  return (
    <View style={styles.row} accessibilityLabel={`${rank.name}, level ${level}`}>
      <View style={[styles.swatch, { backgroundColor: metal }]} />
      {pips > 0 ? (
        <View style={styles.ticks}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.tick, { backgroundColor: i < pips ? metal : ink.ghost }]} />
          ))}
        </View>
      ) : null}
      {compact ? (
        <Text variant="body" weight="bold" tone="primary" style={styles.tabular} numberOfLines={1}>Lv {level}</Text>
      ) : (
      <Text variant="meta" weight="semiBold" tone="secondary" style={styles.caps} numberOfLines={1}>
        {rank.name}
        {showLevel ? <Text variant="meta" tone="muted" style={styles.caps}> · Lv {level}</Text> : null}
      </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  ticks: { flexDirection: 'row', gap: 2 },
  tick: { width: 2, height: 10, borderRadius: 1 },
  caps: { letterSpacing: track.caps, textTransform: 'uppercase' },
  tabular: { fontVariant: ['tabular-nums'] },
});
