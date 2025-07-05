import { useTheme } from '@/contexts/ThemeContext';
import { StyleSheet, View } from 'react-native';

// This is a shim for web and Android where the tab bar is generally opaque.
export default function TabBarBackground() {
  const { currentTheme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: currentTheme.colors.surface,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 8,
          },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 15,
        },
      ]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 25,
  },
});
