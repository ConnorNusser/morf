import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatDuration, formatRelativeTime } from '@/lib/formatters';
import playHapticFeedback from '@/lib/haptic';
import { calculatePPLBreakdown, PPL_COLORS, PPL_LABELS } from '@/lib/pplCategories';
import { getBaseTier, getTierColor, StrengthTier } from '@/lib/strengthStandards';
import { ReactionType, WorkoutSummary } from '@/lib/userSyncService';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import ReactionPicker, { REACTIONS } from './ReactionPicker';

export type FeedWorkout = WorkoutSummary & {
  username: string;
  profile_picture_url?: string;
  user_id: string;
};

interface FeedCardProps {
  workout: FeedWorkout;
  onPress: () => void;
  onUserPress?: () => void;
  onReaction?: (type: ReactionType) => void;
  onComment?: () => void;
  currentUserId?: string | null;
}


export default function FeedCard({ workout, onPress, onUserPress, onReaction, onComment, currentUserId }: FeedCardProps) {
  const { currentTheme } = useTheme();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const feedData = workout.feed_data;
  const hasPRs = feedData?.pr_count && feedData.pr_count > 0;

  // Smooth animation for like button using reanimated
  const likeScale = useSharedValue(1);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const handleReaction = useCallback((type: ReactionType) => {
    playHapticFeedback('light', false);
    // Quick scale up, then smooth spring back
    likeScale.value = withSequence(
      withTiming(1.25, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onReaction?.(type);
  }, [likeScale, onReaction]);

  // Get tier color for the badge
  const strengthLevel = feedData?.strength_level as StrengthTier | undefined;
  const tierColor = strengthLevel ? getTierColor(strengthLevel) : currentTheme.colors.primary;
  const baseTier = strengthLevel ? getBaseTier(strengthLevel) : null;
  const isHighTier = baseTier === 'S' || baseTier === 'A';

  // Reactions
  const reactions = feedData?.reactions || [];
  const reactionCount = reactions.length;
  const userReaction = currentUserId
    ? reactions.find(r => r.user_id === currentUserId)?.reaction_type
    : undefined;

  // Group reactions by type for display
  const reactionsByType = useMemo(() => {
    const grouped: Record<ReactionType, number> = { kudos: 0, fire: 0, strong: 0, celebrate: 0 };
    const reactionList = feedData?.reactions || [];
    reactionList.forEach(r => {
      if (grouped[r.reaction_type] !== undefined) {
        grouped[r.reaction_type]++;
      }
    });
    return grouped;
  }, [feedData?.reactions]);

  const handleLongPress = useCallback(() => {
    playHapticFeedback('medium', false);
    setShowReactionPicker(true);
  }, []);

  const handleReactionSelect = useCallback((type: ReactionType) => {
    likeScale.value = withSequence(
      withTiming(1.25, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onReaction?.(type);
  }, [likeScale, onReaction]);

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
            <View style={[
              styles.tierBadge,
              {
                backgroundColor: tierColor + '20',
                borderColor: tierColor,
                borderWidth: isHighTier ? 1.5 : 1,
              }
            ]}>
              <Text style={[
                styles.tierBadgeText,
                {
                  color: tierColor,
                  fontFamily: isHighTier ? 'Raleway_700Bold' : 'Raleway_600SemiBold',
                }
              ]}>
                {strengthLevel}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Workout title - larger */}
      <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
        {workout.title}
      </Text>

      {/* PR chips if any */}
      {hasPRs && (
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
        {workout.exercise_count} exercises · {formatDuration(workout.duration_seconds)} · {workout.total_volume.toLocaleString()} lbs
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
              <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                {ex.name}
              </Text>
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

      {/* Reaction bar */}
      <View style={styles.reactionBar}>
        <View style={styles.reactionLeft}>
          {/* Animated like button - tap for quick kudos, long press for picker */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              userReaction && { backgroundColor: currentTheme.colors.primary + '15' }
            ]}
            onPress={() => handleReaction('kudos')}
            onLongPress={handleLongPress}
            delayLongPress={300}
            activeOpacity={0.6}
          >
            <Animated.View style={likeAnimatedStyle}>
              <Ionicons
                name={userReaction ? 'heart' : 'heart-outline'}
                size={22}
                color={userReaction ? currentTheme.colors.primary : currentTheme.colors.text + '70'}
              />
            </Animated.View>
          </TouchableOpacity>

          {/* Reaction counts by type */}
          {reactionCount > 0 && (
            <View style={styles.reactionCounts}>
              {REACTIONS
                .filter(r => reactionsByType[r.type] > 0)
                .map(r => (
                  <View key={r.type} style={styles.reactionCountItem}>
                    <Text style={styles.reactionCountEmoji}>{r.emoji}</Text>
                    <Text style={[styles.reactionCountText, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
                      {reactionsByType[r.type]}
                    </Text>
                  </View>
                ))}
            </View>
          )}

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

      {/* Reaction picker modal */}
      <ReactionPicker
        visible={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        onSelect={handleReactionSelect}
        currentReaction={userReaction}
      />
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
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tierBadgeText: {
    fontSize: 14,
    letterSpacing: 0.5,
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
  exerciseName: {
    fontSize: 15,
    flex: 1,
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
  reactionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  reactionLeft: {
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
  reactionEmoji: {
    fontSize: 20,
  },
  reactionCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactionCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reactionCountEmoji: {
    fontSize: 14,
  },
  reactionCountText: {
    fontSize: 13,
  },
});
