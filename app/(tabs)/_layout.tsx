import { useTheme } from '@/contexts/ThemeContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { UserProvider } from '@/contexts/UserContext';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import ProfileIcon from '@/components/icons/ProfileIcon';
import { OnboardingModal } from '@/components/OnboardingModal';
import { TutorialOverlay } from '@/components/tutorial';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { userService } from '@/lib/userService';
import { Ionicons } from '@expo/vector-icons';


// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon({ iconName, focused }: {
  iconName: 'home' | 'workout' | 'history' | 'profile';
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
        return <Ionicons name="add" size={28} color={color} />;
      case 'history':
        return <Ionicons name="time-outline" size={22} color={color} />;
      case 'profile':
        return <ProfileIcon color={color} size={size} />;
      default:
        return null;
    }
  };

  return getIcon();
}

function TabsContent() {
  const { currentTheme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: currentTheme.colors.primary,
        tabBarInactiveTintColor: '#8E8E93',
        tabBarShowLabel: false, // Hide labels for minimalist look
        tabBarItemStyle: {
          paddingVertical: 12,
          marginHorizontal: 8,
          borderRadius: 16,
        },
        headerStyle: {
          backgroundColor: currentTheme.colors.background,
        },
        headerTintColor: currentTheme.colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 85,
            borderRadius: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: -4,
            },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 10,
          },
          default: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 85,
            borderRadius: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 10,
          },
        }),
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
  );
}

