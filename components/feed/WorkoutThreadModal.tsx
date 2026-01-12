import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { usePauseVideosWhileOpen } from '@/contexts/VideoPlayerContext';
import { formatDuration, formatRelativeTime } from '@/lib/ui/formatters';
import playHapticFeedback from '@/lib/utils/haptic';
import { calculatePPLBreakdown, MUSCLE_TO_PPL, PPL_COLORS, PPL_LABELS, PPLCategory } from '@/lib/data/pplCategories';
import { getStrengthTier, StrengthTier } from '@/lib/data/strengthStandards';
import { feedService, FeedComment } from '@/lib/services/feedService';
import { formatVolumeNumber, formatSet } from '@/lib/utils/utils';
import { ALL_WORKOUTS } from '@/lib/workout/workouts';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { FeedWorkout } from './FeedCard';

interface WorkoutCommentItemProps {
  comment: FeedComment;
  workoutId: string;
  currentUserId: string | null;
  isAuthor: boolean;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  onUserPress: (userId: string, username: string, profilePictureUrl?: string) => void;
}

function WorkoutCommentItem({
  comment,
  workoutId: _workoutId,
  currentUserId,
  isAuthor,
  onDelete,
  onLike,
  onUserPress,
}: WorkoutCommentItemProps) {
  const { currentTheme } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const likes = comment.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;

  const commentLikeScale = useSharedValue(1);
  const commentLikeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: commentLikeScale.value }],
  }));

  const handleLike = () => {
    playHapticFeedback('light', false);
    commentLikeScale.value = withSequence(
      withTiming(1.3, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onLike(comment.id);
  };

  const handleDelete = () => {
    playHapticFeedback('medium', false);
    swipeableRef.current?.close();
    onDelete(comment.id);
  };

  const renderRightActions = () => {
    if (!isAuthor) return null;
    return (
      <TouchableOpacity
        style={[styles.commentDeleteAction, { backgroundColor: '#EF4444' }]}
        onPress={handleDelete}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
      </TouchableOpacity>
    );
  };

  const commentContent = (
    <View style={[styles.commentItem, { backgroundColor: currentTheme.colors.background }]}>
      <TouchableOpacity
        onPress={() => onUserPress(comment.user_id, comment.username, comment.profile_picture_url)}
        activeOpacity={0.7}
      >
        {comment.profile_picture_url ? (
          <Image source={{ uri: comment.profile_picture_url }} style={styles.commentAvatarImage} />
        ) : (
          <View style={[styles.commentAvatar, { backgroundColor: currentTheme.colors.primary + '20' }]}>
            <Text style={[styles.commentAvatarText, { color: currentTheme.colors.primary }]}>
              {comment.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <TouchableOpacity
            onPress={() => onUserPress(comment.user_id, comment.username, comment.profile_picture_url)}
            activeOpacity={0.7}
          >
            <Text style={[styles.commentUsername, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              @{comment.username}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.commentTime, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
            {formatRelativeTime(new Date(comment.created_at))}
          </Text>
        </View>
        <Text style={[styles.commentText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}>
          {comment.text}
        </Text>
      </View>
      {/* Like button on right */}
      <TouchableOpacity
        style={styles.commentLikeButton}
        onPress={handleLike}
        activeOpacity={0.6}
      >
        <Animated.View style={commentLikeAnimatedStyle}>
          <Ionicons
            name={userHasLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '40'}
          />
        </Animated.View>
        {likeCount > 0 && (
          <Text style={[
            styles.commentLikeCount,
            {
              color: userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '50',
              fontFamily: currentTheme.fonts.medium
            }
          ]}>
            {likeCount}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (isAuthor) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        {commentContent}
      </Swipeable>
    );
  }

  return commentContent;
}

interface WorkoutThreadModalProps {
  visible: boolean;
  onClose: () => void;
  workout: FeedWorkout | null;
  currentUserId: string | null;
  onLike?: () => void;
  onWorkoutUpdated?: (workout: FeedWorkout) => void;
  onUserPress?: (userId: string, username: string, profilePictureUrl?: string) => void;
  weightUnit?: WeightUnit;
}

export default function WorkoutThreadModal({
  visible,
  onClose,
  workout,
  currentUserId,
  onLike,
  onWorkoutUpdated,
  onUserPress,
  weightUnit = 'lbs',
}: WorkoutThreadModalProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  usePauseVideosWhileOpen(visible);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(new Set());
  const [pplModalVisible, setPplModalVisible] = useState(false);
  const [selectedPplCategory, setSelectedPplCategory] = useState<PPLCategory | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Toggle exercise expansion to show all sets
  const toggleExerciseExpanded = (index: number) => {
    playHapticFeedback('light', false);
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

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

  // Calculate exercises grouped by PPL category for the modal
  const pplExercises = useMemo((): Record<PPLCategory, { name: string; sets: number }[]> => {
    const result: Record<PPLCategory, { name: string; sets: number }[]> = {
      push: [],
      pull: [],
      legs: [],
    };

    if (!workout) return result;

    workout.exercises.forEach(exercise => {
      const exerciseInfo = ALL_WORKOUTS.find(
        w => w.name.toLowerCase() === exercise.name.toLowerCase()
      );
      if (exerciseInfo && exerciseInfo.primaryMuscles.length > 0) {
        const primaryMuscle = exerciseInfo.primaryMuscles[0];
        const pplCategory = MUSCLE_TO_PPL[primaryMuscle];
        if (pplCategory) {
          result[pplCategory].push({
            name: exercise.name,
            sets: exercise.sets,
          });
        }
      }
    });

    return result;
  }, [workout]);

  const handlePplChipPress = (category: PPLCategory) => {
    playHapticFeedback('light', false);
    setSelectedPplCategory(category);
    setPplModalVisible(true);
  };

  const handleClosePplModal = () => {
    setPplModalVisible(false);
    setSelectedPplCategory(null);
  };

  const handleLike = () => {
    playHapticFeedback('light', false);
    likeScale.value = withSequence(
      withTiming(1.25, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onLike?.();
  };

  const handleUserTap = (userId: string, username: string, profilePictureUrl?: string) => {
    onClose(); // Close modal first
    onUserPress?.(userId, username, profilePictureUrl);
  };

  if (!workout) return null;

  const feedData = workout.feed_data;
  const hasPRs = (feedData?.pr_count ?? 0) > 0;
  // Only show tier for workouts with tracked lifts (indicated by pr_count > 0)
  const strengthLevel = hasPRs ? (feedData?.strength_level as StrengthTier | undefined) : undefined;

  const likes = feedData?.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;

  const comments = feedData?.comments || [];

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    Keyboard.dismiss();
    setIsSubmitting(true);
    const newComment = await feedService.addComment(workout.id, commentText.trim());
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
    const success = await feedService.deleteComment(workout.id, commentId);
    if (success) {
      const updatedComments = comments.filter(c => c.id !== commentId);
      const updatedWorkout: FeedWorkout = {
        ...workout,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onWorkoutUpdated?.(updatedWorkout);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    const success = await feedService.toggleWorkoutCommentLike(workout.id, commentId);
    if (success) {
      const updatedComments = comments.map(c => {
        if (c.id !== commentId) return c;

        const commentLikes = [...(c.likes || [])];
        const existingIndex = commentLikes.findIndex(l => l.user_id === currentUserId);

        if (existingIndex >= 0) {
          commentLikes.splice(existingIndex, 1);
        } else if (currentUserId) {
          commentLikes.push({
            user_id: currentUserId,
            username: '',
            created_at: new Date().toISOString(),
          });
        }

        return { ...c, likes: commentLikes };
      });

      const updatedWorkout: FeedWorkout = {
        ...workout,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onWorkoutUpdated?.(updatedWorkout);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header with workout title */}
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="close" onPress={onClose} />
          <Text
            style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}
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
            <TouchableOpacity
              onPress={() => handleUserTap(workout.user_id, workout.username, workout.profile_picture_url)}
              activeOpacity={0.7}
              style={styles.userTapArea}
            >
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
                <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                  @{workout.username}
                </Text>
                <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                  {formatRelativeTime(workout.created_at)}
                </Text>
              </View>
            </TouchableOpacity>
            {strengthLevel && (
              <TierBadge tier={strengthLevel} size="small" />
            )}
          </View>

          {/* Stats grid */}
          <View style={[styles.statsGrid, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                {workout.exercise_count}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                exercises
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                {formatDuration(workout.duration_seconds)}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                duration
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                {formatVolumeNumber(workout.total_volume, weightUnit)}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                {weightUnit}
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
                  <TouchableOpacity
                    key={category}
                    style={[styles.pplChip, { backgroundColor: PPL_COLORS[category] + '20' }]}
                    onPress={() => handlePplChipPress(category)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.pplDot, { backgroundColor: PPL_COLORS[category] }]} />
                    <Text style={[styles.pplChipText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                      {PPL_LABELS[category]}
                    </Text>
                    <Text style={[styles.pplChipCount, { color: PPL_COLORS[category], fontFamily: currentTheme.fonts.bold }]}>
                      {pplBreakdown.counts[category]}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          {/* Exercise List */}
          <View style={styles.exerciseList}>
            {workout.exercises.map((ex, i) => {
              const isExpanded = expandedExercises.has(i);
              const hasDetailedSets = ex.allSets && ex.allSets.length > 0;

              return (
                <View key={i}>
                  <TouchableOpacity
                    activeOpacity={hasDetailedSets ? 0.7 : 1}
                    onPress={() => hasDetailedSets && toggleExerciseExpanded(i)}
                    style={[
                      styles.exerciseRow,
                      !isExpanded && i < workout.exercises.length - 1 && { borderBottomColor: currentTheme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
                    ]}
                  >
                    <View style={styles.exerciseNameContainer}>
                      {hasDetailedSets && (
                        <Ionicons
                          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                          size={16}
                          color={currentTheme.colors.text + '50'}
                          style={{ marginRight: 6 }}
                        />
                      )}
                      <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                        {ex.name}
                      </Text>
                      {ex.percentile && ex.percentile > 0 && (
                        <TierBadge tier={getStrengthTier(ex.percentile)} size="tiny" showTooltip={false} />
                      )}
                    </View>
                    <View style={styles.exerciseRight}>
                      <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '70', fontFamily: currentTheme.fonts.regular }]}>
                        {ex.bestSet}
                      </Text>
                      {hasDetailedSets && (
                        <Text style={[styles.setCount, { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.regular }]}>
                          {ex.sets} sets
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Expanded sets view */}
                  {isExpanded && hasDetailedSets && (
                    <View style={[styles.setsExpanded, { backgroundColor: currentTheme.colors.surface + '50' }]}>
                      {ex.allSets!.map((set, setIndex) => (
                        <View
                          key={setIndex}
                          style={[
                            styles.setRow,
                            setIndex < ex.allSets!.length - 1 && { borderBottomColor: currentTheme.colors.border + '30', borderBottomWidth: StyleSheet.hairlineWidth }
                          ]}
                        >
                          <Text style={[styles.setNumber, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.medium }]}>
                            Set {set.setNumber}
                          </Text>
                          <View style={styles.setDetails}>
                            <Text style={[styles.setWeight, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                              {formatSet(set, { trackingType: ex.trackingType, showUnit: true })}
                            </Text>
                            {set.isPersonalRecord && (
                              <View style={[styles.prBadge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                                <Text style={[styles.prBadgeText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                                  Best
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Border after expanded section */}
                  {isExpanded && i < workout.exercises.length - 1 && (
                    <View style={{ borderBottomColor: currentTheme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }} />
                  )}
                </View>
              );
            })}
          </View>

          {/* Like and comment row */}
          <View style={[styles.actionsRow, { borderColor: currentTheme.colors.border }]}>
            <View style={styles.actionsLeft}>
              {/* Like button */}
              <TouchableOpacity
                style={[
                  styles.likeButton,
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
                  <Text style={[styles.likeCount, { color: userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70', fontFamily: currentTheme.fonts.medium }]}>
                    {likeCount}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.commentCount}>
              <Ionicons name="chatbubble-outline" size={18} color={currentTheme.colors.text + '60'} />
              <Text style={[styles.commentCountText, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.medium }]}>
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </Text>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={[styles.commentsTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              Comments {comments.length > 0 && `(${comments.length})`}
            </Text>

            {comments.length === 0 ? (
              <Text style={[styles.noComments, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                No comments yet. Be the first!
              </Text>
            ) : (
              <View style={styles.commentsList}>
                {comments.map(comment => (
                  <WorkoutCommentItem
                    key={comment.id}
                    comment={comment}
                    workoutId={workout.id}
                    currentUserId={currentUserId}
                    isAuthor={comment.user_id === currentUserId}
                    onDelete={handleDeleteComment}
                    onLike={handleLikeComment}
                    onUserPress={handleUserTap}
                  />
                ))}
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
                  }
                ]}
                placeholder="Add a comment..."
                placeholderTextColor={currentTheme.colors.text + '40'}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                editable={!isSubmitting}
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

        </KeyboardAvoidingView>
      </View>

      {/* PPL Exercise Detail Modal */}
      <Modal
        visible={pplModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClosePplModal}
      >
        <View style={[styles.pplModalContainer, { backgroundColor: currentTheme.colors.background }]}>
          {/* Header */}
          <View style={[styles.pplModalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={handleClosePplModal} style={styles.pplModalCloseButton}>
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <View style={styles.pplModalTitleContainer}>
              {selectedPplCategory && (
                <View style={[styles.pplModalTitleChip, { backgroundColor: PPL_COLORS[selectedPplCategory] + '20' }]}>
                  <View style={[styles.pplDot, { backgroundColor: PPL_COLORS[selectedPplCategory] }]} />
                  <Text style={[styles.pplModalTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                    {PPL_LABELS[selectedPplCategory]}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.pplModalCloseButton} />
          </View>

          {/* Content */}
          <ScrollView style={styles.pplModalContent} contentContainerStyle={styles.pplModalContentContainer}>
            {selectedPplCategory && (
              <>
                <Text style={[styles.pplModalExerciseCount, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                  {pplExercises[selectedPplCategory].length} exercise{pplExercises[selectedPplCategory].length !== 1 ? 's' : ''}
                </Text>

                <View style={styles.pplModalExerciseList}>
                  {pplExercises[selectedPplCategory].map((exercise, index) => (
                    <View
                      key={index}
                      style={[styles.pplModalExerciseRow, { borderBottomColor: currentTheme.colors.border }]}
                    >
                      <Text style={[styles.pplModalExerciseName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                        {exercise.name}
                      </Text>
                      <View style={[styles.pplModalSetsBadge, { backgroundColor: selectedPplCategory ? PPL_COLORS[selectedPplCategory] + '15' : currentTheme.colors.primary + '15' }]}>
                        <Text style={[styles.pplModalSetsText, { color: selectedPplCategory ? PPL_COLORS[selectedPplCategory] : currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                          {exercise.sets} sets
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
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
  userTapArea: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#FFFFFF',
  },
  actionsRow: {
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
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentCountText: {
    fontSize: 14,
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
  },
  exerciseRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  setCount: {
    fontSize: 11,
  },
  setsExpanded: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: -4,
    borderRadius: 8,
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  setNumber: {
    fontSize: 13,
    width: 50,
  },
  setDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setWeight: {
    fontSize: 14,
  },
  setReps: {
    fontSize: 14,
  },
  prBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  prBadgeText: {
    fontSize: 10,
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
  commentAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarText: {
    fontSize: 14,
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
  commentLikeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingTop: 8,
    minWidth: 36,
    gap: 2,
  },
  commentLikeCount: {
    fontSize: 12,
  },
  commentDeleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    marginLeft: 8,
    borderRadius: 8,
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
  // PPL Modal styles
  pplModalContainer: {
    flex: 1,
  },
  pplModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pplModalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pplModalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pplModalTitleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  pplModalTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  pplModalContent: {
    flex: 1,
  },
  pplModalContentContainer: {
    padding: 16,
  },
  pplModalExerciseCount: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  pplModalExerciseList: {
    gap: 0,
  },
  pplModalExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pplModalExerciseName: {
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  pplModalSetsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  pplModalSetsText: {
    fontSize: 13,
  },
});
