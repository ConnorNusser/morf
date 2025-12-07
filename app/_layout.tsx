import { AlertProvider } from '@/components/CustomAlert';
import { CustomExercisesProvider } from '@/contexts/CustomExercisesContext';
import { RoutineProvider } from '@/contexts/RoutineContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { VideoPlayerProvider } from '@/contexts/VideoPlayerContext';
import { WorkoutProvider } from '@/contexts/WorkoutContext';
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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
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
      SplashScreen.hideAsync();
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

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AlertProvider>
          <VideoPlayerProvider>
            <TutorialProvider>
              <CustomExercisesProvider>
                <RoutineProvider>
                  <WorkoutProvider>
                    <Stack>
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
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