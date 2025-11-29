import DashboardHeader from '@/components/DashboardHeader';
import RecapView from '@/components/history/RecapView';
import LiftDisplayFilter from '@/components/LiftDisplayFilter';
import OverallStatsCard from '@/components/OverallStatsCard';
import Spacer from '@/components/Spacer';
import { Text, View } from '@/components/Themed';
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
import { Modal, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function HomeScreen() {
  const { currentTheme } = useTheme();
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<UserProgress[]>([]);
  const [liftFilters, setLiftFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });
  const [overallStats, setOverallStats] = useState({
    overallPercentile: 0,
    strengthLevel: 'Beginner',
    improvementTrend: 'stable' as 'improving' | 'stable' | 'declining',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showRecap, setShowRecap] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [userProgress, liftFilters]);

  // Update overall stats when filtered progress changes
  useEffect(() => {
    updateOverallStats();
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
    const strengthLevel = calculatedPercentile > 0 ? getStrengthLevelName(calculatedPercentile) : 'Beginner';
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

          {/* Recap Button - Inline */}
          <TouchableOpacity
            style={styles.recapButton}
            onPress={() => setShowRecap(true)}
          >
            <Ionicons name="trophy-outline" size={14} color={currentTheme.colors.text + '60'} />
            <Text style={[styles.recapButtonText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
              View Recap
            </Text>
            <Ionicons name="chevron-forward" size={14} color={currentTheme.colors.text + '40'} />
          </TouchableOpacity>

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
              
              {filteredProgress.map((progress, index) => (
                <WorkoutStatsCard key={progress.workoutId} stats={progress} />
              ))}
            </>
          )}
        </View>
        <Spacer height={100} />
      </ScrollView>

      {/* Recap Modal */}
      <Modal visible={showRecap} animationType="slide" presentationStyle="fullScreen">
        <RecapView onClose={() => setShowRecap(false)} />
      </Modal>
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
  recapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  recapButtonText: {
    fontSize: 13,
  },
});
