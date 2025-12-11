import { Text } from '@/components/Themed';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FullScreenVideoViewerProps {
  visible: boolean;
  videoUrl: string | null;
  onClose: () => void;
  likes?: { user_id: string; username: string }[];
  currentUserId?: string | null;
  onLike?: () => void;
}

export default function FullScreenVideoViewer({
  visible,
  videoUrl,
  onClose,
  likes = [],
  currentUserId,
  onLike,
}: FullScreenVideoViewerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const player = useVideoPlayer(videoUrl, player => {
    player.loop = true;
    player.muted = false;
  });

  // Auto-play when modal opens
  useEffect(() => {
    if (visible && player) {
      player.play();
      setIsPlaying(true);
      setIsMuted(false);
    }
  }, [visible, player]);

  // Sync muted state
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [player, isMuted]);

  // Track progress
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (player.playing) {
        setProgress(player.currentTime);
        setDuration(player.duration);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player]);

  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;
  const hasSocialFeatures = onLike !== undefined;

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
    onLike?.();
  };

  const togglePlayPause = () => {
    if (player) {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    playHapticFeedback('light', false);
  };

  const handleClose = () => {
    if (player) {
      player.pause();
    }
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible || !videoUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={{ width: 44 }} />
          </View>

          {/* Video */}
          <TouchableOpacity
            style={styles.videoContainer}
            onPress={togglePlayPause}
            activeOpacity={1}
          >
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
            />

            {/* Play/Pause overlay */}
            {!isPlaying && (
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <Ionicons name="play" size={48} color="#fff" />
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Controls bar */}
          <View style={styles.controlsBar}>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }
                  ]}
                />
              </View>
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(progress)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              {/* Mute button */}
              <TouchableOpacity
                style={styles.controlButton}
                onPress={toggleMute}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isMuted ? 'volume-mute' : 'volume-high'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              {/* Like button */}
              {hasSocialFeatures && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handleLike}
                  activeOpacity={0.7}
                >
                  <Animated.View style={[styles.likeContainer, likeAnimatedStyle]}>
                    <Ionicons
                      name={userHasLiked ? 'heart' : 'heart-outline'}
                      size={24}
                      color={userHasLiked ? '#ff4757' : '#fff'}
                    />
                    {likeCount > 0 && (
                      <Text style={[styles.likeCount, userHasLiked && styles.likeCountActive]}>
                        {likeCount}
                      </Text>
                    )}
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsBar: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  progressContainer: {
    gap: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCount: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Raleway_600SemiBold',
  },
  likeCountActive: {
    color: '#ff4757',
  },
});
