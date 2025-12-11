import Card from '@/components/Card';
import LiftProgressionModal from '@/components/LiftProgressionModal';
import ProgressBar from '@/components/ProgressBar';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { useUser } from '@/contexts/UserContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import { convertWeightForPreference, getPercentileSuffix } from '@/lib/utils/utils';
import { getWorkoutById } from '@/lib/workout/workouts';
import { FeaturedLiftType, isFeaturedLift, UserProgress } from '@/types';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WorkoutStatsCardProps {
  stats: UserProgress;
}

export default function WorkoutStatsCard({ stats }: WorkoutStatsCardProps) {
  const { currentTheme } = useTheme();
  const { userProfile } = useUser();
  const { workoutId, personalRecord, percentileRanking } = stats;
  const [modalVisible, setModalVisible] = useState(false);

  const weightUnit = userProfile?.weightUnitPreference || 'lbs';

  const getPercentileColor = (percentile: number) => {
    const tier = getStrengthTier(percentile);
    return getTierColor(tier);
  };

  const { play: playForwardMinimal } = useSound('forwardMinimal');

  const workout = getWorkoutById(workoutId);
  
  const handleCardPress = () => {
    playHapticFeedback('medium', false);
    playForwardMinimal();
    if (isFeaturedLift(workoutId)) {
      setModalVisible(true);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={handleCardPress} activeOpacity={isFeaturedLift(workoutId) ? 0.7 : 1}>
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
            <View style={styles.tierBlock}>
              <TierBadge percentile={percentileRanking} size="medium" variant="text" />
              <Text style={[styles.tierLabel, { color: currentTheme.colors.text + '70' }]}>
                tier
              </Text>
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
                  color: getPercentileColor(percentileRanking),
                  fontFamily: 'Raleway_700Bold',
                }
              ]}>
                {convertWeightForPreference(personalRecord, 'lbs', weightUnit)} {weightUnit}
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
              color={getPercentileColor(percentileRanking)}
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

      {isFeaturedLift(workoutId) && (
        <LiftProgressionModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          liftId={workoutId as FeaturedLiftType}
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
  tierBlock: {
    alignItems: 'center',
    minWidth: 40,
  },
  tierLabel: {
    fontSize: 12,
    fontFamily: 'Raleway_500Medium',
    opacity: 0.7,
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
    marginBottom: 1,
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
    marginBottom: 1,
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