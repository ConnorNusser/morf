// A surface that blends into the tier background wash. With the gradient on,
// it's a faint tier-tinted glass (same family as the Home rank card) so header
// controls and cards sit *in* the wash; with it off, it's the theme's plain
// surface. Use for anything that lives on top of ScreenBackground's gradient.
import { useTheme } from '@/contexts/ThemeContext';
import { resolveBackgroundColors } from '@/lib/ui/backgroundGradients';
import { hexAlpha } from '@/lib/ui/tierFoil';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tint strength 0..1 (default 1 ≈ 14% → 4% of the wash color). */
  strength?: number;
}

export function useTierGlassColors(strength = 1): [string, string] | null {
  const { gradientEnabled, currentGradientId, userPercentile } = useTheme();
  if (!gradientEnabled) return null;
  const colors = resolveBackgroundColors(currentGradientId, userPercentile);
  if (!colors) return null;
  return [hexAlpha(colors[0], 0.14 * strength), hexAlpha(colors[1], 0.04 * strength)];
}

export default function TierGlass({ children, style, strength = 1 }: Props) {
  const { currentTheme } = useTheme();
  const glass = useTierGlassColors(strength);
  if (!glass) {
    return <View style={[{ backgroundColor: currentTheme.colors.surface }, style]}>{children}</View>;
  }
  return (
    <View style={[styles.clip, style]}>
      {/* A whisper of white keeps controls legible over the darkest part of the wash. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />
      <LinearGradient
        pointerEvents="none"
        colors={glass}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
