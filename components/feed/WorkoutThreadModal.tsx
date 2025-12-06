import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatDuration, formatRelativeTime } from '@/lib/formatters';
import playHapticFeedback from '@/lib/haptic';
import { calculatePPLBreakdown, PPL_COLORS, PPL_LABELS } from '@/lib/pplCategories';
import { getBaseTier, getTierColor, StrengthTier } from '@/lib/strengthStandards';
import { FeedComment, ReactionType, userSyncService } from '@/lib/userSyncService';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { FeedWorkout } from './FeedCard';
import ReactionPicker, { REACTIONS } from './ReactionPicker';

interface WorkoutThreadModalProps {
  visible: boolean;
  onClose: () => void;
  workout: FeedWorkout | null;
  currentUserId: string | null;
  onReaction?: (type: ReactionType) => void;
  onWorkoutUpdated?: (workout: FeedWorkout) => void;
}

export default function WorkoutThreadModal({
  visible,
  onClose,
  workout,
  currentUserId,
  onReaction,
  onWorkoutUpdated,
}: WorkoutThreadModalProps) {
  const { currentTheme } = useTheme();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputAccessoryViewID = 'workoutThreadAccessory';

  // Smooth animation for like button using reanimated
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  // Calculate PPL breakdown from exercises (must be before early return)
  const pplBreakdown = useMemo(() => {
    if (!workout) return { counts: { push: 0, pull: 0, legs: 0 }, total: 0 };
    return calculatePPLBreakdown(workout.exercises);
  }, [workout]);

  // Group reactions by type for display (must be before early return)
  const reactionsByType = useMemo(() => {
    const grouped: Record<ReactionType, number> = { kudos: 0, fire: 0, strong: 0, celebrate: 0 };
    const reactions = workout?.feed_data?.reactions || [];
    reactions.forEach(r => {
      if (grouped[r.reaction_type] !== undefined) {
        grouped[r.reaction_type]++;
      }
    });
    return grouped;
  }, [workout?.feed_data?.reactions]);

  const handleLongPress = useCallback(() => {
    playHapticFeedback('medium', false);
    setShowReactionPicker(true);
  }, []);

  const handleReactionSelect = useCallback((type: ReactionType) => {
    playHapticFeedback('light', false);
    likeScale.value = withSequence(
      withTiming(1.25, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onReaction?.(type);
    setShowReactionPicker(false);
  }, [likeScale, onReaction]);

  if (!workout) return null;

  const feedData = workout.feed_data;
  const hasPRs = feedData?.pr_count && feedData.pr_count > 0;
  const strengthLevel = feedData?.strength_level as StrengthTier | undefined;
  const tierColor = strengthLevel ? getTierColor(strengthLevel) : currentTheme.colors.primary;
  const baseTier = strengthLevel ? getBaseTier(strengthLevel) : null;
  const isHighTier = baseTier === 'S' || baseTier === 'A';

  const reactions = feedData?.reactions || [];
  const reactionCount = reactions.length;
  const userReaction = currentUserId
    ? reactions.find(r => r.user_id === currentUserId)?.reaction_type
    : undefined;

  const comments = feedData?.comments || [];

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    Keyboard.dismiss();
    setIsSubmitting(true);
    const newComment = await userSyncService.addComment(workout.id, commentText.trim());
    setIsSubmitting(false);

    if (newComment) {
      setCommentText('');
      // Update local state
      const updatedComments = [...comments, newComment];
      const updatedWorkout: FeedWorkout = {
        ...workout,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onWorkoutUpdated?.(updatedWorkout);
      // Scroll to bottom to show new comment
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const success = await userSyncService.deleteComment(workout.id, commentId);
    if (success) {
      const updatedComments = comments.filter(c => c.id !== commentId);
      const updatedWorkout: FeedWorkout = {
        ...workout,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onWorkoutUpdated?.(updatedWorkout);
    }
  };

  const renderComment = (comment: FeedComment) => {
    const canDelete = comment.user_id === currentUserId || workout.user_id === currentUserId;

    return (
      <View key={comment.id} style={styles.commentItem}>
        <View style={[styles.commentAvatar, { backgroundColor: currentTheme.colors.primary + '20' }]}>
          <Text style={[styles.commentAvatarText, { color: currentTheme.colors.primary }]}>
            {comment.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentUsername, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              @{comment.username}
            </Text>
            <Text style={[styles.commentTime, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
              {formatRelativeTime(new Date(comment.created_at))}
            </Text>
          </View>
          <Text style={[styles.commentText, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
            {comment.text}
          </Text>
        </View>
        {canDelete && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteComment(comment.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={14} color={currentTheme.colors.text + '40'} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header with workout title */}
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="close" onPress={onClose} />
          <Text
            style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}
            numberOfLines={1}
          >
            {workout.title}
          </Text>
          <RNView style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
          {/* User info row */}
          <View style={styles.userRow}>
            {workout.profile_picture_url ? (
              <Image source={{ uri: workout.profile_picture_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                <Text style={[styles.avatarText, { color: currentTheme.colors.primary }]}>
                  {workout.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                @{workout.username}
              </Text>
              <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                {formatRelativeTime(workout.created_at)}
              </Text>
            </View>
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

          {/* Stats grid */}
          <View style={[styles.statsGrid, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                {workout.exercise_count}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                exercises
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                {formatDuration(workout.duration_seconds)}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                duration
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                {workout.total_volume >= 1000 ? `${(workout.total_volume / 1000).toFixed(1)}k` : workout.total_volume}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                lbs
              </Text>
            </View>
          </View>

          {/* Tags row - PR chip + PPL chips */}
          {(hasPRs || pplBreakdown.total > 0) && (
            <View style={styles.tagsRow}>
              {hasPRs && (
                <View style={[styles.prChip, { backgroundColor: currentTheme.colors.primary }]}>
                  <Text style={styles.prChipText}>
                    {feedData?.pr_count === 1 ? 'New PR' : `${feedData?.pr_count} PRs`}
                  </Text>
                </View>
              )}
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

          {/* Exercise List */}
          <View style={styles.exerciseList}>
            {workout.exercises.map((ex, i) => (
              <View
                key={i}
                style={[
                  styles.exerciseRow,
                  i < workout.exercises.length - 1 && { borderBottomColor: currentTheme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
                ]}
              >
                <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                  {ex.name}
                </Text>
                <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}>
                  {ex.bestSet}
                </Text>
              </View>
            ))}
          </View>

          {/* Reactions row */}
          <View style={[styles.reactionsRow, { borderColor: currentTheme.colors.border }]}>
            <View style={styles.reactionsLeft}>
              {/* Animated like button - tap for quick kudos, long press for picker */}
              <TouchableOpacity
                style={[
                  styles.likeButton,
                  userReaction && { backgroundColor: currentTheme.colors.primary + '15' }
                ]}
                onPress={() => handleReactionSelect('kudos')}
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
            </View>

            <View style={styles.commentCount}>
              <Ionicons name="chatbubble-outline" size={18} color={currentTheme.colors.text + '60'} />
              <Text style={[styles.commentCountText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </Text>
            </View>
          </View>

          {/* Reaction picker modal */}
          <ReactionPicker
            visible={showReactionPicker}
            onClose={() => setShowReactionPicker(false)}
            onSelect={handleReactionSelect}
            currentReaction={userReaction}
          />

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={[styles.commentsTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              Comments {comments.length > 0 && `(${comments.length})`}
            </Text>

            {comments.length === 0 ? (
              <Text style={[styles.noComments, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                No comments yet. Be the first!
              </Text>
            ) : (
              <View style={styles.commentsList}>
                {comments.map(renderComment)}
              </View>
            )}
          </View>
          </ScrollView>

          {/* Comment Input */}
          <View style={[styles.inputContainer, { backgroundColor: currentTheme.colors.background }]}>
            <RNView style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.surface }]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                  }
                ]}
                placeholder="Add a comment..."
                placeholderTextColor={currentTheme.colors.text + '40'}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                editable={!isSubmitting}
                inputAccessoryViewID={inputAccessoryViewID}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: commentText.trim() && !isSubmitting
                      ? currentTheme.colors.primary
                      : 'transparent',
                  }
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                ) : (
                  <Ionicons
                    name="arrow-up-circle"
                    size={28}
                    color={commentText.trim() ? '#fff' : currentTheme.colors.text + '30'}
                  />
                )}
              </TouchableOpacity>
            </RNView>
          </View>

          {/* Keyboard accessory with Done button */}
          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID={inputAccessoryViewID}>
              <RNView style={[styles.accessoryContainer, { backgroundColor: currentTheme.colors.surface, borderTopColor: currentTheme.colors.border }]}>
                <RNView style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => Keyboard.dismiss()}
                  style={styles.doneButton}
                >
                  <Text style={[styles.doneButtonText, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </RNView>
            </InputAccessoryView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 24,
    gap: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 15,
  },
  time: {
    fontSize: 13,
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tierBadgeText: {
    fontSize: 14,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  likeCount: {
    fontSize: 14,
  },
  reactionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  reactionEmoji: {
    fontSize: 20,
  },
  commentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentCountText: {
    fontSize: 14,
  },
  pplChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pplChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  pplDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pplChipText: {
    fontSize: 13,
  },
  pplChipCount: {
    fontSize: 14,
  },
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  exerciseName: {
    fontSize: 15,
    flex: 1,
  },
  exerciseSets: {
    fontSize: 14,
    marginLeft: 12,
  },
  commentsSection: {
    gap: 12,
  },
  commentsTitle: {
    fontSize: 16,
  },
  noComments: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentsList: {
    gap: 16,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    fontSize: 14,
    fontFamily: 'Raleway_600SemiBold',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentUsername: {
    fontSize: 13,
  },
  commentTime: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 20,
  },
  deleteButton: {
    padding: 4,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneButtonText: {
    fontSize: 16,
  },
});
