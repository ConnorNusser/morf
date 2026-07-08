import { AlertProvider } from "@/components/CustomAlert";
import { CustomExercisesProvider } from "@/contexts/CustomExercisesContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { VideoPlayerProvider } from "@/contexts/VideoPlayerContext";
import { WorkoutLaunchProvider } from "@/contexts/WorkoutLaunchContext";
import { notificationService } from "@/lib/services/notificationService";
import { retentionNotificationService } from "@/lib/services/retentionNotificationService";
import { layout } from "@/lib/ui/styles";
import {
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_600SemiBold,
  Raleway_700Bold,
} from "@expo-google-fonts/raleway";
import { AppState, View } from "react-native";

import { Karla_400Regular, Karla_700Bold } from "@expo-google-fonts/karla";

import {
  Arimo_400Regular,
  Arimo_500Medium,
  Arimo_600SemiBold,
  Arimo_700Bold,
} from "@expo-google-fonts/arimo";

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";

import FontAwesome from "@expo/vector-icons/FontAwesome";
import { AudioModule } from "expo-audio";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // One useFonts call with the merged font map loads every @expo-google-fonts package.
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
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

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore: can happen with FullWindowOverlay creating new view controllers
      });
    }
  }, [loaded]);

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await AudioModule.setAudioModeAsync({
          // Mix with other apps (e.g. Spotify); silent-mode + background off for SFX
          interruptionMode: "mixWithOthers",
          playsInSilentMode: false,
          shouldPlayInBackground: false,
        });
      } catch (error) {
        console.warn("Failed to configure audio mode:", error);
      }
    };

    configureAudio();
  }, []);

  const router = useRouter();

  useEffect(() => {
    notificationService.registerForPushNotifications().catch((err) => {
      console.warn("Push notification registration skipped:", err);
    });

    const notificationSub = notificationService.addNotificationReceivedListener(
      (_notification) => {},
    );

    const responseSub = notificationService.addNotificationResponseListener(
      (response) => {
        const data = response.notification.request.content.data;
        // Retention reminders deep-link to the Notes tab ("Up Next" routine).
        if (data?.kind === "retention") {
          router.push("/(tabs)/notes");
        } else if (
          data?.type === "friend_pr" ||
          data?.type === "post_like" ||
          data?.type === "post_comment"
        ) {
          router.push("/(tabs)");
        }
      },
    );

    return () => {
      notificationSub.remove();
      responseSub.remove();
    };
  }, [router]);

  // (Re)schedule retention reminders on launch and on foreground so state stays current.
  useEffect(() => {
    retentionNotificationService.refreshScheduledReminders();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
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

// Separate component so it can read theme context.
function ThemedApp() {
  const { currentTheme } = useTheme();

  return (
    <View
      style={[
        layout.flex1,
        { backgroundColor: currentTheme.colors.background },
      ]}
    >
      <AlertProvider>
        <VideoPlayerProvider>
          <CustomExercisesProvider>
            <WorkoutLaunchProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: currentTheme.colors.background,
                  },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="(tabs)" />
              </Stack>
            </WorkoutLaunchProvider>
          </CustomExercisesProvider>
        </VideoPlayerProvider>
      </AlertProvider>
    </View>
  );
}
