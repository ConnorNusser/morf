import { Text, View } from '@/components/Themed';
import AnimatedCounter from '@/components/workout/workoutComplete/AnimatedCounter';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { space, track, trend } from '@/lib/ui/tokens';
import { type } from '@/lib/ui/typography';
import React, { useEffect, useRef } from 'react';
import { Animated as RNAnimated, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

export interface PercentileMove {
  before: number;
  after: number;
}

// Percentile sweep: before → after with the tier color. RN Animated (not
// reanimated) because `from` is dynamic and the pattern matches WorkoutStatsCard.
function ProgressionBar({ from, to, color }: { from: number; to: number; color: string }) {
  const fill = useRef(new RNAnimated.Value(Math.max(2, Math.min(100, from)))).current;
  useEffect(() => {
    RNAnimated.timing(fill, {
      toValue: Math.max(2, Math.min(100, to)),
      duration: 1100,
      delay: 500,
      useNativeDriver: false,
    }).start();
  }, [to, fill]);
  const width = fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View style={styles.progressTrack}>
      <RNAnimated.View style={[styles.progressFill, { width, backgroundColor: color }]} />
    </View>
  );
}

// The percentile progression this session earned — the Career hero's language.
export default function ProgressionSection({ move }: { move: PercentileMove }) {
  // A 0 "before" means this is the first percentile ever computed — a delta
  // against nothing reads as noise, so only show earned movement.
  const delta = move.before > 0 ? move.after - move.before : 0;
  const tier = getStrengthTier(move.after);
  const color = getTierColor(tier);
  const band = getTierBandProgress(move.after);

  return (
    <Animated.View entering={FadeIn.delay(400)} style={styles.progressSection}>
      <View style={styles.progressHead}>
        <Text variant="meta" weight="bold" style={styles.progressLabel}>
          OVERALL STRENGTH
        </Text>
        <View style={styles.progressValueRow}>
          {delta > 0 && (
            <Text variant="meta" weight="bold" style={{ color: trend.up }}>
              +{delta}
            </Text>
          )}
          <AnimatedCounter value={move.after} delay={500} duration={1100} style={styles.progressNum} />
          <Text variant="meta" style={styles.progressValue}>
            percentile
          </Text>
        </View>
      </View>
      <ProgressionBar from={move.before} to={move.after} color={color} />
      <Text variant="meta" style={styles.progressCaption}>
        {band.nextTier ? (
          <>
            <Text variant="meta" weight="semiBold" style={styles.progressCaptionStrong}>
              {band.toNext}
            </Text>
            {' to '}
            <Text variant="meta" weight="semiBold" style={{ color: getTierColor(band.nextTier) }}>
              {band.nextTier}
            </Text>
          </>
        ) : (
          'Max tier reached'
        )}
      </Text>
    </Animated.View>
  );
}

// White-alpha palette is a named exception (screen is always dark); 28/32/36 rhythm is structural.
const styles = StyleSheet.create({
  progressSection: {
    width: '100%',
    marginBottom: 28,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: track.caps,
  },
  progressValue: {
    color: 'rgba(255,255,255,0.55)',
  },
  progressValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
  },
  progressNum: {
    fontSize: type.emphasis,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressCaption: {
    color: 'rgba(255,255,255,0.45)',
    marginTop: space.sm,
    textAlign: 'right',
  },
  progressCaptionStrong: {
    color: 'rgba(255,255,255,0.75)',
  },
});
