// Swiss-minimal strength headline, shared by the Home top section and the
// Profile hero: caps label, the tier letter as display type, percentile and
// distance to the next tier, then a hairline progress bar with the band's
// endpoints. Flat — no card, no gradient; the tier color is the only color.
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor, TIER_THRESHOLDS } from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { readableInkOn } from '@/lib/ui/contrast';
import { space, track } from '@/lib/ui/tokens';
import { tierFoil } from '@/lib/ui/tierFoil';
import { getPercentileSuffix } from '@/lib/utils/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  percentile: number; // 0 = unranked
  /** Display size of the tier letter. Home runs smaller than Profile. */
  letterSize?: number;
}

export default function StrengthHeadline({ percentile, letterSize = 120 }: Props) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const ranked = percentile > 0;
  const dark = readableInkOn(currentTheme.colors.background) === '#FFFFFF';
  const foil = tierFoil(percentile);
  const tier = ranked ? getStrengthTier(percentile) : null;
  const band = getTierBandProgress(percentile);
  const color = ranked ? (dark ? foil.light : getTierColor(tier!)) : ink.faint;

  const idx = tier ? TIER_THRESHOLDS.findIndex(t => t.label === tier) : -1;
  const floor = idx >= 0 ? TIER_THRESHOLDS[idx].threshold : 0;

  return (
    <View>
      <Text variant="meta" weight="semiBold" tone="muted" style={styles.caps}>Overall strength</Text>
      <View style={styles.row}>
        {/* The tier letter is the screen's display glyph — a named exception to the type scale. */}
        <Text
          style={[styles.letter, { color, fontSize: letterSize, lineHeight: letterSize * 0.95 }]}
          numberOfLines={1}
        >
          {tier ?? '—'}
        </Text>
        <View style={styles.side}>
          <Text variant="statHero" weight="bold" tone="primary" style={styles.tabular}>
            {ranked ? percentile : '—'}
            {ranked ? <Text variant="body" weight="medium" tone="muted">{getPercentileSuffix(percentile)} pct</Text> : null}
          </Text>
          <Text variant="meta" tone="muted">
            {!ranked ? 'Log a ranked lift' : band.nextTier ? `${band.toNext} to ${band.nextTier}` : 'Top tier'}
          </Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: ink.hairline }]}>
        <View style={[styles.fill, { width: `${Math.max(1, (ranked ? band.progress : 0) * 100)}%`, backgroundColor: color }]} />
      </View>
      {ranked ? (
        <View style={styles.scale}>
          <Text variant="meta" tone="faint" style={styles.tabular}>{tier} {floor}</Text>
          {band.nextTier ? (
            <Text variant="meta" tone="faint" style={styles.tabular}>{band.nextTier} {percentile + band.toNext}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caps: { letterSpacing: track.caps, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg, marginTop: space.xs },
  letter: { fontWeight: '900', letterSpacing: -4, includeFontPadding: false },
  side: { paddingBottom: space.sm, gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  track: { height: 2, marginTop: space.lg, overflow: 'hidden' },
  fill: { height: 2 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
});
