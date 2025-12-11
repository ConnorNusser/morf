import Card from '@/components/Card';
import { useAlert } from '@/components/CustomAlert';
import DashboardHeader from '@/components/DashboardHeader';
import AppInfoSection from '@/components/profile/AppInfoSection';
import CustomExercisesSection from '@/components/profile/CustomExercisesSection';
import ExercisesSection from '@/components/profile/ExercisesSection';
import EquipmentFilterSection from '@/components/profile/EquipmentFilterSection';
import LiftDisplayPreferencesSection from '@/components/profile/LiftDisplayPreferencesSection';
import PersonalInformationSection from '@/components/profile/PersonalInformationSection';
import SocialModal from '@/components/profile/SocialModal';
import ThemeEvolutionSection from '@/components/profile/ThemeEvolutionSection';
import WeightUnitPreferenceSection from '@/components/profile/WeightUnitPreference';
import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/lib/services/analytics';
import { storageService } from '@/lib/storage/storage';
import { layout } from '@/lib/ui/styles';
import { userService } from '@/lib/services/userService';
import { userSyncService } from '@/lib/services/userSyncService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const { userProfile, isLoading, refreshProfile } = useUser();
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [friendCount, setFriendCount] = useState(0);

  const loadSocialData = useCallback(async () => {
    try {
      const storedUsername = await analyticsService.getUsername();
      if (storedUsername) {
        setUsername(storedUsername);
      }
      const friends = await userSyncService.getFriends();
      setFriendCount(friends.length);
    } catch (error) {
      console.error('Error loading social data:', error);
    }
  }, []);

  const loadUserData = async () => {
    // Trigger refresh of user progress data
    await userService.calculateRealUserProgress();
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
      loadSocialData();
    }, [refreshProfile, loadSocialData])
  );

  // Reset all workout stats
  const handleResetStats = () => {
    showAlert({
      title: 'Reset All Workout Data',
      message: 'This will permanently delete all your workout history, lift records, and exercise data. Your profile information (name, age, weight) will be kept.\n\nThis action cannot be undone.',
      type: 'warning',
      buttons: [
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

              showAlert({ title: 'Reset Complete', message: 'All workout data has been cleared.', type: 'success' });
            } catch (error) {
              console.error('Error resetting stats:', error);
              showAlert({ title: 'Error', message: 'Failed to reset data. Please try again.', type: 'error' });
            }
          },
        },
      ],
    });
  };

  // Show loading or create profile if no user exists
  if (isLoading) {
    return (
      <View style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.loadingText, { color: currentTheme.colors.text }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <>
    <ScrollView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
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

        {/* Social Button */}
        <TouchableOpacity
          style={[styles.socialButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
          onPress={() => setShowSocialModal(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.socialButtonContent, { backgroundColor: 'transparent' }]}>
            <Ionicons name="people" size={18} color={currentTheme.colors.primary} />
            <View style={[styles.socialButtonText, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.socialButtonTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                {username ? `@${username}` : 'Set Username'}
              </Text>
              <Text style={[styles.socialButtonSubtitle, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                {friendCount === 0 ? 'Add friends' : `${friendCount} friend${friendCount !== 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={currentTheme.colors.text + '60'} />
        </TouchableOpacity>

        {/* Personal Information Section */}
        <TutorialTarget id="profile-personal-info">
          <PersonalInformationSection
            userProfile={userProfile}
            onProfileUpdate={loadUserData}
          />
        </TutorialTarget>

        {/* Theme Evolution Section */}
        <ThemeEvolutionSection />

        {/* Lift Display Preferences Section */}
        <LiftDisplayPreferencesSection 
          onPreferencesUpdate={loadUserData}
        />

        {/* Weight Unit Preference Section */}
        <WeightUnitPreferenceSection />

        {/* Equipment Filter Section */}
        <EquipmentFilterSection />

        {/* Exercises Section */}
        <ExercisesSection />

        {/* Custom Exercises Section */}
        <CustomExercisesSection />

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

    {/* Social Modal */}
    <SocialModal
      visible={showSocialModal}
      onClose={() => {
        setShowSocialModal(false);
        loadSocialData();
      }}
    />
  </>
  );
}

const styles = StyleSheet.create({
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
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  socialButtonText: {
    gap: 2,
  },
  socialButtonTitle: {
    fontSize: 15,
  },
  socialButtonSubtitle: {
    fontSize: 13,
  },
}); 