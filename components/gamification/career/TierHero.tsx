import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// ---- Hero: current tier + overall percentile + progress to next ----
export default function TierHero({ overall, tier }: { overall: number; tier: StrengthTier }) {
  const { currentTheme } = useTheme();
  const color = getTierColor(tier);
  const band = getTierBandProgress(overall);

  return (
    <View style={styles.hero}>
      <Text style={[styles.heroTier, { color }]}>{tier}</Text>
      <Text variant="title" tone="primary" weight="semiBold" style={styles.heroPercentile}>
        {overall}
        <Text variant="meta" tone="muted" weight="regular"> percentile</Text>
      </Text>
      {overall > 0 && (
        <Text variant="meta" tone="muted" style={styles.heroRank}>
          Stronger than {overall}% of lifters
        </Text>
      )}
      {band.nextTier ? (
        <View style={styles.heroProgressWrap}>
          <View style={[styles.heroTrack, { backgroundColor: currentTheme.colors.border }]}>
            <View style={[styles.heroFill, { backgroundColor: color, width: `${Math.round(band.progress * 100)}%` }]} />
          </View>
          <Text variant="meta" tone="muted" style={styles.heroNext}>
            {band.toNext} to {band.nextTier}
          </Text>
        </View>
      ) : (
        <Text variant="meta" tone="muted" style={styles.heroNext}>Max tier reached</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space.section },
  // The tier letter is THE display glyph of the Career screen — a named
  // exception to the type scale, kept at 72.
  heroTier: { fontSize: 72, fontWeight: '800', lineHeight: 78 },
  heroPercentile: { marginTop: space.xs },
  heroRank: { marginTop: space.xs },
  heroProgressWrap: { width: '70%', marginTop: space.lg, alignItems: 'center' },
  heroTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3 },
  heroNext: { marginTop: space.sm },
});
