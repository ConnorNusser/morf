import { useTheme } from '@/contexts/ThemeContext';
import { resolveBackgroundColors } from '@/lib/ui/backgroundGradients';
import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface ScreenBackgroundProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Screen-root wrapper: paints the theme background plus the user's selected
// tier gradient (a wash fading from the top; follows the lifter's tier by default) behind the screen's content.
// Every tab screen roots in this so the gradient shows app-wide; children
// keep their own layout and must not repaint an opaque background.
export default function ScreenBackground({ children, style }: ScreenBackgroundProps) {
  const { currentTheme, currentGradientId, userPercentile, gradientEnabled } = useTheme();
  // 'auto' follows the lifter's tier and blends toward the next one; an explicit
  // unlocked pick paints as-is. The Profile toggle turns the wash off entirely.
  const colors = gradientEnabled ? resolveBackgroundColors(currentGradientId, userPercentile) : null;

  return (
    <View style={[styles.root, { backgroundColor: currentTheme.colors.background }, style]}>
      {colors && (
        <LinearGradient
          pointerEvents="none"
          // Alpha-baked wash (40 ≈ 25%, 1F ≈ 12% → transparent) so the same
          // stops read as ambient color on both light and dark themes.
          colors={[colors[0] + '40', colors[1] + '1F', colors[1] + '00']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
