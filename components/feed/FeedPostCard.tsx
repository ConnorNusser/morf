import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useVideoPlayerContext } from '@/contexts/VideoPlayerContext';
import { formatRelativeTime } from '@/lib/ui/formatters';
import playHapticFeedback from '@/lib/utils/haptic';
import { FeedPost } from '@/lib/services/feedService';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState, useEffect } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import FullScreenImageViewer from './FullScreenImageViewer';
import FullScreenVideoViewer from './FullScreenVideoViewer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_WIDTH = SCREEN_WIDTH - 32; // padding on each side

interface FeedPostCardProps {
  post: FeedPost;
  onUserPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  currentUserId?: string | null;
  isVisible?: boolean;
}

export default function FeedPostCard({
  post,
  onUserPress,
  onLike,
  onComment,
  currentUserId,
  isVisible = false,
}: FeedPostCardProps) {
  const { currentTheme } = useTheme();
  const { registerPlayer, unregisterPlayer, setActiveVideo, clearActiveIfMatches } = useVideoPlayerContext();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [fullScreenInitialIndex, setFullScreenInitialIndex] = useState(0);
  const [showFullScreenVideo, setShowFullScreenVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isHoldingVideo, setIsHoldingVideo] = useState(false);
  const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());
  const [videoFailed, setVideoFailed] = useState(false);

  const videoId = `post-${post.id}`;
  const mediaItems = post.media || [];
  const firstVideo = mediaItems.find(m => m.type === 'video');
  const imageUrls = mediaItems
    .filter(m => m.type === 'image')
    .map(m => m.url)
    .filter(url => !failedMedia.has(url));
  const hasVideo = firstVideo && !videoFailed;
  const hasMedia = (imageUrls.length > 0 || hasVideo);

  // Player for inline video
  const player = useVideoPlayer(hasVideo && firstVideo?.url ? firstVideo.url : null, player => {
    player.loop = true;
    player.muted = false;
  });

  // Register player with context
  useEffect(() => {
    if (player && hasVideo) {
      registerPlayer(videoId, player);
      return () => unregisterPlayer(videoId);
    }
  }, [player, hasVideo, videoId, registerPlayer, unregisterPlayer]);

  // Listen for video errors to hide broken videos
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener('statusChange', (status) => {
      if (status.error) {
        console.warn('Video failed to load:', firstVideo?.url);
        setVideoFailed(true);
      }
    });

    return () => subscription.remove();
  }, [player, firstVideo?.url]);

  // Sync mute state with player
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [player, isMuted]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    playHapticFeedback('light', false);
  };

  const handleVideoLongPress = () => {
    if (!player) return;
    setIsHoldingVideo(true);
    playHapticFeedback('light', false);
    try {
      player.pause();
    } catch {
      // Player may not be ready
    }
  };

  const handleVideoPressOut = () => {
    if (!player || !isHoldingVideo) return;
    setIsHoldingVideo(false);
    try {
      player.play();
    } catch {
      // Player may not be ready
    }
  };

  // Control playback based on visibility
  useEffect(() => {
    if (!player || !hasVideo) return;

    if (isVisible && !showFullScreenVideo) {
      setActiveVideo(videoId);
    } else {
      // Clear active video only if this video was active (prevents race conditions)
      clearActiveIfMatches(videoId);
    }
  }, [isVisible, showFullScreenVideo, player, hasVideo, videoId, setActiveVideo, clearActiveIfMatches]);

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

  return (
    <>
      <View
        style={[styles.container, { borderBottomColor: currentTheme.colors.border }]}
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
              <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                @{post.username}
              </Text>
              <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                {formatRelativeTime(post.created_at)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Post text */}
        {post.text && (
          <Text style={[styles.postText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}>
            {post.text}
          </Text>
        )}

        {/* Media */}
        {hasMedia && (
          <View style={styles.mediaContainer}>
            {hasVideo ? (
              // Video player - auto-plays, tap to open fullscreen, long press to pause
              <View style={styles.videoWrapper}>
                <Pressable
                  onPress={() => setShowFullScreenVideo(true)}
                  onLongPress={handleVideoLongPress}
                  onPressOut={handleVideoPressOut}
                  delayLongPress={200}
                >
                  <VideoView
                    player={player}
                    style={styles.videoMedia}
                    contentFit="cover"
                    nativeControls={false}
                  />
                </Pressable>

                {/* Mute/unmute button */}
                <TouchableOpacity
                  style={styles.muteButton}
                  onPress={toggleMute}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isMuted ? 'volume-mute' : 'volume-high'}
                    size={18}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            ) : imageUrls.length === 1 ? (
              // Single image - tap to fullscreen, edge-to-edge
              <View style={styles.imageWrapper}>
                <TouchableOpacity onPress={() => handleImagePress(0)} activeOpacity={0.9}>
                  <Image
                    source={{ uri: imageUrls[0] }}
                    style={styles.fullWidthImage}
                    resizeMode="cover"
                    onError={() => setFailedMedia(prev => new Set(prev).add(imageUrls[0]))}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              // Multiple images - carousel, edge-to-edge
              <View style={styles.imageWrapper}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleImageScroll}
                  scrollEventThrottle={16}
                  decelerationRate="fast"
                  snapToInterval={SCREEN_WIDTH}
                >
                  {imageUrls.map((url, index) => (
                    <TouchableOpacity
                      key={url}
                      onPress={() => handleImagePress(index)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: url }}
                        style={styles.fullWidthImage}
                        resizeMode="cover"
                        onError={() => setFailedMedia(prev => new Set(prev).add(url))}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Page indicators - overlaid on image */}
                <View style={styles.paginationOverlay}>
                  {imageUrls.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: index === currentImageIndex
                            ? '#fff'
                            : 'rgba(255,255,255,0.5)',
                          width: index === currentImageIndex ? 8 : 6,
                          height: index === currentImageIndex ? 8 : 6,
                        },
                      ]}
                    />
                  ))}
                </View>

                {/* Image counter badge */}
                <View style={[styles.counterBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Text style={styles.counterText}>
                    {currentImageIndex + 1}/{imageUrls.length}
                  </Text>
                </View>
              </View>
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
                <Text style={[styles.actionCount, { color: userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70', fontFamily: currentTheme.fonts.medium }]}>
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
                <Text style={[styles.actionCount, { color: currentTheme.colors.text + '70', fontFamily: currentTheme.fonts.medium }]}>
                  {commentCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Full screen image viewer */}
      <FullScreenImageViewer
        visible={showFullScreen}
        images={imageUrls}
        initialIndex={fullScreenInitialIndex}
        onClose={() => setShowFullScreen(false)}
        likes={likes}
        currentUserId={currentUserId}
        onLike={handleLike}
      />

      {/* Full screen video viewer */}
      <FullScreenVideoViewer
        visible={showFullScreenVideo}
        videoUrl={firstVideo?.url || null}
        onClose={() => setShowFullScreenVideo(false)}
        likes={likes}
        currentUserId={currentUserId}
        onLike={handleLike}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    marginTop: 4,
  },
  videoWrapper: {
    marginHorizontal: -36, // Extend to screen edges (20 list padding + 16 card padding)
  },
  videoMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.1, // Taller video, almost square
  },
  muteButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    marginHorizontal: -36, // Extend to screen edges (20 list padding + 16 card padding)
  },
  fullWidthImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.1, // Same height as video
  },
  paginationOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderRadius: 4,
  },
  counterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
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
