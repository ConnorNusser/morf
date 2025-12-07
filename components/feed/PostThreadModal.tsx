import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeTime } from '@/lib/formatters';
import playHapticFeedback from '@/lib/haptic';
import { feedService, FeedComment, FeedPost } from '@/lib/feedService';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import FullScreenImageViewer from './FullScreenImageViewer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_WIDTH = SCREEN_WIDTH - 40;

interface PostThreadModalProps {
  visible: boolean;
  onClose: () => void;
  post: FeedPost | null;
  currentUserId: string | null;
  onLike?: () => void;
  onPostUpdated?: (post: FeedPost) => void;
  onUserPress?: (userId: string, username: string, profilePictureUrl?: string) => void;
}

export default function PostThreadModal({
  visible,
  onClose,
  post,
  currentUserId,
  onLike,
  onPostUpdated,
  onUserPress,
}: PostThreadModalProps) {
  const { currentTheme } = useTheme();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenInitialIndex, setFullScreenInitialIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Smooth animation for like button
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const mediaItems = post?.media || [];
  const hasVideo = mediaItems.some(m => m.type === 'video');
  const imageUrls = mediaItems.filter(m => m.type === 'image').map(m => m.url);
  const firstVideo = mediaItems.find(m => m.type === 'video');

  const player = useVideoPlayer(hasVideo && firstVideo?.url ? firstVideo.url : null, player => {
    player.loop = true;
  });

  const handleLike = () => {
    playHapticFeedback('light', false);
    likeScale.value = withSequence(
      withTiming(1.25, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onLike?.();
  };

  if (!post) return null;

  const feedData = post.feed_data;
  const likes = feedData?.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;
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

  const handleImageScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / MEDIA_WIDTH);
    if (index !== currentImageIndex && index >= 0 && index < imageUrls.length) {
      setCurrentImageIndex(index);
    }
  };

  const handleImagePress = (index: number) => {
    setFullScreenInitialIndex(index);
    setShowFullScreen(true);
  };

  const toggleVideo = () => {
    if (player) {
      if (isVideoPlaying) {
        player.pause();
      } else {
        player.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  const handleUserTap = (userId: string, username: string, profilePictureUrl?: string) => {
    onClose(); // Close modal first
    onUserPress?.(userId, username, profilePictureUrl);
  };

  const renderComment = (comment: FeedComment) => {
    const canDelete = comment.user_id === currentUserId || post.user_id === currentUserId;

    return (
      <View key={comment.id} style={styles.commentItem}>
        <TouchableOpacity
          onPress={() => handleUserTap(comment.user_id, comment.username, comment.profile_picture_url)}
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
              onPress={() => handleUserTap(comment.user_id, comment.username, comment.profile_picture_url)}
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
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
            <IconButton icon="close" onPress={onClose} />
            <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              Post
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
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => handleUserTap(post.user_id, post.username, post.profile_picture_url)}
                activeOpacity={0.7}
              >
                {post.profile_picture_url ? (
                  <Image source={{ uri: post.profile_picture_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                    <Text style={[styles.avatarText, { color: currentTheme.colors.primary }]}>
                      {post.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    @{post.username}
                  </Text>
                  <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                    {formatRelativeTime(post.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Post text */}
              {post.text && (
                <Text style={[styles.postText, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
                  {post.text}
                </Text>
              )}

              {/* Media */}
              {mediaItems.length > 0 && (
                <View style={styles.mediaContainer}>
                  {hasVideo ? (
                    <TouchableOpacity onPress={toggleVideo} activeOpacity={0.9}>
                      <VideoView
                        player={player}
                        style={styles.media}
                        contentFit="cover"
                      />
                      {!isVideoPlaying && (
                        <View style={styles.playButtonOverlay}>
                          <View style={[styles.playButton, { backgroundColor: currentTheme.colors.background + 'CC' }]}>
                            <Ionicons name="play" size={32} color={currentTheme.colors.text} />
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : imageUrls.length === 1 ? (
                    <TouchableOpacity onPress={() => handleImagePress(0)} activeOpacity={0.9}>
                      <Image
                        source={{ uri: imageUrls[0] }}
                        style={styles.media}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleImageScroll}
                        scrollEventThrottle={16}
                        decelerationRate="fast"
                        snapToInterval={MEDIA_WIDTH}
                      >
                        {imageUrls.map((url, index) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => handleImagePress(index)}
                            activeOpacity={0.9}
                          >
                            <Image
                              source={{ uri: url }}
                              style={styles.carouselImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      <View style={styles.pagination}>
                        {imageUrls.map((_, index) => (
                          <View
                            key={index}
                            style={[
                              styles.dot,
                              {
                                backgroundColor: index === currentImageIndex
                                  ? currentTheme.colors.primary
                                  : currentTheme.colors.text + '30',
                                width: index === currentImageIndex ? 8 : 6,
                                height: index === currentImageIndex ? 8 : 6,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Like and comment row */}
              <View style={[styles.actionsRow, { borderColor: currentTheme.colors.border }]}>
                <View style={styles.actionsLeft}>
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
                      <Text style={[styles.likeCount, { color: userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
                        {likeCount}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.commentCount}>
                  <Ionicons name="chatbubble-outline" size={18} color={currentTheme.colors.text + '60'} />
                  <Text style={[styles.commentCountText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
                    {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                  </Text>
                </View>
              </View>

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
        </SafeAreaView>
      </Modal>

      <FullScreenImageViewer
        visible={showFullScreen}
        images={imageUrls}
        initialIndex={fullScreenInitialIndex}
        onClose={() => setShowFullScreen(false)}
      />
    </>
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
    gap: 16,
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
  postText: {
    fontSize: 17,
    lineHeight: 26,
  },
  mediaContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  media: {
    width: MEDIA_WIDTH,
    height: 300,
    borderRadius: 16,
  },
  carouselImage: {
    width: MEDIA_WIDTH,
    height: 300,
    borderRadius: 16,
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    borderRadius: 4,
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
  commentAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
});
