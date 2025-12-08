import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import Card from './Card';

interface SkeletonCardProps {
  style?: ViewStyle;
  variant?: 'stats' | 'overall' | 'button' | 'leaderboard-row' | 'profile-header' | 'feed';
}

interface SkeletonLineProps {
  width: DimensionValue;
  height?: number;
  style?: ViewStyle;
}

const SkeletonLine = ({ width, height = 16, style }: SkeletonLineProps) => {
  const { currentTheme } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.skeletonLine,
        {
          width,
          height,
          backgroundColor: currentTheme.colors.border,
        },
        { opacity },
        style,
      ]}
    />
  );
};

export default function SkeletonCard({ style, variant = 'stats' }: SkeletonCardProps) {
  const { currentTheme } = useTheme();

  if (variant === 'button') {
    return (
      <View style={[styles.buttonSkeleton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }, style]}>
        <SkeletonLine width="50%" height={14} />
      </View>
    );
  }

  if (variant === 'leaderboard-row') {
    return (
      <View style={[styles.leaderboardRow, style]}>
        {/* Rank circle */}
        <SkeletonLine width={28} height={28} style={{ borderRadius: 14 }} />
        {/* User info */}
        <View style={styles.leaderboardUserInfo}>
          <SkeletonLine width={100} height={15} />
          <SkeletonLine width={60} height={12} style={{ marginTop: 4 }} />
        </View>
        {/* Value */}
        <SkeletonLine width={50} height={16} />
      </View>
    );
  }

  if (variant === 'profile-header') {
    return (
      <View style={[styles.profileHeader, style]}>
        {/* Avatar circle */}
        <SkeletonLine width={60} height={60} style={{ borderRadius: 30 }} />
        {/* User info */}
        <View style={styles.profileInfo}>
          <SkeletonLine width={120} height={18} />
          <SkeletonLine width={80} height={14} style={{ marginTop: 6 }} />
        </View>
      </View>
    );
  }

  if (variant === 'feed') {
    return (
      <View style={[styles.feedCard, { borderBottomColor: currentTheme.colors.border }, style]}>
        {/* Header with avatar, username, time, and tier badge */}
        <View style={styles.feedHeader}>
          <View style={styles.feedUserInfo}>
            <SkeletonLine width={44} height={44} style={{ borderRadius: 22 }} />
            <View style={{ gap: 6 }}>
              <SkeletonLine width={90} height={14} />
              <SkeletonLine width={50} height={12} />
            </View>
          </View>
          <SkeletonLine width={36} height={26} style={{ borderRadius: 10 }} />
        </View>

        {/* Workout title */}
        <SkeletonLine width="75%" height={22} style={{ marginTop: 12 }} />

        {/* Stats row */}
        <SkeletonLine width="60%" height={14} style={{ marginTop: 10 }} />

        {/* PPL chips */}
        <View style={styles.feedChips}>
          <SkeletonLine width={70} height={28} style={{ borderRadius: 16 }} />
          <SkeletonLine width={60} height={28} style={{ borderRadius: 16 }} />
        </View>

        {/* Exercise rows */}
        <View style={styles.feedExercises}>
          <View style={styles.feedExerciseRow}>
            <SkeletonLine width="50%" height={15} />
            <SkeletonLine width={60} height={14} />
          </View>
          <View style={styles.feedExerciseRow}>
            <SkeletonLine width="45%" height={15} />
            <SkeletonLine width={55} height={14} />
          </View>
          <View style={styles.feedExerciseRow}>
            <SkeletonLine width="55%" height={15} />
            <SkeletonLine width={50} height={14} />
          </View>
        </View>

        {/* Action bar */}
        <View style={styles.feedActions}>
          <View style={styles.feedActionButtons}>
            <SkeletonLine width={50} height={32} style={{ borderRadius: 10 }} />
            <SkeletonLine width={50} height={32} style={{ borderRadius: 10 }} />
          </View>
        </View>
      </View>
    );
  }

  if (variant === 'overall') {
    return (
      <Card variant="elevated" style={StyleSheet.flatten([styles.container, style])}>
        {/* Title */}
        <View style={{ marginBottom: 20 }}>
          <SkeletonLine width="60%" height={20} />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <View style={{ marginBottom: 8 }}>
              <SkeletonLine width={60} height={36} />
            </View>
            <SkeletonLine width={70} height={14} />
          </View>
          <View style={[styles.statBlock, { alignItems: 'flex-end' }]}>
            <View style={{ marginBottom: 8 }}>
              <SkeletonLine width={50} height={24} />
            </View>
            <SkeletonLine width={30} height={14} />
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ marginTop: 24 }}>
          <SkeletonLine width="100%" height={12} style={{ borderRadius: 6 }} />
          <SkeletonLine width="40%" height={12} style={{ marginTop: 12, alignSelf: 'center' }} />
        </View>
      </Card>
    );
  }

  // Default: stats card
  return (
    <Card variant="elevated" style={StyleSheet.flatten([styles.container, style])}>
      {/* Header */}
      <View style={styles.header}>
        <SkeletonLine width="45%" height={18} />
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            <SkeletonLine width={50} height={24} />
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <View style={{ marginBottom: 6 }}>
            <SkeletonLine width={80} height={12} />
          </View>
          <SkeletonLine width={100} height={24} />
        </View>
        <View style={[styles.statBlock, { alignItems: 'flex-end' }]}>
          <View style={{ marginBottom: 6 }}>
            <SkeletonLine width={100} height={12} />
          </View>
          <SkeletonLine width={60} height={24} />
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginTop: 16 }}>
        <SkeletonLine width="100%" height={8} style={{ borderRadius: 4 }} />
        <SkeletonLine width="50%" height={12} style={{ marginTop: 8, alignSelf: 'center' }} />
      </View>
    </Card>
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBlock: {
    flex: 1,
  },
  skeletonLine: {
    borderRadius: 4,
  },
  buttonSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  leaderboardUserInfo: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  profileInfo: {
    flex: 1,
  },
  feedCard: {
    paddingVertical: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  feedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  feedExercises: {
    marginTop: 16,
    gap: 12,
  },
  feedExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  feedActions: {
    marginTop: 16,
  },
  feedActionButtons: {
    flexDirection: 'row',
    gap: 20,
  },
});
