import { useTheme } from '@/contexts/ThemeContext';
import { TabBarProvider, useTabBar } from '@/contexts/TabBarContext';
import { UserProvider } from '@/contexts/UserContext';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { HapticTab } from '@/components/HapticTab';
import ProfileIcon from '@/components/icons/ProfileIcon';
import { HistoryIcon, HomeIcon, RoutinesIcon, WorkoutIcon } from '@/components/icons/TabIcons';
import { OnboardingModal } from '@/components/OnboardingModal';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { userService } from '@/lib/services/userService';


function TabBarIcon({ iconName, focused }: {
  iconName: 'home' | 'workout' | 'history' | 'routines' | 'profile';
  focused: boolean;
}) {
  const { currentTheme } = useTheme();
  const color = focused ? currentTheme.colors.primary : '#8E8E93';

  // One monoline family (see components/icons/TabIcons.tsx); the center
  // workout tab runs larger, matching the old "+".
  const getIcon = () => {
    switch (iconName) {
      case 'home':
        return <HomeIcon size={22} color={color} />;
      case 'workout':
        return <WorkoutIcon size={28} color={color} />;
      case 'history':
        return <HistoryIcon size={22} color={color} />;
      case 'routines':
        return <RoutinesIcon size={22} color={color} />;
      case 'profile':
        return <ProfileIcon color={color} size={22} />;
      default:
        return null;
    }
  };

  return getIcon();
}

// Tab bar with transparent background on scroll
function AnimatedTabBar(props: BottomTabBarProps) {
  const { tabBarBackgroundVisible } = useTabBar();
  const { currentTheme } = useTheme();

  const backgroundAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(tabBarBackgroundVisible.value, {
        duration: 200,
      }),
    };
  });

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
              {options.tabBarIcon?.({ focused: isFocused, color: isFocused ? currentTheme.colors.primary : '#8E8E93', size: 24 })}
            </HapticTab>
          );
        })}
      </View>
    </Animated.View>
  );
}

function TabsContent() {
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
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
        name="routines"
        options={{
          title: 'Routines',
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="routines" focused={focused} />
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

  if (isCheckingProfile) {
    return null;
  }

  return (
    <TabBarProvider>
      <UserProvider>
        <TabsContent />

        <OnboardingModal
          visible={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
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
});
