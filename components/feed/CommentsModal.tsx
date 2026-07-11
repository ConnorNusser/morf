import { Text, View } from '@/components/Themed';
import UserAvatar from '@/components/ui/UserAvatar';
import { useLikePop } from '@/hooks/useLikePop';
import { useTheme } from '@/contexts/ThemeContext';
import { usePauseVideosWhileOpen } from '@/contexts/VideoPlayerContext';
import { formatRelativeTime } from '@/lib/ui/formatters';
import playHapticFeedback from '@/lib/utils/haptic';
import { feedService, FeedComment, FeedPost } from '@/lib/services/feedService';
import { notificationService } from '@/lib/services/notificationService';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  InputAccessoryView,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COMMENTS_INPUT_ACCESSORY_ID = 'commentsInputAccessory';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  post: FeedPost | null;
  currentUserId: string | null;
  currentUsername?: string;
  onPostUpdated?: (post: FeedPost) => void;
  onUserPress?: (userId: string, username: string, profilePictureUrl?: string) => void;
}

interface CommentItemProps {
  comment: FeedComment;
  currentUserId: string | null;
  isAuthor: boolean;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  onUserPress: (userId: string, username: string, profilePictureUrl?: string) => void;
}

function CommentItem({
  comment,
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

  const { likeAnimatedStyle, pop } = useLikePop();

  const handleLike = () => {
    playHapticFeedback('light', false);
    pop();
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
        <UserAvatar uri={comment.profile_picture_url} size={36} />
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

export default function CommentsModal({
  visible,
  onClose,
  post,
  currentUserId,
  currentUsername,
  onPostUpdated,
  onUserPress,
}: CommentsModalProps) {
  const { currentTheme } = useTheme();
  usePauseVideosWhileOpen(visible);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      Keyboard.dismiss();
      inputRef.current?.blur();
      setIsKeyboardVisible(false);
    }
  }, [visible]);

  if (!post) return null;

  const feedData = post.feed_data;
  const comments = feedData?.comments || [];

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    const trimmedComment = commentText.trim();
    Keyboard.dismiss();
    setIsSubmitting(true);
    const newComment = await feedService.addPostComment(post.id, trimmedComment);
    setIsSubmitting(false);

    if (newComment) {
      if (post.user_id !== currentUserId && currentUserId && currentUsername) {
        notificationService.notifyPostComment(
          post.user_id,
          currentUserId,
          currentUsername,
          trimmedComment
        ).catch(err => console.error('Error sending comment notification:', err));
      }

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
    Keyboard.dismiss();
    inputRef.current?.blur();
    onClose();
    onUserPress?.(userId, username, profilePictureUrl);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleClose = () => {
    Keyboard.dismiss();
    inputRef.current?.blur();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <RNView style={styles.modalWrapper}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[
          styles.container,
          { backgroundColor: currentTheme.colors.background },
          isKeyboardVisible && styles.containerExpanded
        ]}>
          <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
            <View style={styles.handle} />
            <Text variant="body" tone="primary" weight="semiBold">
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
                <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontWeight: '600' }]}>
                  No comments yet
                </Text>
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
                  Be the first to comment!
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {comments.map(comment => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
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

          {!isKeyboardVisible && (
            <TouchableOpacity
              style={[styles.inputPlaceholder, { backgroundColor: currentTheme.colors.background, borderTopColor: currentTheme.colors.border }]}
              onPress={focusInput}
              activeOpacity={0.7}
            >
              <RNView style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.surface }]}>
                <Text style={[styles.placeholderText, { color: currentTheme.colors.text + '40', fontWeight: '400' }]}>
                  Add a comment...
                </Text>
                <RNView style={styles.sendButtonPlaceholder}>
                  <Ionicons name="arrow-up-circle" size={28} color={currentTheme.colors.text + '30'} />
                </RNView>
              </RNView>
            </TouchableOpacity>
          )}

          {/* Hidden TextInput to trigger keyboard */}
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={commentText}
            onChangeText={setCommentText}
            inputAccessoryViewID={COMMENTS_INPUT_ACCESSORY_ID}
          />
        </View>

        {(
          <InputAccessoryView nativeID={COMMENTS_INPUT_ACCESSORY_ID}>
            <RNView style={[styles.accessoryContainer, { backgroundColor: currentTheme.colors.background, borderTopColor: currentTheme.colors.border }]}>
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
                  autoFocus
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
            </RNView>
          </InputAccessoryView>
        )}
      </RNView>
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
  containerExpanded: {
    height: SCREEN_HEIGHT * 0.8,
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
  inputPlaceholder: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  placeholderText: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  sendButtonPlaceholder: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
  },
  accessoryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
