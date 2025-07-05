import ComingSoonFeaturesCard from '@/components/ComingSoonFeaturesCard';
import DashboardHeader from '@/components/DashboardHeader';
import ExclusiveFeaturesModal from '@/components/ExclusiveFeaturesModal';
import OverallStatsCard from '@/components/OverallStatsCard';
import Spacer from '@/components/Spacer';
import { Text, View } from '@/components/Themed';
import WorkoutStatsCard from '@/components/WorkoutStatsCard';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthLevelName } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { calculateOverallPercentile } from '@/lib/utils';
import { UserProgress } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

export default function HomeScreen() {
  const { currentTheme } = useTheme();
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [overallStats, setOverallStats] = useState({
    overallPercentile: 0,
    strengthLevel: 'Beginner',
    improvementTrend: 'stable' as 'improving' | 'stable' | 'declining',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [exclusiveFeaturesModalVisible, setExclusiveFeaturesModalVisible] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Ensure user profile exists (this will create default if needed)
      await userService.getUserProfileOrDefault();
      
      const userProgress = await userService.getUsersTopLifts();
      setUserProgress(userProgress);

      const percentiles = userProgress.map(p => p.percentileRanking);
      const calculatedPercentile = percentiles.length > 0 ? calculateOverallPercentile(percentiles) : 0;
      const strengthLevel = calculatedPercentile > 0 ? getStrengthLevelName(calculatedPercentile) : 'Beginner';
      setOverallStats({
        overallPercentile: calculatedPercentile,
        strengthLevel,
        improvementTrend: 'improving',
      });

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
    <>
      <ScrollView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
          <DashboardHeader />

          <OverallStatsCard stats={overallStats} />

          {userProgress.length > 0 && (
            <>
              <Text style={[
                styles.sectionTitle, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
                }
              ]}>
                Your Lifts
              </Text>
              {userProgress.map((progress, index) => (
                <WorkoutStatsCard key={progress.workoutId} stats={progress} />
              ))}
            </>
          )}
          <ComingSoonFeaturesCard
            userPercentile={overallStats.overallPercentile}
            onPress={() => {}}
          />

          {/* <ExclusiveFeaturesCard 
            userPercentile={overallStats.overallPercentile} 
            onPress={() => setExclusiveFeaturesModalVisible(true)}
          /> */}
        </View>
        <Spacer height={100} />
      </ScrollView>

      <ExclusiveFeaturesModal
        visible={exclusiveFeaturesModalVisible}
        onClose={() => setExclusiveFeaturesModalVisible(false)}
        userPercentile={overallStats.overallPercentile}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 10,
  },
  noDataCard: {
    padding: 24,
    alignItems: 'center',
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
