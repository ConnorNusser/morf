import Card from '@/components/Card';
import LiftProgressionModal from '@/components/LiftProgressionModal';
import ProgressBar from '@/components/ProgressBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { userService } from '@/lib/userService';
import { getPercentileSuffix, getWeightBasedonPreference } from '@/lib/utils';
import { getWorkoutById } from '@/lib/workouts';
import { isMainLift, MainLiftType, UserProfile, UserProgress } from '@/types';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WorkoutStatsCardProps {
  stats: UserProgress;
}

export default function WorkoutStatsCard({ stats }: WorkoutStatsCardProps) {
  const { currentTheme } = useTheme();
  const { workoutId, personalRecord, percentileRanking, strengthLevel } = stats;
  const [modalVisible, setModalVisible] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await userService.getUserProfileOrDefault();
      setProfile(profile);
    };
    loadProfile();
  }, []);

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 90) return currentTheme.colors.accent;
    if (percentile >= 75) return currentTheme.colors.primary;
    if (percentile >= 50) return '#FFA500'; // Orange
    return '#FF6B6B'; // Red
  };

  const { play: playForwardMinimal } = useSound('forwardMinimal');

  const workout = getWorkoutById(workoutId);
  
  const handleCardPress = () => {
    playHapticFeedback('medium', false);
    playForwardMinimal();
    if (isMainLift(workoutId)) {
      setModalVisible(true);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={handleCardPress} activeOpacity={isMainLift(workoutId) ? 0.7 : 1}>
        <Card variant="elevated" style={styles.container}>
          <View style={styles.header}>
            <Text style={[
              styles.workoutName, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              {workout?.name}
            </Text>
            <View style={styles.headerRight}>
              <View style={[styles.percentileBadge, { backgroundColor: getPercentileColor(percentileRanking) }]}>
                <Text style={[
                  styles.percentileText, 
                  { 
                    color: currentTheme.colors.background,
                    fontFamily: 'Raleway_600SemiBold',
                  }
                ]}>
                  {strengthLevel}
                </Text>
              </View>
              {isMainLift(workoutId) && (
                <Text style={[styles.tapHint, { color: currentTheme.colors.text + '60' }]}>
                  Tap for details
                </Text>
              )}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.prSection}>
              <Text style={[
                styles.prLabel, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Personal Record
              </Text>
              <Text style={[
                styles.prValue, 
                { 
                  color: currentTheme.colors.primary,
                  fontFamily: 'Raleway_700Bold',
                }
              ]}>
                {getWeightBasedonPreference(personalRecord, 'lbs')} {profile?.weightUnitPreference === 'kg' ? 'kg' : 'lbs'}
              </Text>
            </View>

            <View style={styles.percentileSection}>
              <Text style={[
                styles.percentileLabel, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Percentile Ranking
              </Text>
              <Text style={[
                styles.percentileValue, 
                { 
                  color: getPercentileColor(percentileRanking),
                  fontFamily: 'Raleway_700Bold',
                }
              ]}>
                {percentileRanking}{getPercentileSuffix(percentileRanking)}
              </Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <ProgressBar 
              progress={percentileRanking} 
              height={8}
              style={styles.progressBar}
              currentWeight={personalRecord}
              exerciseName={workoutId}
            />
            <Text style={[
              styles.progressText, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              Better than {percentileRanking}% of lifters
            </Text>
          </View>
        </Card>
      </TouchableOpacity>

      {isMainLift(workoutId) && (
        <LiftProgressionModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          liftId={workoutId as MainLiftType}
          workoutName={workout?.name || 'Lift'}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  percentileBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 2,
  },
  tapHint: {
    fontSize: 10,
    fontFamily: 'Raleway_400Regular',
  },
  percentileText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  prSection: {
    flex: 1,
  },
  prLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  prValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  percentileSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  percentileLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  percentileValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  progressSection: {
    marginTop: 8,
  },
  progressBar: {
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
}); 