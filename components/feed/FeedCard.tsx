import AchievementBadge from '@/components/gamification/AchievementBadge';
import AchievementModal, { AchievementModalItem } from '@/components/gamification/AchievementModal';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import Badge from '@/components/ui/Badge';
import { useTheme } from '@/contexts/ThemeContext';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { achievementMeta } from '@/lib/gamification/achievementMeta';
import { formatDuration, formatRelativeTime } from '@/lib/ui/formatters';
import playHapticFeedback from '@/lib/utils/haptic';
import { calculatePPLBreakdown, PPL_COLORS, PPL_LABELS } from '@/lib/data/pplCategories';
import { getStrengthTier, getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { WorkoutSummary } from '@/lib/services/feedService';
import { formatDistance, formatDuration as formatCardioDuration, formatVolume } from '@/lib/utils/utils';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

export type FeedWorkout = WorkoutSummary & {
  username: string;
  profile_picture_url?: string;
  user_id: string;
};

interface FeedCardProps {
  workout: FeedWorkout;
  onPress: (workout: FeedWorkout) => void;
  onUserPress?: (workout: FeedWorkout) => void;
  onLike?: (workoutId: string) => void;
  onComment?: (workout: FeedWorkout) => void;
  currentUserId?: string | null;
  weightUnit?: WeightUnit;
  /** Author's overall strength tier — colors the username when known. */
  overallTier?: StrengthTier;
}


function FeedCard({ workout, onPress, onUserPress, onLike, onComment, currentUserId, weightUnit = 'lbs', overallTier }: FeedCardProps) {
  const { currentTheme } = useTheme();
  const feedData = workout.feed_data;
  const hasPRs = (feedData?.pr_count ?? 0) > 0;
  // Unknown ids (older app versions) resolve to null and drop out silently.
  const earned = useMemo(
    () => (feedData?.achievement_ids ?? []).map(achievementMeta).filter(m => m != null),
    [feedData?.achievement_ids],
  );
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);

  const likeScale = useSharedValue(1);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const handleLike = () => {
    playHapticFeedback('light', false);
    likeScale.value = withSequence(
      withTiming(1.25, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onLike?.(workout.id);
  };

  // Only show tier for workouts with tracked lifts (pr_count > 0).
  const strengthLevel = hasPRs ? (feedData?.strength_level as StrengthTier | undefined) : undefined;

  const likes = feedData?.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;

  const comments = feedData?.comments || [];
  const commentCount = comments.length;

  const pplBreakdown = useMemo(() =>
    calculatePPLBreakdown(workout.exercises),
    [workout.exercises]
  );

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: currentTheme.colors.border }]}
      onPress={() => onPress(workout)}
      activeOpacity={0.9}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => onUserPress?.(workout)} activeOpacity={0.7}>
          {workout.profile_picture_url ? (
            <Image source={{ uri: workout.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: currentTheme.colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: currentTheme.colors.primary }]}>
                {workout.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={[styles.username, { color: overallTier ? getTierColor(overallTier) : currentTheme.colors.text, fontWeight: '600' }]}>
              @{workout.username}
            </Text>
            <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
              {formatRelativeTime(workout.created_at)}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.badges}>
          {strengthLevel && (
            <TierBadge tier={strengthLevel} size="small" />
          )}
        </View>
      </View>

      <Text style={[styles.title, { color: currentTheme.colors.text, fontWeight: '700' }]}>
        {workout.title}
      </Text>

      {hasPRs && feedData && (
        <View style={styles.prRow}>
          <Badge
            variant="solid"
            label={feedData.pr_count === 1 ? 'New PR' : `${feedData.pr_count} PRs`}
          />
        </View>
      )}

      {/* Tap a badge for the full-screen spotlight. */}
      {earned.length > 0 && (
        <View style={styles.achRow}>
          {earned.slice(0, 3).map(m => (
            <TouchableOpacity
              key={m.id}
              style={styles.achItem}
              activeOpacity={0.7}
              hitSlop={6}
              onPress={() => setSpotlight({ ...m, earnedLabel: `@${workout.username}` })}
              accessibilityRole="button"
              accessibilityLabel={m.title}
            >
              <AchievementBadge icon={m.icon} emblem={emblemFor(m.id)} rarity={m.rarity} size={26} />
              <Text style={[styles.achTitle, { color: currentTheme.colors.text + 'CC' }]} numberOfLines={1}>
                {m.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={[styles.stats, { color: currentTheme.colors.text + '70', fontWeight: '400' }]}>
        {workout.exercise_count} exercises · {formatDuration(workout.duration_seconds)}
        {workout.total_volume > 0 && ` · ${formatVolume(workout.total_volume, weightUnit)}`}
        {(workout.total_distance_meters ?? 0) > 0 && ` · ${formatDistance(workout.total_distance_meters ?? 0)}`}
        {(workout.total_cardio_seconds ?? 0) > 0 && ` · ${formatCardioDuration(workout.total_cardio_seconds ?? 0)} cardio`}
      </Text>

      {pplBreakdown.total > 0 && (
        <View style={styles.pplChips}>
          {(['push', 'pull', 'legs'] as const)
            .filter(category => pplBreakdown.counts[category] > 0)
            .map(category => (
              <View
                key={category}
                style={[styles.pplChip, { backgroundColor: PPL_COLORS[category] + '20' }]}
              >
                <View style={[styles.pplDot, { backgroundColor: PPL_COLORS[category] }]} />
                <Text style={[styles.pplChipText, { color: currentTheme.colors.text, fontWeight: '500' }]}>
                  {PPL_LABELS[category]}
                </Text>
                <Text style={[styles.pplChipCount, { color: PPL_COLORS[category], fontWeight: '700' }]}>
                  {pplBreakdown.counts[category]}
                </Text>
              </View>
            ))}
        </View>
      )}

      {workout.exercises.length > 0 && (
        <View style={styles.exercises}>
          {workout.exercises.slice(0, 3).map((ex, i) => (
            <View key={i} style={styles.exerciseRow}>
              <View style={styles.exerciseNameContainer}>
                <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontWeight: '500' }]}>
                  {ex.name}
                </Text>
                {ex.percentile && ex.percentile > 0 && (
                  <TierBadge tier={getStrengthTier(ex.percentile)} size="tiny" />
                )}
              </View>
              <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
                {ex.bestSet}
              </Text>
            </View>
          ))}
          {workout.exercises.length > 3 && (
            <Text style={[styles.moreExercises, { color: currentTheme.colors.text + '40', fontWeight: '400' }]}>
              +{workout.exercises.length - 3} more
            </Text>
          )}
        </View>
      )}

      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              userHasLiked && { backgroundColor: currentTheme.colors.primary + '15' }
            ]}
            onPress={handleLike}
            activeOpacity={0.6}
          >
            <Animated.View style={likeAnimatedStyle}>
              <Ionicons
                name={userHasLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70'}
              />
            </Animated.View>
            {likeCount > 0 && (
              <Text style={[styles.actionCount, { color: userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70', fontWeight: '500' }]}>
                {likeCount}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onComment?.(workout)}
            activeOpacity={0.6}
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={currentTheme.colors.text + '70'}
            />
            {commentCount > 0 && (
              <Text style={[styles.actionCount, { color: currentTheme.colors.text + '70', fontWeight: '500' }]}>
                {commentCount}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} />
    </TouchableOpacity>
  );
}

export default React.memo(FeedCard);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 4,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
  },
  username: {
    fontSize: 15,
  },
  time: {
    fontSize: 13,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  prRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  achRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  achItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  achTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  stats: {
    fontSize: 14,
    marginTop: 4,
  },
  pplChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pplChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  pplDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pplChipText: {
    fontSize: 12,
  },
  pplChipCount: {
    fontSize: 12,
  },
  exercises: {
    marginTop: 12,
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  exerciseNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
  },
  exerciseSets: {
    fontSize: 14,
    marginLeft: 12,
  },
  moreExercises: {
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  actionCount: {
    fontSize: 14,
  },
});
