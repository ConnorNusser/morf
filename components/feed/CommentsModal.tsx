import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { usePauseVideosWhileOpen } from '@/contexts/VideoPlayerContext';
import { formatRelativeTime } from '@/lib/formatters';
import playHapticFeedback from '@/lib/haptic';
import { feedService, FeedComment, FeedPost } from '@/lib/feedService';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  post: FeedPost | null;
  currentUserId: string | null;
  onPostUpdated?: (post: FeedPost) => void;
  onUserPress?: (userId: string, username: string, profilePictureUrl?: string) => void;
}

interface CommentItemProps {
  comment: FeedComment;
  postId: string;
  currentUserId: string | null;
  isAuthor: boolean;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  onUserPress: (userId: string, username: string, profilePictureUrl?: string) => void;
}

function CommentItem({
  comment,
  postId: _postId,
  currentUserId,
  isAuthor,
  onDelete,
  onLike,
  onUserPress,
}: CommentItemProps) {
  const { currentTheme } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const likes = comment.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;

  // Like animation
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const handleLike = () => {
    playHapticFeedback('light', false);
    likeScale.value = withSequence(
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
        style={[styles.deleteAction, { backgroundColor: '#EF4444' }]}
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
            <Text style={[styles.commentUsername, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              @{comment.username}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.commentTime, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
            {formatRelativeTime(new Date(comment.created_at))}
          </Text>
        </View>
        <Text style={[styles.commentText, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
          {comment.text}
        </Text>
      </View>
      {/* Like button on right */}
      <TouchableOpacity
        style={styles.commentLikeButton}
        onPress={handleLike}
        activeOpacity={0.6}
      >
        <Animated.View style={likeAnimatedStyle}>
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
              fontFamily: 'Raleway_500Medium'
            }
          ]}>
            {likeCount}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // Only wrap in Swipeable if user is the author
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

export default function CommentsModal({
  visible,
  onClose,
  post,
  currentUserId,
  onPostUpdated,
  onUserPress,
}: CommentsModalProps) {
  const { currentTheme } = useTheme();
  usePauseVideosWhileOpen(visible);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  if (!post) return null;

  const feedData = post.feed_data;
  const comments = feedData?.comments || [];

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    Keyboard.dismiss();
    setIsSubmitting(true);
    const newComment = await feedService.addPostComment(post.id, commentText.trim());
    setIsSubmitting(false);

    if (newComment) {
      setCommentText('');
      const updatedComments = [...comments, newComment];
      const updatedPost: FeedPost = {
        ...post,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onPostUpdated?.(updatedPost);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const success = await feedService.deletePostComment(post.id, commentId);
    if (success) {
      const updatedComments = comments.filter(c => c.id !== commentId);
      const updatedPost: FeedPost = {
        ...post,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onPostUpdated?.(updatedPost);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    const success = await feedService.togglePostCommentLike(post.id, commentId);
    if (success) {
      const updatedComments = comments.map(c => {
        if (c.id !== commentId) return c;

        const likes = [...(c.likes || [])];
        const existingIndex = likes.findIndex(l => l.user_id === currentUserId);

        if (existingIndex >= 0) {
          likes.splice(existingIndex, 1);
        } else if (currentUserId) {
          likes.push({
            user_id: currentUserId,
            username: '',
            created_at: new Date().toISOString(),
          });
        }

        return { ...c, likes };
      });

      const updatedPost: FeedPost = {
        ...post,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onPostUpdated?.(updatedPost);
    }
  };

  const handleUserTap = (userId: string, username: string, profilePictureUrl?: string) => {
    onClose();
    onUserPress?.(userId, username, profilePictureUrl);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop - tap to close */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Half-screen container */}
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
            <View style={styles.handle} />
            <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              Comments {comments.length > 0 && `(${comments.length})`}
            </Text>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {comments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={40} color={currentTheme.colors.text + '30'} />
                <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                  No comments yet
                </Text>
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                  Be the first to comment!
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {comments.map(comment => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    postId={post.id}
                    currentUserId={currentUserId}
                    isAuthor={comment.user_id === currentUserId}
                    onDelete={handleDeleteComment}
                    onLike={handleLikeComment}
                    onUserPress={handleUserTap}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {/* Comment Input */}
          <View style={[styles.inputContainer, { backgroundColor: currentTheme.colors.background, borderTopColor: currentTheme.colors.border }]}>
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

          {/* Bottom safe area padding */}
          <View style={{ height: Platform.OS === 'ios' ? 34 : 16 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    height: SCREEN_HEIGHT * 0.5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  commentsList: {
    gap: 16,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    fontSize: 15,
    fontFamily: 'Raleway_600SemiBold',
  },
  commentAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 14,
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 22,
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
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    marginLeft: 8,
    borderRadius: 8,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
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
});
