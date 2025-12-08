import { useTheme } from '@/contexts/ThemeContext';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

export default function BlurTabBarBackground() {
  const { currentTheme } = useTheme();

  // Detect dark mode based on background luminance
  const isDarkTheme = currentTheme.colors.background.toLowerCase().startsWith('#0') ||
                      currentTheme.colors.background.toLowerCase().startsWith('#1') ||
                      currentTheme.colors.background.toLowerCase().startsWith('#2');

  return (
    <View style={styles.container} pointerEvents="none">
      <BlurView
        // System chrome material automatically adapts to the system's theme
        // and matches the native tab bar appearance on iOS.
        tint={isDarkTheme ? "dark" : "systemChromeMaterial"}
        intensity={isDarkTheme ? 60 : 95}
        style={styles.blurView}
      />
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: currentTheme.colors.surface,
            opacity: isDarkTheme ? 0.85 : 0.95,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  blurView: {
    flex: 1,
    borderRadius: 25,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 25,
  },
});

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
