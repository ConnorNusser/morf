import { Text } from '@/components/Themed';
import { useMute } from '@/hooks/useMute';
import { useLikePop } from '@/hooks/useLikePop';
import playHapticFeedback from '@/lib/utils/haptic';
import { formatDuration } from '@/lib/utils/utils';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MediaViewerShell from '@/components/feed/MediaViewerShell';
import Animated from 'react-native-reanimated';

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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const player = useVideoPlayer(videoUrl, player => {
    player.loop = true;
    player.muted = false;
  });

  const { isMuted, toggleMute, setIsMuted } = useMute(player);

  useEffect(() => {
    if (visible) {
      player.play();
      setIsPlaying(true);
      setIsMuted(false);
    }
  }, [visible, player, setIsMuted]);

  useEffect(() => {
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

  const { likeAnimatedStyle, pop } = useLikePop();

  const handleLike = () => {
    playHapticFeedback('light', false);
    pop();
    onLike?.();
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying(!isPlaying);
  };


  const handleClose = () => {
    player.pause();
    onClose();
  };

  const formatTime = (seconds: number) => formatDuration(Math.floor(seconds));

  if (!visible || !videoUrl) return null;

  return (
    <MediaViewerShell visible={visible} onClose={handleClose}>

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

            {!isPlaying && (
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <Ionicons name="play" size={48} color="#fff" />
                </View>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.controlsBar}>
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

            <View style={styles.bottomControls}>
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
    </MediaViewerShell>
  );
}

const styles = StyleSheet.create({
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
  },
  likeCountActive: {
    color: '#ff4757',
  },
});
