import { Text, View } from '@/components/Themed';
import UserAvatar from '@/components/ui/UserAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeTime } from '@/lib/ui/formatters';
import playHapticFeedback from '@/lib/utils/haptic';
import { FeedComment } from '@/lib/services/feedService';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

interface WorkoutCommentItemProps {
  comment: FeedComment;
  currentUserId: string | null;
  isAuthor: boolean;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  onUserPress: (userId: string, username: string, profilePictureUrl?: string) => void;
}

export default function WorkoutCommentItem({
  comment,
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
        <UserAvatar uri={comment.profile_picture_url} username={comment.username} size={32} />
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <TouchableOpacity
            onPress={() => onUserPress(comment.user_id, comment.username, comment.profile_picture_url)}
            activeOpacity={0.7}
          >
            <Text style={[styles.commentUsername, { color: currentTheme.colors.text, fontWeight: '600' }]}>
              @{comment.username}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.commentTime, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}>
            {formatRelativeTime(new Date(comment.created_at))}
          </Text>
        </View>
        <Text style={[styles.commentText, { color: currentTheme.colors.text, fontWeight: '400' }]}>
          {comment.text}
        </Text>
      </View>
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
              fontWeight: '500'
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

const styles = StyleSheet.create({
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
});
