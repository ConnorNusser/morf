import { useTheme } from '@/contexts/ThemeContext';
import { TabBarProvider, useTabBar } from '@/contexts/TabBarContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { UserProvider } from '@/contexts/UserContext';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { HapticTab } from '@/components/HapticTab';
import ProfileIcon from '@/components/icons/ProfileIcon';
import { OnboardingModal } from '@/components/OnboardingModal';
import { TutorialOverlay } from '@/components/tutorial';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { userService } from '@/lib/services/userService';
import { Ionicons } from '@expo/vector-icons';


// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon({ iconName, focused }: {
  iconName: 'home' | 'workout' | 'history' | 'notes' | 'profile';
  focused: boolean;
}) {
  const { currentTheme } = useTheme();
  const color = focused ? currentTheme.colors.primary : '#8E8E93';
  const size = 24;

  const getIcon = () => {
    switch (iconName) {
      case 'home':
        return <Ionicons name="home" size={20} color={color} />;
      case 'workout':
        return <Ionicons name="add" size={28} color={color} style={{ marginTop: -4 }} />;
      case 'history':
        return <Ionicons name="time-outline" size={22} color={color} />;
      case 'notes':
        return <Ionicons name="document-text-outline" size={20} color={color} />;
      case 'profile':
        return <ProfileIcon color={color} size={size} />;
      default:
        return null;
    }
  };

  return getIcon();
}

// Pulsing glow indicator for tutorial
function TutorialTabIndicator({ color }: { color: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0.3, { duration: 600 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.tutorialIndicator,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

// Tab bar with transparent background on scroll
function AnimatedTabBar(props: BottomTabBarProps) {
  const { tabBarBackgroundVisible } = useTabBar();
  const { currentTheme } = useTheme();
  const { showTutorial } = useTutorial();

  const backgroundAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(tabBarBackgroundVisible.value, {
        duration: 200,
      }),
    };
  });

  // Get the default tab bar from navigation
  const { state, descriptors, navigation } = props;

  return (
    <Animated.View style={styles.tabBarContainer}>
      <Animated.View style={[styles.tabBarBackground, backgroundAnimatedStyle]}>
        <TabBarBackground />
      </Animated.View>
      <View style={styles.tabBarContent}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <HapticTab
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[
                styles.tabItem,
                { backgroundColor: isFocused ? currentTheme.colors.primary + '15' : 'transparent' }
              ]}
            >
              {/* Pulsing indicator during tutorial */}
              {showTutorial && isFocused && (
                <TutorialTabIndicator color={currentTheme.colors.primary} />
              )}
              {options.tabBarIcon?.({ focused: isFocused, color: isFocused ? currentTheme.colors.primary : '#8E8E93', size: 24 })}
            </HapticTab>
          );
        })}
      </View>
    </Animated.View>
  );
}

function TabsContent() {
  const { currentTheme } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: currentTheme.colors.primary,
        tabBarInactiveTintColor: '#8E8E93',
        tabBarShowLabel: false,
        headerStyle: {
          backgroundColor: currentTheme.colors.background,
        },
        headerTintColor: currentTheme.colors.primary,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="history" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="workout" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="notes" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const { startTutorial, tutorialState, isLoading: isTutorialLoading } = useTutorial();

  useEffect(() => {
    checkForFirstTimeUser();
  }, []);

  const checkForFirstTimeUser = async () => {
    try {
      const existingProfile = await userService.getRealUserProfile();

      if (!existingProfile) {
        // No profile exists - show onboarding
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Start the tutorial for first-time users after onboarding
    if (!tutorialState.hasCompletedAppTutorial) {
      // Small delay to let the onboarding modal close smoothly
      setTimeout(() => {
        startTutorial();
      }, 500);
    }
  };

  // Show loading state while checking profile
  if (isCheckingProfile || isTutorialLoading) {
    return null; // Could add a loading screen here
  }

  return (
    <TabBarProvider>
      <UserProvider>
        <TabsContent />

        {/* Onboarding Modal for first-time users */}
        <OnboardingModal
          visible={showOnboarding}
          onComplete={handleOnboardingComplete}
        />

        {/* Tutorial Overlay - shown after onboarding */}
        <TutorialOverlay />
      </UserProvider>
    </TabBarProvider>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 85,
  },
  tabBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabBarContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 16,
  },
  tutorialIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
