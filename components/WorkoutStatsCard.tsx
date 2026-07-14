import Card from '@/components/Card';
import LiftProgressionModal from '@/components/LiftProgressionModal';
import { Text, useInk } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useSound } from '@/hooks/useSound';
import { useUser } from '@/contexts/UserContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getPercentileColor, getTierColor } from '@/lib/data/strengthStandards';
import { gradeE1rm } from '@/lib/history/liftProgress';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { space } from '@/lib/ui/tokens';
import { convertWeightForPreference, getPercentileSuffix } from '@/lib/utils/utils';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { convertWeight, FeaturedLiftType, isFeaturedLift, UserProgress } from '@/types';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

interface WorkoutStatsCardProps {
  stats: UserProgress;
  // Stagger offset (ms) so a list of cards sweeps in sequence, career-style.
  delay?: number;
}

export default function WorkoutStatsCard({ stats, delay = 0 }: WorkoutStatsCardProps) {
  const ink = useInk();
  const { userProfile } = useUser();
  const { workoutId, personalRecord, percentileRanking } = stats;
  const [modalVisible, setModalVisible] = useState(false);

  const weightUnit = userProfile?.weightUnitPreference || 'lbs';


  const { play: playForwardMinimal } = useSound('forwardMinimal');

  const workout = getCatalogExercise(workoutId);
  const accentColor = getPercentileColor(percentileRanking);
  const band = getTierBandProgress(percentileRanking);

  // Lifters think in weight, not percentile points: show the lbs/kg still
  // to lift for the next tier when the profile can grade it (bodyweight +
  // gender known); otherwise fall back to the percentile phrasing.
  const grade =
    userProfile?.weight && userProfile.gender
      ? gradeE1rm(workoutId, personalRecord, weightUnit, {
          bodyweightLbs: convertWeight(userProfile.weight.value, userProfile.weight.unit, 'lbs'),
          gender: userProfile.gender,
          age: userProfile.age,
        })
      : undefined;

  // Sweep the fill from 0 on mount so post-workout arrival (remount) animates instead of snapping.
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: Math.max(3, Math.min(100, percentileRanking)),
      duration: 800,
      delay,
      useNativeDriver: false,
    }).start();
  }, [percentileRanking, fill, delay]);
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

          <View style={[styles.track, { backgroundColor: ink.hairline }]}>
            <Animated.View
              style={[
                styles.trackFill,
                { width: fillWidth, backgroundColor: accentColor },
              ]}
            />
          </View>

          {grade?.nextTier && grade.gapWeight != null ? (
            <View style={styles.nextRow}>
              <Text variant="meta" tone="muted">
                +{grade.gapWeight} {weightUnit}
                {' to '}
                <Text
                  variant="meta"
                  weight="semiBold"
                  style={{ color: getTierColor(grade.nextTier) }}
                >
                  {grade.nextTier}
                </Text>
              </Text>
            </View>
          ) : band.nextTier ? (
            <View style={styles.nextRow}>
              <Text variant="meta" tone="muted">
                {band.toNext}
                {' to '}
                <Text
                  variant="meta"
                  weight="semiBold"
                  style={{ color: getTierColor(band.nextTier) }}
                >
                  {band.nextTier}
                </Text>
              </Text>
            </View>
          ) : null}
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
  nextRow: {
    alignItems: 'flex-end',
    marginTop: space.sm,
  },
});
