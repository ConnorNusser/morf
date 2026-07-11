import { useTheme } from '@/contexts/ThemeContext';
import { getBackgroundGradient } from '@/lib/ui/backgroundGradients';
import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface ScreenBackgroundProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Screen-root wrapper: paints the theme background plus the user's selected
// tier gradient (a wash fading from the top) behind the screen's content.
// Every tab screen roots in this so the gradient shows app-wide; children
// keep their own layout and must not repaint an opaque background.
export default function ScreenBackground({ children, style }: ScreenBackgroundProps) {
  const { currentTheme, currentGradientId } = useTheme();
  const gradient = getBackgroundGradient(currentGradientId);

  return (
    <View style={[styles.root, { backgroundColor: currentTheme.colors.background }, style]}>
      {gradient.colors && (
        <LinearGradient
          pointerEvents="none"
          // Alpha-baked wash (40 ≈ 25%, 1F ≈ 12% → transparent) so the same
          // stops read as ambient color on both light and dark themes.
          colors={[gradient.colors[0] + '40', gradient.colors[1] + '1F', gradient.colors[1] + '00']}
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
