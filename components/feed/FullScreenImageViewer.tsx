import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
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

  // Reset index when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      scale.value = 1;
    }
  }, [visible, initialIndex, scale]);

  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;
  const hasSocialFeatures = onLike !== undefined;

  // Like animation
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

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
    likeScale.value = withSequence(
      withTiming(1.3, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onLike?.();
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {images.length > 1 && (
              <View style={styles.counter}>
                <Text style={styles.counterText}>
                  {currentIndex + 1} / {images.length}
                </Text>
              </View>
            )}
            <View style={{ width: 44 }} />
          </View>

          {/* Image Carousel */}
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

          {/* Page Indicators */}
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

          {/* Like Button */}
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
