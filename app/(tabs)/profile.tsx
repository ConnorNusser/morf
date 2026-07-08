import { useAlert } from '@/components/CustomAlert';
import DashboardHeader from '@/components/DashboardHeader';
import AppInfoSection from '@/components/profile/AppInfoSection';
import CareerSection from '@/components/profile/CareerSection';
import CustomExercisesSection from '@/components/profile/CustomExercisesSection';
import ExercisesSection from '@/components/profile/ExercisesSection';
import EquipmentFilterSection from '@/components/profile/EquipmentFilterSection';
import LiftDisplayPreferencesSection from '@/components/profile/LiftDisplayPreferencesSection';
import NotificationPreferencesSection from '@/components/profile/NotificationPreferencesSection';
import PersonalInformationSection from '@/components/profile/PersonalInformationSection';
import SocialModal from '@/components/profile/SocialModal';
import ThemeEvolutionSection from '@/components/profile/ThemeEvolutionSection';
import WeightUnitPreferenceSection from '@/components/profile/WeightUnitPreference';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { analyticsService } from '@/lib/services/analytics';
import { storageService } from '@/lib/storage/storage';
import { layout } from '@/lib/ui/styles';
import { danger, radius, screenGutter, space } from '@/lib/ui/tokens';
import { userService } from '@/lib/services/userService';
import { userSyncService } from '@/lib/services/userSyncService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  const { currentTheme } = useTheme();
  const ink = useInk();
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
    await userService.calculateRealUserProgress();
  };

  useEffect(() => {
    if (userProfile) {
      loadUserData();
    }
  }, [userProfile]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      loadUserData();
      loadSocialData();
    }, [refreshProfile, loadSocialData])
  );

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
              await storageService.clearWorkoutHistory();

              // Clear lifts but keep other profile info
              if (userProfile) {
                const updatedProfile = {
                  ...userProfile,
                  lifts: [],
                  secondaryLifts: [],
                };
                await storageService.saveUserProfile(updatedProfile);
              }

              await storageService.clearCustomExercises();

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

  if (isLoading) {
    return (
      <View style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text variant="body" tone="primary">Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <>
    <ScrollView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
      <View style={styles.content}>
        <DashboardHeader title="Profile" />

        <CareerSection />

        <TouchableOpacity
          style={styles.socialButton}
          onPress={() => setShowSocialModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.socialButtonContent}>
            <Ionicons name="people" size={18} color={currentTheme.colors.primary} />
            <View style={styles.socialButtonText}>
              <Text variant="body" tone="primary" weight="medium">
                {username ? `@${username}` : 'Set Username'}
              </Text>
              <Text variant="meta" tone="muted" weight="regular">
                {friendCount === 0 ? 'Add friends' : `${friendCount} friend${friendCount !== 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={ink.muted} />
        </TouchableOpacity>

        <PersonalInformationSection
          userProfile={userProfile}
        />

        <ThemeEvolutionSection />

        <LiftDisplayPreferencesSection
          onPreferencesUpdate={loadUserData}
        />

        <WeightUnitPreferenceSection />

        <NotificationPreferencesSection />

        <EquipmentFilterSection />

        <ExercisesSection />

        <CustomExercisesSection />

        <AppInfoSection />

        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetStats}
          activeOpacity={0.7}
        >
          <Text variant="body" weight="semiBold" style={styles.resetButtonText}>
            Reset All Data
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginBottom: 100 }} />
    </ScrollView>

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
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    gap: space.lg,
    paddingTop: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.card,
    marginTop: space.sm,
  },
  resetButtonText: {
    color: '#FFFFFF',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  socialButtonText: {
    gap: space.xs,
  },
}); 