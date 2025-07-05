import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function NotFoundScreen() {
  const { currentTheme } = useTheme();

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Oops!',
          headerStyle: {
            backgroundColor: currentTheme.colors.background,
          },
          headerTintColor: currentTheme.colors.text,
        }} 
      />
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>
          This screen does not exist.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: currentTheme.colors.primary }]}>
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
