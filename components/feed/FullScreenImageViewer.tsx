import { Ionicons } from '@expo/vector-icons';
import { useLikePop } from '@/hooks/useLikePop';
import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import MediaViewerShell from '@/components/feed/MediaViewerShell';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Text } from '@/components/Themed';
import playHapticFeedback from '@/lib/utils/haptic';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FullScreenImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  likes?: { user_id: string; username: string }[];
  currentUserId?: string | null;
  onLike?: () => void;
}

export default function FullScreenImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
  likes = [],
  currentUserId,
  onLike,
}: FullScreenImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      scale.value = 1;
    }
  }, [visible, initialIndex, scale]);

  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;
  const hasSocialFeatures = onLike !== undefined;

  const { likeAnimatedStyle, pop } = useLikePop();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < images.length) {
      setCurrentIndex(index);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleDoubleTap = () => {
    scale.value = scale.value > 1 ? withSpring(1) : withSpring(2);
  };

  const handleLike = () => {
    playHapticFeedback('light', false);
    pop();
    onLike?.();
  };

  if (!visible || images.length === 0) return null;

  return (
    <MediaViewerShell
      visible={visible}
      onClose={onClose}
      headerCenter={
        images.length > 1 ? (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        ) : null
      }
    >

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
            style={styles.scrollView}
          >
            {images.map((uri, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={1}
                onPress={handleDoubleTap}
                style={styles.imageWrapper}
              >
                <Animated.View style={animatedStyle}>
                  <Image
                    source={{ uri }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: index === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                      width: index === currentIndex ? 8 : 6,
                      height: index === currentIndex ? 8 : 6,
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {hasSocialFeatures && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleLike}
                activeOpacity={0.7}
              >
                <Animated.View style={likeAnimatedStyle}>
                  <Ionicons
                    name={userHasLiked ? 'heart' : 'heart-outline'}
                    size={28}
                    color={userHasLiked ? '#ff4757' : '#fff'}
                  />
                </Animated.View>
                {likeCount > 0 && (
                  <Text style={[styles.actionCount, userHasLiked && styles.actionCountActive]}>
                    {likeCount}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
    </MediaViewerShell>
  );
}

const styles = StyleSheet.create({
  counter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
  },
  dot: {
    borderRadius: 4,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionCount: {
    color: '#fff',
    fontSize: 16,
  },
  actionCountActive: {
    color: '#ff4757',
  },
});
