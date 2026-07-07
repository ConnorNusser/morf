import { useTheme } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

export default function BlurTabBarBackground() {
  const { currentTheme } = useTheme();

  // Dark-mode heuristic from background hex prefix
  const isDarkTheme = currentTheme.colors.background.toLowerCase().startsWith('#0') ||
                      currentTheme.colors.background.toLowerCase().startsWith('#1') ||
                      currentTheme.colors.background.toLowerCase().startsWith('#2');

  return (
    <View style={styles.container} pointerEvents="none">
      <BlurView
        // systemChromeMaterial matches the native iOS tab bar appearance
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
