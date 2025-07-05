import { useTheme } from '@/contexts/ThemeContext';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

export default function BlurTabBarBackground() {
  const { currentTheme } = useTheme();
  return (
    <View style={styles.container} pointerEvents="none">
      <BlurView
        // System chrome material automatically adapts to the system's theme
        // and matches the native tab bar appearance on iOS.
        tint="systemChromeMaterial"
        intensity={95}
        style={styles.blurView}
      />
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: currentTheme.colors.surface,
            opacity: 0.95,
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
