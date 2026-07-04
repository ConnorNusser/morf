import Card from '@/components/Card';
import LiftProgressionModal from '@/components/LiftProgressionModal';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { useUser } from '@/contexts/UserContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getPercentileColor } from '@/lib/data/strengthStandards';
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


  const { play: playForwardMinimal } = useSound('forwardMinimal');

  const workout = getWorkoutById(workoutId);
  const accentColor = getPercentileColor(percentileRanking);

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
            <Text style={[styles.workoutName, { color: currentTheme.colors.text }]}>
              {workout?.name}
            </Text>
            <TierBadge percentile={percentileRanking} size="medium" variant="text" />
          </View>

          <View style={styles.statRow}>
            <Text style={[styles.prValue, { color: currentTheme.colors.text }]}>
              {convertWeightForPreference(personalRecord, 'lbs', weightUnit)}
              <Text style={styles.prUnit}> {weightUnit}</Text>
            </Text>
            <Text style={[styles.percentile, { color: currentTheme.colors.text + '99' }]}>
              {percentileRanking}
              {getPercentileSuffix(percentileRanking)} percentile
            </Text>
          </View>

          {/* Subtle progress track — soft fill, no hard border */}
          <View style={[styles.track, { backgroundColor: currentTheme.colors.text + '12' }]}>
            <View
              style={[
                styles.trackFill,
                {
                  width: `${Math.max(0, Math.min(100, percentileRanking))}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
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
    marginBottom: 12,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  prValue: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  prUnit: {
    fontSize: 15,
    fontWeight: '500',
  },
  percentile: {
    fontSize: 13,
    fontWeight: '500',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
});
