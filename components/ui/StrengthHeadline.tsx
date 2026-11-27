// Swiss "vertical poster" strength headline, shared by the Home top section and
// the Profile hero: a side column with the caps label running down a hairline,
// the tier letter as display type, the percentile as a large outlined numeral,
// then a 2px progress hairline with the band's endpoints. Flat — the tier color
// is the only color.
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
import Svg, { Text as SvgText } from 'react-native-svg';

interface Props {
  percentile: number; // 0 = unranked
  /** Display size of the tier letter; the outlined percentile scales from it. */
  letterSize?: number;
}

const SIDE = 28;
const LABEL_W = 220;

export default function StrengthHeadline({ percentile, letterSize = 150 }: Props) {
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

  // Outlined numeral (react-native-svg: RN Text can't stroke).
  const numSize = Math.round(letterSize * 0.7);
  const numText = ranked ? String(percentile) : '—';
  const numW = Math.ceil(numSize * 0.64 * numText.length) + 4;

  return (
    <View style={styles.wrap}>
      {/* Side column: the label runs down a hairline (poster spine). */}
      <View style={[styles.side, { borderRightColor: ink.hairline }]}>
        <Text
          variant="meta"
          weight="semiBold"
          tone="faint"
          numberOfLines={1}
          style={[styles.caps, styles.spine]}
        >
          Overall strength
        </Text>
      </View>

      <View style={styles.main}>
        {/* The tier letter is the screen's display glyph — a named exception to the type scale. */}
        <Text
          style={[styles.letter, { color, fontSize: letterSize, lineHeight: Math.round(letterSize * 1.02), marginBottom: -letterSize * 0.12, letterSpacing: -letterSize * 0.06 }]}
          numberOfLines={1}
        >
          {tier ?? '—'}
        </Text>

        <View style={styles.numRow}>
          <Svg width={numW} height={numSize * 0.82} accessibilityLabel={ranked ? `${percentile} percentile` : 'Unranked'}>
            {/* Stroke wide, then fill with the background on top: only the outer
                half of the stroke shows, hiding the font's overlapping contours. */}
            <SvgText
              x={1.5}
              y={numSize * 0.76}
              fontSize={numSize}
              fontWeight="900"
              letterSpacing={-numSize * 0.05}
              fill="none"
              stroke={ink.secondary}
              strokeWidth={3}
              strokeLinejoin="round"
            >
              {numText}
            </SvgText>
            <SvgText
              x={1.5}
              y={numSize * 0.76}
              fontSize={numSize}
              fontWeight="900"
              letterSpacing={-numSize * 0.05}
              fill={currentTheme.colors.background}
            >
              {numText}
            </SvgText>
          </Svg>
          <View style={styles.numLabel}>
            {ranked ? <Text variant="body" weight="bold" tone="primary">{getPercentileSuffix(percentile)}</Text> : null}
            <Text variant="meta" tone="muted">{ranked ? 'percentile' : 'Log a ranked lift'}</Text>
          </View>
        </View>

        <View style={[styles.track, { backgroundColor: ink.hairline }]}>
          <View style={[styles.fill, { width: `${Math.max(1, (ranked ? band.progress : 0) * 100)}%`, backgroundColor: color }]} />
        </View>
        {ranked ? (
          <View style={styles.scale}>
            <Text variant="meta" tone="faint" style={styles.tabular}>{tier} {floor}</Text>
            <Text variant="meta" tone="muted">{band.nextTier ? `${band.toNext} to ${band.nextTier}` : 'Top tier'}</Text>
            {band.nextTier ? (
              <Text variant="meta" tone="faint" style={styles.tabular}>{band.nextTier} {percentile + band.toNext}</Text>
            ) : <View />}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row' },
  side: { width: SIDE, borderRightWidth: StyleSheet.hairlineWidth, marginRight: space.lg },
  caps: { letterSpacing: track.caps, textTransform: 'uppercase' },
  // Rotated 90° about its center, then shifted so it reads top-down from the column's top-left.
  spine: {
    position: 'absolute',
    width: LABEL_W,
    left: -LABEL_W / 2 + SIDE / 2 - 2,
    top: LABEL_W / 2 - SIDE / 2,
    transform: [{ rotate: '90deg' }],
  },
  main: { flex: 1, minWidth: 0 },
  letter: { fontWeight: '900', includeFontPadding: false },
  numRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.md },
  numLabel: { paddingBottom: space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  track: { height: 2, marginTop: space.lg, overflow: 'hidden' },
  fill: { height: 2 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
});
