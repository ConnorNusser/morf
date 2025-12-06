import DashboardHeader from '@/components/DashboardHeader';
import LiftDisplayFilter from '@/components/LiftDisplayFilter';
import OverallStatsCard from '@/components/OverallStatsCard';
import LeaderboardModal from '@/components/profile/LeaderboardModal';
import SkeletonCard from '@/components/SkeletonCard';
import Spacer from '@/components/Spacer';
import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial';
import WorkoutStatsCard from '@/components/WorkoutStatsCard';
import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage';
import { getStrengthLevelName } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { calculateOverallPercentile } from '@/lib/utils';
import { LiftDisplayFilters, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function HomeScreen() {
  const { currentTheme } = useTheme();
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<UserProgress[]>([]);
  const [liftFilters, setLiftFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });
  const [overallStats, setOverallStats] = useState({
    overallPercentile: 0,
    strengthLevel: 'E-',
    improvementTrend: 'stable' as 'improving' | 'stable' | 'declining',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyFilters is stable, only re-run on data changes
  }, [userProgress, liftFilters]);

  // Update overall stats when filtered progress changes
  useEffect(() => {
    updateOverallStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateOverallStats is stable, only re-run on data changes
  }, [filteredProgress]);

  const loadUserData = async () => {
    try {
      // Ensure user profile exists (this will create default if needed)
      await userService.getUserProfileOrDefault();
      
      const [userProgressData, savedFilters] = await Promise.all([
        userService.getAllFeaturedLifts(),
        storageService.getLiftDisplayFilters()
      ]);
      
      setUserProgress(userProgressData);
      setLiftFilters(savedFilters);

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    const filtered = userProgress.filter(progress => 
      !liftFilters.hiddenLiftIds.includes(progress.workoutId)
    );
    setFilteredProgress(filtered);
  };

  const updateOverallStats = () => {
    const percentiles = filteredProgress.map(p => p.percentileRanking);
    const calculatedPercentile = percentiles.length > 0 ? calculateOverallPercentile(percentiles) : 0;
    const strengthLevel = calculatedPercentile > 0 ? getStrengthLevelName(calculatedPercentile) : 'E-';
    setOverallStats({
      overallPercentile: calculatedPercentile,
      strengthLevel,
      improvementTrend: 'improving',
    });
  };

  const handleFiltersChanged = (newFilters: LiftDisplayFilters) => {
    setLiftFilters(newFilters);
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  if (isLoading) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
          <DashboardHeader />
          <SkeletonCard variant="overall" />
          <SkeletonCard variant="button" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </View>
        <Spacer height={100} />
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
          <DashboardHeader />

          <TutorialTarget id="home-overall-stats">
            <OverallStatsCard stats={overallStats} />
          </TutorialTarget>

          {/* Leaderboard Button */}
          <TutorialTarget id="home-leaderboard-button">
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
              onPress={() => setShowLeaderboard(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                View Leaderboards
              </Text>
              <Ionicons name="chevron-forward" size={18} color={currentTheme.colors.text + '60'} />
            </TouchableOpacity>
          </TutorialTarget>

          {userProgress.length > 0 && (
            <>
              <View>
                <Text style={[
                  styles.sectionTitle,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
                    marginBottom: 0,
                  }
                ]}>
                  Your Lifts
                </Text>

                <LiftDisplayFilter
                  availableLifts={userProgress}
                  onFiltersChanged={handleFiltersChanged}
                />
              </View>

              <TutorialTarget id="home-lift-cards">
                <View style={{ gap: 20 }}>
                  {filteredProgress.map((progress) => (
                    <WorkoutStatsCard key={progress.workoutId} stats={progress} />
                  ))}
                </View>
              </TutorialTarget>
            </>
          )}
        </View>
        <Spacer height={100} />
      </ScrollView>

      {/* Leaderboard Modal */}
      <LeaderboardModal
        visible={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
  },
});
