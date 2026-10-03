import { Text } from '@/components/Themed';
import { CareerStats, volumeComparison } from '@/lib/gamification/careerStats';
import { shareStatItems } from '@/lib/gamification/careerView';
import { space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// ---- Lifetime stat grid shown in the hero/share card ----
export default function ShareStatStrip({ stats }: { stats: CareerStats }) {
  const items = shareStatItems(stats);
  const comparison = volumeComparison(stats.totalVolume, stats.unit);
  return (
    <View>
      <View style={styles.shareStrip}>
        {items.map((it, i) => (
          <View key={i} style={styles.shareStat}>
            <Text variant="body" tone="primary" weight="bold" numberOfLines={1}>{it.v}</Text>
            <Text variant="meta" tone="muted" style={styles.shareStatLabel}>{it.l}</Text>
          </View>
        ))}
      </View>
      {comparison && (
        <Text variant="meta" tone="faint" style={styles.comparison}>{comparison}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Six lifetime datapoints in a 3-col, 2-row grid under the percentile.
  shareStrip: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, marginTop: space.md },
  shareStat: { width: '33.33%', alignItems: 'center' },
  shareStatLabel: { marginTop: space.xs },
  comparison: { textAlign: 'center', marginTop: space.md, fontStyle: 'italic' },
});
