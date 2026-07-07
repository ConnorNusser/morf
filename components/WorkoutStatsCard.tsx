import Card from '@/components/Card';
import LiftProgressionModal from '@/components/LiftProgressionModal';
import { Text, useInk } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useSound } from '@/hooks/useSound';
import { useUser } from '@/contexts/UserContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getPercentileColor } from '@/lib/data/strengthStandards';
import { space } from '@/lib/ui/tokens';
import { convertWeightForPreference, getPercentileSuffix } from '@/lib/utils/utils';
import { getWorkoutById } from '@/lib/workout/workouts';
import { FeaturedLiftType, isFeaturedLift, UserProgress } from '@/types';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

interface WorkoutStatsCardProps {
  stats: UserProgress;
}

export default function WorkoutStatsCard({ stats }: WorkoutStatsCardProps) {
  const ink = useInk();
  const { userProfile } = useUser();
  const { workoutId, personalRecord, percentileRanking } = stats;
  const [modalVisible, setModalVisible] = useState(false);

  const weightUnit = userProfile?.weightUnitPreference || 'lbs';


  const { play: playForwardMinimal } = useSound('forwardMinimal');

  const workout = getWorkoutById(workoutId);
  const accentColor = getPercentileColor(percentileRanking);

  // Sweep the fill up from 0 on mount — so on a post-workout arrival (the section
  // remounts) the lift bars visibly fill instead of snapping to width.
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: Math.max(3, Math.min(100, percentileRanking)),
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [percentileRanking, fill]);
  const fillWidth = fill.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

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
        <Card>
          <View style={styles.header}>
            <Text
              variant="emphasis"
              weight="semiBold"
              style={[styles.workoutName, { color: accentColor }]}
            >
              {workout?.name}
            </Text>
            <TierBadge percentile={percentileRanking} size="medium" variant="text" />
          </View>

          <View style={styles.statRow}>
            <Text variant="statHero" weight="bold" style={{ color: accentColor }}>
              {convertWeightForPreference(personalRecord, 'lbs', weightUnit)}
              <Text variant="meta" weight="medium" style={{ color: accentColor }}> {weightUnit}</Text>
            </Text>
            <Text variant="meta" weight="medium" tone="secondary">
              {percentileRanking}
              {getPercentileSuffix(percentileRanking)} percentile
            </Text>
          </View>

          {/* Tier-coloured strength bar — matches the Big-3 total's bar language */}
          <View style={[styles.track, { backgroundColor: ink.hairline }]}>
            <Animated.View
              style={[
                styles.trackFill,
                { width: fillWidth, backgroundColor: accentColor },
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  workoutName: {
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.md,
  },
  track: {
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 5,
  },
});
