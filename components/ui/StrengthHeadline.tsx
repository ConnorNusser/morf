// Strength headline, "gentle color blocks": shared by Home, Profile and Career.
// A tier-tinted block holds the tier letter; beside it, a percentile block (a
// soft rounded ring filled to your percentile around the number) and a "Next"
// block; under them, a soft progress block through the current tier band.
// Rounded, low-contrast surfaces — the tier color is the only hue.
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor, TIER_THRESHOLDS } from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { readableInkOn } from '@/lib/ui/contrast';
import { space, track } from '@/lib/ui/tokens';
import { tierFoil } from '@/lib/ui/tierFoil';
import { getPercentileSuffix } from '@/lib/utils/utils';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  percentile: number; // 0 = unranked
  /** Tier letter size; the blocks scale around it. */
  letterSize?: number;
}

export const BLOCK_RADIUS = 22;

export default function StrengthHeadline({ percentile, letterSize = 112 }: Props) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const ranked = percentile > 0;
  const dark = readableInkOn(currentTheme.colors.background) === '#FFFFFF';
  const foil = tierFoil(percentile);
  const tier = ranked ? getStrengthTier(percentile) : null;
  const band = getTierBandProgress(percentile);
  const soft = ranked ? (dark ? foil.light : getTierColor(tier!)) : ink.faint;
  const deep = ranked ? getTierColor(tier!) : ink.faint;

  const idx = tier ? TIER_THRESHOLDS.findIndex(t => t.label === tier) : -1;
  const floor = idx >= 0 ? TIER_THRESHOLDS[idx].threshold : 0;
  const blockH = Math.round(letterSize * 1.8);
  const block = { backgroundColor: ink.hairline, borderRadius: BLOCK_RADIUS };

  // The soft percentile ring.
  const ring = Math.round((blockH - space.sm) / 2 - space.md * 2 - 2);
  const sw = 6;
  const r = (ring - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = ranked ? Math.max(0.02, percentile / 100) : 0;

  return (
    <View style={styles.wrap}>
      <View style={[styles.grid, { height: blockH }]}>
        {/* Tier block: tinted with the tier color. */}
        <View style={[styles.tierBlock, { borderRadius: BLOCK_RADIUS, backgroundColor: soft + '29' }]}>
          <Text variant="meta" weight="semiBold" tone="secondary" style={styles.caps}>Overall strength</Text>
          {/* The tier letter is the screen's display glyph — a named exception to the type scale. */}
          <Text
            style={[styles.letter, { color: soft, fontSize: letterSize, lineHeight: Math.round(letterSize * 1.02), letterSpacing: -letterSize * 0.05 }]}
            numberOfLines={1}
          >
            {tier ?? '—'}
          </Text>
        </View>

        <View style={styles.side}>
          {/* Percentile: number inside a soft rounded ring filled to the percentile. */}
          <View style={[styles.small, styles.pctBlock, block]}>
            <View style={styles.ringRow}>
              <View style={{ width: ring, height: ring }}>
                <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
                  <Circle cx={ring / 2} cy={ring / 2} r={r} stroke={ink.ghost} strokeWidth={sw} fill="none" />
                  {ranked ? (
                    <Circle
                      cx={ring / 2}
                      cy={ring / 2}
                      r={r}
                      stroke={soft}
                      strokeWidth={sw}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${c * pct} ${c}`}
                      transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
                    />
                  ) : null}
                </Svg>
                <View style={styles.ringCenter}>
                  <Text variant="title" weight="bold" tone="primary" style={styles.tabular}>
                    {ranked ? percentile : '—'}
                  </Text>
                </View>
              </View>
              <View style={styles.pctText}>
                <Text variant="meta" weight="semiBold" tone="muted" style={styles.caps}>Pct</Text>
                {ranked ? <Text variant="body" weight="semiBold" tone="secondary">{getPercentileSuffix(percentile)}</Text> : null}
              </View>
            </View>
          </View>

          {/* Next tier. */}
          <View style={[styles.small, block]}>
            <Text variant="meta" weight="semiBold" tone="muted" style={styles.caps} numberOfLines={1}>
              {ranked && band.nextTier ? `Next · ${band.nextTier}` : 'Next'}
            </Text>
            <Text variant="heading" weight="bold" tone="primary" style={styles.tabular}>
              {!ranked ? '—' : band.nextTier ? band.toNext : 'Top'}
              {ranked && band.nextTier ? <Text variant="meta" weight="medium" tone="muted"> pct</Text> : null}
            </Text>
          </View>
        </View>
      </View>

      {/* Soft progress block through the current band. */}
      <View style={[styles.progressBlock, block]}>
        <View style={[styles.track, { backgroundColor: ink.ghost }]}>
          <LinearGradient
            colors={[deep, soft]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fill, { width: `${Math.max(3, (ranked ? band.progress : 0) * 100)}%` }]}
          />
        </View>
        {ranked ? (
          <View style={styles.scale}>
            <Text variant="meta" tone="faint" style={styles.tabular}>{tier} {floor}</Text>
            <Text variant="meta" tone="muted" style={styles.tabular}>you · {percentile}</Text>
            {band.nextTier ? (
              <Text variant="meta" tone="faint" style={styles.tabular}>{band.nextTier} {percentile + band.toNext}</Text>
            ) : <View />}
          </View>
        ) : (
          <Text variant="meta" tone="muted" style={styles.unranked}>Log a ranked lift to get a tier</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  grid: { flexDirection: 'row', gap: space.sm },
  tierBlock: { flex: 1.4, padding: space.lg, justifyContent: 'space-between' },
  side: { flex: 1, gap: space.sm },
  small: { flex: 1, padding: space.md, justifyContent: 'space-between' },
  caps: { letterSpacing: track.caps, textTransform: 'uppercase' },
  letter: { fontWeight: '800', includeFontPadding: false },
  pctBlock: { justifyContent: 'center' },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pctText: { gap: 2 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  progressBlock: { paddingHorizontal: space.lg, paddingVertical: space.md },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 999 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  unranked: { marginTop: space.sm },
});
