import { useTheme } from '@/contexts/ThemeContext';
import { WorkoutSessionProvider } from '@/contexts/WorkoutSessionContext';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';

import GlobalWorkoutSessionModal from '@/components/GlobalWorkoutSessionModal';
import { HapticTab } from '@/components/HapticTab';
import ProfileIcon from '@/components/icons/ProfileIcon';
import { OnboardingModal } from '@/components/OnboardingModal';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useWorkoutSessionContext } from '@/contexts/WorkoutSessionContext';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { userService } from '@/lib/userService';
import { GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';


// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon({ iconName, focused }: {
  iconName: 'home' | 'workout' | 'profile';
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
      case 'profile':
        return <ProfileIcon color={color} size={size} />;
      default:
        return null;
    }
  };

  return getIcon();
}

function FloatingResumeButton() {
  const { currentTheme } = useTheme();
  const { activeSession, openWorkoutModal } = useWorkoutSessionContext();
  const { formattedTime } = useWorkoutTimer(activeSession?.startTime || null);

  const hasActiveSession = activeSession && !activeSession.isCompleted;

  if (!hasActiveSession) {
    return null;
  }

  const handleResumeWorkout = () => {
    if (activeSession) {
      // Create a GeneratedWorkout object from the active session for the modal
      const workoutForModal: GeneratedWorkout = {
        id: activeSession.workoutId,
        title: activeSession.title,
        description: `Resume workout with ${activeSession.exercises.length} exercises`,
        exercises: activeSession.exercises.map((ex: any) => ({
          id: ex.id,
          sets: ex.sets,
          reps: ex.reps,
        })),
        estimatedDuration: 45,
        difficulty: 'In Progress',
        createdAt: activeSession.startTime,
      };
      
      openWorkoutModal(workoutForModal);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.floatingResumeButton,
        {
          backgroundColor: currentTheme.colors.accent,
          shadowColor: currentTheme.colors.accent,
        }
      ]}
      onPress={handleResumeWorkout}
      activeOpacity={0.8}
    >
      <View style={styles.floatingButtonContent}>
        <View style={styles.resumeButtonLeft}>
          <Ionicons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.floatingButtonText}>
            Resume Workout
          </Text>
        </View>
        <View style={styles.resumeButtonRight}>
          <Text style={styles.timerText}>
            {formattedTime}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
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
            bottom: 25,
            left: 30,
            right: 30,
            height: 70,
            borderRadius: 25,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 8,
            },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 15,
          },
          default: {
            position: 'absolute',
            bottom: 25,
            left: 30,
            right: 30,
            height: 70,
            borderRadius: 25,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 15,
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
  };

  // Show loading state while checking profile
  if (isCheckingProfile) {
    return null; // Could add a loading screen here
  }

  return (
    <WorkoutSessionProvider>
      <TabsContent />
      
      {/* Floating Resume Button - positioned within navbar area */}
      <FloatingResumeButton />
      
      {/* Global Workout Session Modal */}
      <GlobalWorkoutSessionModal />
      
      {/* Onboarding Modal for first-time users */}
      <OnboardingModal 
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </WorkoutSessionProvider>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  floatingResumeButton: {
    position: 'absolute',
    bottom: 95, // Position it just above the tab bar
    left: 30, // Match the tab bar's left position exactly
    right: 30, // Match the tab bar's right position exactly
    height: 44,
    borderTopLeftRadius: 25, // Match the tab bar's border radius
    borderTopRightRadius: 25,
    borderBottomLeftRadius: 0, // Flat bottom to connect visually
    borderBottomRightRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    // Match the tab bar's shadow exactly
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 999, // Just under the tab bar to create connection illusion
    // Remove the border to make it seamless
    borderWidth: 0,
  },
  floatingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
  },
  resumeButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  resumeButtonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 60,
  },
  workoutTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
    flex: 1,
    textAlign: 'right',
    marginRight: 8,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Raleway_700Bold',
    textAlign: 'right',
  },
});
