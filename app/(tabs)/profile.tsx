import Card from '@/components/Card';
import DashboardHeader from '@/components/DashboardHeader';
import AppInfoSection from '@/components/profile/AppInfoSection';
import LiftDisplayPreferencesSection from '@/components/profile/LiftDisplayPreferencesSection';
import PersonalInformationSection from '@/components/profile/PersonalInformationSection';
import ThemeEvolutionSection from '@/components/profile/ThemeEvolutionSection';
import WeightUnitPreferenceSection from '@/components/profile/WeightUnitPreference';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/hooks/useUser';
import { storageService } from '@/lib/storage';
import { userService } from '@/lib/userService';
import { calculateOverallPercentile } from '@/lib/utils';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  const { currentTheme } = useTheme();
  const { userProfile, isLoading, refreshProfile } = useUser();
  const [userPercentile, setUserPercentile] = useState(0);

  const loadUserData = async () => {
    try {
      const userProgress = await userService.calculateRealUserProgress();
      const percentile = calculateOverallPercentile(userProgress.map(p => p.percentileRanking));
      setUserPercentile(percentile);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  useEffect(() => {
    if (userProfile) {
      loadUserData();
    }
  }, [userProfile]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      loadUserData();
    }, [refreshProfile])
  );

  // Reset all workout stats
  const handleResetStats = () => {
    Alert.alert(
      'Reset All Workout Data',
      'This will permanently delete all your workout history, lift records, and exercise data. Your profile information (name, age, weight) will be kept.\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear workout history
              await storageService.clearWorkoutHistory();

              // Clear lifts from user profile but keep other info
              if (userProfile) {
                const updatedProfile = {
                  ...userProfile,
                  lifts: [],
                  secondaryLifts: [],
                };
                await storageService.saveUserProfile(updatedProfile);
              }

              // Clear custom exercises
              await storageService.clearCustomExercises();

              // Refresh profile
              await refreshProfile();
              await loadUserData();

              Alert.alert('Reset Complete', 'All workout data has been cleared.');
            } catch (error) {
              console.error('Error resetting stats:', error);
              Alert.alert('Error', 'Failed to reset data. Please try again.');
            }
          },
        },
      ]
    );
  };



  // Show loading or create profile if no user exists
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.loadingText, { color: currentTheme.colors.text }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <View style={[styles.content, { backgroundColor: 'transparent' }]}>
        {/* Morf Logo and Brand */}
        <DashboardHeader />

        {/* Header */}
        <Card style={styles.headerCard} variant="subtle">
          <Text style={[
            styles.title, 
            { 
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_700Bold',
            }
          ]}>
            Profile Settings
          </Text>
          <Text style={[
            styles.subtitle, 
            { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_400Regular',
            }
          ]}>
            Customize your experience
          </Text>
        </Card>

        {/* Personal Information Section */}
        <PersonalInformationSection 
          userProfile={userProfile} 
          onProfileUpdate={loadUserData}
        />

        {/* Theme Evolution Section */}
        <ThemeEvolutionSection />

        {/* Lift Display Preferences Section */}
        <LiftDisplayPreferencesSection 
          onPreferencesUpdate={loadUserData}
        />

        {/* Weight Unit Preference Section */}
        <WeightUnitPreferenceSection />

        {/* App Info Section */}
        <AppInfoSection />

        {/* Reset Button */}
        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetStats}
          activeOpacity={0.7}
        >
          <Text style={[styles.resetButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
            Reset All Data
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginBottom: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingTop: 48
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  createProfileCard: {
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  createProfileIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  createProfileTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  createProfileDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  createProfileButton: {
    width: '100%',
  },
  headerCard: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  resetButton: {
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
}); 