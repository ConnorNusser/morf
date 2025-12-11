import { AlertProvider } from '@/components/CustomAlert';
import { CustomExercisesProvider } from '@/contexts/CustomExercisesContext';
import { RoutineProvider } from '@/contexts/RoutineContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { VideoPlayerProvider } from '@/contexts/VideoPlayerContext';
import { WorkoutProvider } from '@/contexts/WorkoutContext';
import { notificationService } from '@/lib/services/notificationService';
import { layout } from '@/lib/ui/styles';
import {
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
    useFonts as useRalewayFonts
} from '@expo-google-fonts/raleway';

import {
    Karla_400Regular,
    Karla_700Bold,
    useFonts as useKarlaFonts
} from '@expo-google-fonts/karla';

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AudioModule } from 'expo-audio';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
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
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [ralewayLoaded] = useRalewayFonts({
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
  });

  const [karlaLoaded] = useKarlaFonts({
    Karla_400Regular,
    Karla_700Bold,
  });

  const loaded = fontsLoaded && ralewayLoaded && karlaLoaded;

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
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Register for push notifications
    notificationService.registerForPushNotifications().catch(err => {
      console.warn('Push notification registration skipped:', err);
    });

    // Listen for notifications received while app is foregrounded
    notificationListener.current = notificationService.addNotificationReceivedListener(_notification => {
      // Notification received while app is foregrounded
    });

    // Listen for notification taps
    responseListener.current = notificationService.addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      // Navigate based on notification type
      if (data?.type === 'friend_pr') {
        // Could navigate to friend's profile or leaderboard
        router.push('/(tabs)');
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={layout.flex1}>
      <ThemeProvider>
        <AlertProvider>
          <VideoPlayerProvider>
            <TutorialProvider>
              <CustomExercisesProvider>
                <RoutineProvider>
                  <WorkoutProvider>
                    <Stack>
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    </Stack>
                  </WorkoutProvider>
                </RoutineProvider>
              </CustomExercisesProvider>
            </TutorialProvider>
          </VideoPlayerProvider>
        </AlertProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}