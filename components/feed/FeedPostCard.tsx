import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeTime } from '@/lib/formatters';
import playHapticFeedback from '@/lib/haptic';
import { FeedPost } from '@/lib/feedService';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

interface FeedPostCardProps {
  post: FeedPost;
  onPress: () => void;
  onUserPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  currentUserId?: string | null;
}

export default function FeedPostCard({
  post,
  onPress,
  onUserPress,
  onLike,
  onComment,
  currentUserId,
}: FeedPostCardProps) {
  const { currentTheme } = useTheme();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Get first media item for display (can enhance to carousel later)
  const firstMedia = post.media?.[0];
  const hasVideo = firstMedia?.type === 'video';

  const player = useVideoPlayer(hasVideo && firstMedia?.url ? firstMedia.url : null, player => {
    player.loop = true;
  });

  // Smooth animation for like button
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
    onLike?.();
  };

  const feedData = post.feed_data;
  const likes = feedData?.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;
  const comments = feedData?.comments || [];
  const commentCount = comments.length;

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

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: currentTheme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Header with user info */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={onUserPress} activeOpacity={0.7}>
          {post.profile_picture_url ? (
            <Image source={{ uri: post.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: currentTheme.colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: currentTheme.colors.primary }]}>
                {post.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              @{post.username}
            </Text>
            <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
              {formatRelativeTime(post.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Post text */}
      {post.text && (
        <Text style={[styles.postText, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
          {post.text}
        </Text>
      )}

      {/* Media */}
      {firstMedia && (
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
          ) : (
            <Image
              source={{ uri: firstMedia.url }}
              style={styles.media}
              resizeMode="cover"
            />
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
    gap: 12,
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
  postText: {
    fontSize: 16,
    lineHeight: 24,
  },
  mediaContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  media: {
    width: '100%',
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
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
