import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getBaseTier, getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Polygon, RadialGradient, Stop } from 'react-native-svg';

interface Props {
  tier: StrengthTier;
  size?: number;
}

// Pointy-top hexagon inscribed in a circle of radius r around (c, c).
const hexPoints = (c: number, r: number): string =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
  }).join(' ');

// The rank as an object: a flat charcoal hex with one inset stroke in the tier
// color. E and D stay unlit; the glow behind the badge ignites at C.
export default function HexTierBadge({ tier, size = 96 }: Props) {
  const { currentTheme } = useTheme();
  const color = getTierColor(tier);
  const base = getBaseTier(tier);
  const lit = base !== 'E' && base !== 'D';
  const c = size / 2;
  const outer = size * 0.4;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="hexGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0.45" stopColor={color} stopOpacity={0.4} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {lit && <Circle cx={c} cy={c} r={c} fill="url(#hexGlow)" />}
        <Polygon
          points={hexPoints(c, outer)}
          fill={currentTheme.colors.surface}
          stroke={currentTheme.colors.border}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <Polygon
          points={hexPoints(c, outer - size * 0.06)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.center}>
        {/* The tier letter is the app's display glyph, sized off the badge — the
            same named type-scale exception as TierRing and the Career hero. */}
        <Text
          tone="primary"
          weight="bold"
          style={{ fontSize: size * (tier.length >= 3 ? 0.24 : 0.3) }}
        >
          {tier}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
