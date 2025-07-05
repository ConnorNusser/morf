import Card from '@/components/Card';
import AppInfoSection from '@/components/profile/AppInfoSection';
import PersonalInformationSection from '@/components/profile/PersonalInformationSection';
import ThemeEvolutionSection from '@/components/profile/ThemeEvolutionSection';
import WorkoutFiltersSection from '@/components/profile/WorkoutFiltersSection';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { userService } from '@/lib/userService';
import { calculateOverallPercentile } from '@/lib/utils';
import { UserProfile } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

export default function ProfileScreen() {
  const { currentTheme } = useTheme();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPercentile, setUserPercentile] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const profile = await userService.getUserProfileOrDefault();
      const userProgress = await userService.calculateRealUserProgress();
      const percentile = calculateOverallPercentile(userProgress.map(p => p.percentileRanking));
      
      setUserProfile(profile);
      setUserPercentile(percentile);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setIsLoading(false);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );



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
        {/* Header */}
        <Card style={styles.headerCard} variant="subtle">
          <Text style={[
            styles.title, 
            { 
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_700Bold',
            }
          ]}>
            Profile
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

        {/* Workout Filters Section */}
        <WorkoutFiltersSection 
          onFiltersUpdate={loadUserData}
        />

        {/* App Info Section */}
        <AppInfoSection />
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
    marginBottom: 24,
    marginTop: 24,
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

}); 