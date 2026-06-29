import { AlertProvider } from '@/components/CustomAlert';
import ThemeOverlay from '@/components/ThemeOverlay';
import { CustomExercisesProvider } from '@/contexts/CustomExercisesContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { VideoPlayerProvider } from '@/contexts/VideoPlayerContext';
import { notificationService } from '@/lib/services/notificationService';
import { retentionNotificationService } from '@/lib/services/retentionNotificationService';
import { layout } from '@/lib/ui/styles';
import { AppState, View } from 'react-native';
import {
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
} from '@expo-google-fonts/raleway';

import {
    Karla_400Regular,
    Karla_700Bold,
} from '@expo-google-fonts/karla';

import {
    Arimo_400Regular,
    Arimo_500Medium,
    Arimo_600SemiBold,
    Arimo_700Bold,
} from '@expo-google-fonts/arimo';

import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
} from '@expo-google-fonts/outfit';

import {
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from '@expo-google-fonts/poppins';

import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from '@expo-google-fonts/inter';

import {
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
} from '@expo-google-fonts/rubik';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AudioModule } from 'expo-audio';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // expo-font's useFonts is the same hook each @expo-google-fonts package re-exports,
  // so one call with the merged font map loads them all.
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
    Karla_400Regular,
    Karla_700Bold,
    Arimo_400Regular,
    Arimo_500Medium,
    Arimo_600SemiBold,
    Arimo_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore errors - can happen with FullWindowOverlay creating new view controllers
      });
    }
  }, [loaded]);

  // Configure audio session to allow mixing with other apps
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await AudioModule.setAudioModeAsync({
          // Allow audio to mix with other apps (like Spotify)
          interruptionMode: 'mixWithOthers',
          // Don't play in silent mode for sound effects
          playsInSilentMode: false,
          // Don't stay active in background for sound effects
          shouldPlayInBackground: false,
        });
      } catch (error) {
        console.warn('Failed to configure audio mode:', error);
      }
    };

    configureAudio();
  }, []);

  // Register for push notifications
  const router = useRouter();

  useEffect(() => {
    // Register for push notifications
    notificationService.registerForPushNotifications().catch(err => {
      console.warn('Push notification registration skipped:', err);
    });

    // Listen for notifications received while app is foregrounded
    const notificationSub = notificationService.addNotificationReceivedListener(_notification => {
      // Notification received while app is foregrounded
    });

    // Listen for notification taps
    const responseSub = notificationService.addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      // Retention reminders deep-link to the Notes tab ("Up Next" routine).
      if (data?.kind === 'retention') {
        router.push('/(tabs)/notes');
      } else if (data?.type === 'friend_pr' || data?.type === 'post_like' || data?.type === 'post_comment') {
        // Navigate to feed tab for all notification types
        router.push('/(tabs)');
      }
    });

    return () => {
      notificationSub.remove();
      responseSub.remove();
    };
  }, [router]);

  // (Re)schedule self-directed retention reminders on launch and whenever the
  // app returns to the foreground, so the streak/habit state stays current.
  useEffect(() => {
    retentionNotificationService.refreshScheduledReminders();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        retentionNotificationService.refreshScheduledReminders();
      }
    });
    return () => sub.remove();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={layout.flex1}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Separate component that can access theme context
function ThemedApp() {
  const { currentTheme } = useTheme();

  return (
    <View style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
      <AlertProvider>
        <VideoPlayerProvider>
          <CustomExercisesProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: currentTheme.colors.background },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="(tabs)" />
            </Stack>
          </CustomExercisesProvider>
        </VideoPlayerProvider>
      </AlertProvider>

      {/* Theme-specific overlay effects (snow, etc.) */}
      <ThemeOverlay />
    </View>
  );
}