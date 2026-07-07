import { useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space } from '@/lib/ui/tokens';
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
  const ink = useInk();
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
    outputRange: [0.5, 1],
  });

  return (
    <Animated.View
      style={[
        styles.skeletonLine,
        {
          width,
          height,
          // Light overlay reads on the flat page (old `border` fill was invisible once the card went flat).
          backgroundColor: ink.ghost,
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
        <SkeletonLine width={28} height={28} style={{ borderRadius: 14 }} />
        <View style={styles.leaderboardUserInfo}>
          <SkeletonLine width={100} height={15} />
          <SkeletonLine width={60} height={12} style={{ marginTop: space.xs }} />
        </View>
        <SkeletonLine width={50} height={16} />
      </View>
    );
  }

  if (variant === 'profile-header') {
    return (
      <View style={[styles.profileHeader, style]}>
        <SkeletonLine width={60} height={60} style={{ borderRadius: 30 }} />
        <View style={styles.profileInfo}>
          <SkeletonLine width={120} height={18} />
          <SkeletonLine width={80} height={14} style={{ marginTop: space.sm }} />
        </View>
      </View>
    );
  }

  if (variant === 'feed') {
    return (
      <View style={[styles.feedCard, { borderBottomColor: currentTheme.colors.border }, style]}>
        <View style={styles.feedHeader}>
          <View style={styles.feedUserInfo}>
            <SkeletonLine width={44} height={44} style={{ borderRadius: 22 }} />
            <View style={styles.feedUserText}>
              <SkeletonLine width={90} height={14} />
              <SkeletonLine width={50} height={12} />
            </View>
          </View>
          <SkeletonLine width={36} height={26} style={{ borderRadius: 10 }} />
        </View>

        <SkeletonLine width="75%" height={22} style={{ marginTop: space.md }} />

        <SkeletonLine width="60%" height={14} style={{ marginTop: space.md }} />

        <View style={styles.feedChips}>
          <SkeletonLine width={70} height={28} style={{ borderRadius: 16 }} />
          <SkeletonLine width={60} height={28} style={{ borderRadius: 16 }} />
        </View>

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
      <Card style={StyleSheet.flatten([styles.container, style])}>
        <View style={{ marginBottom: space.xl }}>
          <SkeletonLine width="60%" height={20} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <View style={{ marginBottom: space.sm }}>
              <SkeletonLine width={60} height={36} />
            </View>
            <SkeletonLine width={70} height={14} />
          </View>
          <View style={[styles.statBlock, { alignItems: 'flex-end' }]}>
            <View style={{ marginBottom: space.sm }}>
              <SkeletonLine width={50} height={24} />
            </View>
            <SkeletonLine width={30} height={14} />
          </View>
        </View>

        <View style={{ marginTop: space.section }}>
          <SkeletonLine width="100%" height={12} style={{ borderRadius: 6 }} />
          <SkeletonLine width="40%" height={12} style={{ marginTop: space.md, alignSelf: 'center' }} />
        </View>
      </Card>
    );
  }

  return (
    <Card style={StyleSheet.flatten([styles.container, style])}>
      <View style={styles.header}>
        <SkeletonLine width="45%" height={18} />
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            <SkeletonLine width={50} height={24} />
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <View style={{ marginBottom: space.sm }}>
            <SkeletonLine width={80} height={12} />
          </View>
          <SkeletonLine width={100} height={24} />
        </View>
        <View style={[styles.statBlock, { alignItems: 'flex-end' }]}>
          <View style={{ marginBottom: space.sm }}>
            <SkeletonLine width={100} height={12} />
          </View>
          <SkeletonLine width={60} height={24} />
        </View>
      </View>

      <View style={{ marginTop: space.lg }}>
        <SkeletonLine width="100%" height={8} style={{ borderRadius: 4 }} />
        <SkeletonLine width="50%" height={12} style={{ marginTop: space.sm, alignSelf: 'center' }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: space.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.lg,
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
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.xs,
    gap: space.md,
  },
  leaderboardUserInfo: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.sm,
  },
  profileInfo: {
    flex: 1,
  },
  feedCard: {
    paddingVertical: space.section,
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
    gap: space.md,
  },
  feedUserText: {
    gap: space.sm,
  },
  feedChips: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  feedExercises: {
    marginTop: space.lg,
    gap: space.md,
  },
  feedExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  feedActions: {
    marginTop: space.lg,
  },
  feedActionButtons: {
    flexDirection: 'row',
    gap: space.xl,
  },
});
