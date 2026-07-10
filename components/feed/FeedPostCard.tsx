import { Text, View } from '@/components/Themed';
import { useImageCarousel } from '@/hooks/useImageCarousel';
import { useMute } from '@/hooks/useMute';
import { useTheme } from '@/contexts/ThemeContext';
import { useVideoPlayerContext } from '@/contexts/VideoPlayerContext';
import { formatRelativeTime } from '@/lib/ui/formatters';
import playHapticFeedback from '@/lib/utils/haptic';
import { getTierColor } from '@/lib/data/strengthStandards';
import { FeedPost } from '@/lib/services/feedService';
import { UserStrengthSummary } from '@/lib/services/userSyncService';
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
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import FullScreenImageViewer from './FullScreenImageViewer';
import FullScreenVideoViewer from './FullScreenVideoViewer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_WIDTH = SCREEN_WIDTH - 32;

interface FeedPostCardProps {
  post: FeedPost;
  onUserPress?: (post: FeedPost) => void;
  onLike?: (post: FeedPost) => void;
  onComment?: (post: FeedPost) => void;
  currentUserId?: string | null;
  isVisible?: boolean;
  /** Author's overall strength — colors the username and shows their percentile. */
  overallStrength?: UserStrengthSummary;
}

function FeedPostCard({
  post,
  onUserPress,
  onLike,
  onComment,
  currentUserId,
  isVisible = false,
  overallStrength,
}: FeedPostCardProps) {
  const { currentTheme } = useTheme();
  const { registerPlayer, unregisterPlayer, setActiveVideo, clearActiveIfMatches } = useVideoPlayerContext();
  const [showFullScreenVideo, setShowFullScreenVideo] = useState(false);
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

  const { currentImageIndex, showFullScreen, fullScreenInitialIndex, setShowFullScreen, handleImagePress, handleImageScroll } = useImageCarousel(imageUrls, MEDIA_WIDTH);
  const hasVideo = firstVideo && !videoFailed;
  const hasMedia = (imageUrls.length > 0 || hasVideo);

  const player = useVideoPlayer(hasVideo && firstVideo?.url ? firstVideo.url : null, player => {
    player.loop = true;
    player.muted = false;
  });

  const { isMuted, toggleMute } = useMute(player);

  useEffect(() => {
    if (player && hasVideo) {
      registerPlayer(videoId, player);
      return () => unregisterPlayer(videoId);
    }
  }, [player, hasVideo, videoId, registerPlayer, unregisterPlayer]);

  // Hide the video if it fails to load.
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

  useEffect(() => {
    if (!player || !hasVideo) return;

    if (isVisible && !showFullScreenVideo) {
      setActiveVideo(videoId);
    } else {
      // Clear only if this video was active (prevents race conditions).
      clearActiveIfMatches(videoId);
    }
  }, [isVisible, showFullScreenVideo, player, hasVideo, videoId, setActiveVideo, clearActiveIfMatches]);

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
    onLike?.(post);
  };

  const feedData = post.feed_data;
  const likes = feedData?.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;
  const comments = feedData?.comments || [];
  const commentCount = comments.length;



  return (
    <>
      <View
        style={[styles.container, { borderBottomColor: currentTheme.colors.border }]}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.userInfo} onPress={() => onUserPress?.(post)} activeOpacity={0.7}>
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
              <Text style={[styles.username, { color: overallStrength ? getTierColor(overallStrength.tier) : currentTheme.colors.text, fontWeight: '600' }]}>
                @{post.username}
              </Text>
              <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
                {formatRelativeTime(post.created_at)}
                {overallStrength && (
                  <>
                    {' · '}
                    <Text style={[styles.percentile, { color: getTierColor(overallStrength.tier) }]}>
                      {overallStrength.percentile}%
                    </Text>
                  </>
                )}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {post.text && (
          <Text style={[styles.postText, { color: currentTheme.colors.text, fontWeight: '400' }]}>
            {post.text}
          </Text>
        )}

        {hasMedia && (
          <View style={styles.mediaContainer}>
            {hasVideo ? (
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

                <View style={[styles.counterBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Text style={styles.counterText}>
                    {currentImageIndex + 1}/{imageUrls.length}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.actionBar}>
          <View style={styles.actionLeft}>
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
                <Text style={[styles.actionCount, { color: userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70', fontWeight: '500' }]}>
                  {likeCount}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onComment?.(post)}
              activeOpacity={0.6}
            >
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={currentTheme.colors.text + '70'}
              />
              {commentCount > 0 && (
                <Text style={[styles.actionCount, { color: currentTheme.colors.text + '70', fontWeight: '500' }]}>
                  {commentCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FullScreenImageViewer
        visible={showFullScreen}
        images={imageUrls}
        initialIndex={fullScreenInitialIndex}
        onClose={() => setShowFullScreen(false)}
        likes={likes}
        currentUserId={currentUserId}
        onLike={handleLike}
      />

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

export default React.memo(FeedPostCard);

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
  percentile: {
    fontSize: 13,
    fontWeight: '700',
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
    height: SCREEN_WIDTH * 1.1,
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
    height: SCREEN_WIDTH * 1.1,
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
