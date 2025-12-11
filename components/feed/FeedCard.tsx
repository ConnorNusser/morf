import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { formatDuration, formatRelativeTime } from '@/lib/ui/formatters';
import playHapticFeedback from '@/lib/utils/haptic';
import { calculatePPLBreakdown, PPL_COLORS, PPL_LABELS } from '@/lib/data/pplCategories';
import { getStrengthTier, StrengthTier } from '@/lib/data/strengthStandards';
import { WorkoutSummary } from '@/lib/services/userSyncService';
import { formatVolume } from '@/lib/utils/utils';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

export type FeedWorkout = WorkoutSummary & {
  username: string;
  profile_picture_url?: string;
  user_id: string;
};

interface FeedCardProps {
  workout: FeedWorkout;
  onPress: () => void;
  onUserPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  currentUserId?: string | null;
  weightUnit?: WeightUnit;
}


export default function FeedCard({ workout, onPress, onUserPress, onLike, onComment, currentUserId, weightUnit = 'lbs' }: FeedCardProps) {
  const { currentTheme } = useTheme();
  const feedData = workout.feed_data;
  const hasPRs = (feedData?.pr_count ?? 0) > 0;

  // Smooth animation for like button using reanimated
  const likeScale = useSharedValue(1);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const handleLike = () => {
    playHapticFeedback('light', false);
    // Quick scale up, then smooth spring back
    likeScale.value = withSequence(
      withTiming(1.25, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onLike?.();
  };

  // Get tier for the badge - only show if workout has tracked lifts (indicated by pr_count)
  const strengthLevel = hasPRs ? (feedData?.strength_level as StrengthTier | undefined) : undefined;

  // Likes
  const likes = feedData?.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;

  // Comments
  const comments = feedData?.comments || [];
  const commentCount = comments.length;

  // Calculate PPL breakdown from exercises
  const pplBreakdown = useMemo(() =>
    calculatePPLBreakdown(workout.exercises),
    [workout.exercises]
  );

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: currentTheme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Header with user info */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={onUserPress} activeOpacity={0.7}>
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
            <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              @{workout.username}
            </Text>
            <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
              {formatRelativeTime(workout.created_at)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right side badges */}
        <View style={styles.badges}>
          {strengthLevel && (
            <TierBadge tier={strengthLevel} size="small" />
          )}
        </View>
      </View>

      {/* Workout title - larger */}
      <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
        {workout.title}
      </Text>

      {/* PR chips if any */}
      {hasPRs && feedData && (
        <View style={styles.prRow}>
          <View style={[styles.prChip, { backgroundColor: currentTheme.colors.primary }]}>
            <Text style={styles.prChipText}>
              {feedData.pr_count === 1 ? 'New PR' : `${feedData.pr_count} PRs`}
            </Text>
          </View>
        </View>
      )}

      {/* Stats row */}
      <Text style={[styles.stats, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}>
        {workout.exercise_count} exercises · {formatDuration(workout.duration_seconds)} · {formatVolume(workout.total_volume, weightUnit)}
      </Text>

      {/* PPL chips */}
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
                <Text style={[styles.pplChipText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                  {PPL_LABELS[category]}
                </Text>
                <Text style={[styles.pplChipCount, { color: PPL_COLORS[category], fontFamily: 'Raleway_700Bold' }]}>
                  {pplBreakdown.counts[category]}
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Exercise list - show top exercises */}
      {workout.exercises.length > 0 && (
        <View style={styles.exercises}>
          {workout.exercises.slice(0, 3).map((ex, i) => (
            <View key={i} style={styles.exerciseRow}>
              <View style={styles.exerciseNameContainer}>
                <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                  {ex.name}
                </Text>
                {ex.percentile && ex.percentile > 0 && (
                  <TierBadge tier={getStrengthTier(ex.percentile)} size="tiny" />
                )}
              </View>
              <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                {ex.bestSet}
              </Text>
            </View>
          ))}
          {workout.exercises.length > 3 && (
            <Text style={[styles.moreExercises, { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }]}>
              +{workout.exercises.length - 3} more
            </Text>
          )}
        </View>
      )}

      {/* Like and comment bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionLeft}>
          {/* Animated like button */}
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
              <Text style={[styles.actionCount, { color: userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
                {likeCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Comment button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onComment}
            activeOpacity={0.6}
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={currentTheme.colors.text + '70'}
            />
            {commentCount > 0 && (
              <Text style={[styles.actionCount, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
                {commentCount}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
    fontFamily: 'Raleway_600SemiBold',
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
  prChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  prChipText: {
    fontSize: 13,
    fontFamily: 'Raleway_600SemiBold',
    color: '#FFFFFF',
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
