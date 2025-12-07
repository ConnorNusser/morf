import SkeletonCard from '@/components/SkeletonCard';
import { Text, View } from '@/components/Themed';
import { useTabBar } from '@/contexts/TabBarContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useVideoControl } from '@/contexts/VideoPlayerContext';
import playHapticFeedback from '@/lib/haptic';
import { feedService, FeedPost } from '@/lib/feedService';
import { userSyncService } from '@/lib/userSyncService';
import { RemoteUser } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, NativeScrollEvent, NativeSyntheticEvent, RefreshControl, StyleSheet, TouchableOpacity, ViewToken } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import CreatePostModal from './CreatePostModal';
import FeedCard, { FeedWorkout } from './FeedCard';
import FeedPostCard from './FeedPostCard';
import CommentsModal from './CommentsModal';
import WorkoutThreadModal from './WorkoutThreadModal';

const PAGE_SIZE = 15;

// Combined feed item type
type FeedItem =
  | { type: 'workout'; data: FeedWorkout }
  | { type: 'post'; data: FeedPost };

interface FeedViewProps {
  onUserPress: (user: RemoteUser) => void;
  refreshTrigger?: number;
}

export default function FeedView({ onUserPress, refreshTrigger }: FeedViewProps) {
  const { currentTheme } = useTheme();
  const { setTabBarVisible, setTabBarBackgroundVisible, tabBarVisible } = useTabBar();
  const { resumeActive: resumeVideos } = useVideoControl();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<FeedWorkout | null>(null);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());

  // Scroll handling for tab bar visibility
  const lastScrollY = useRef(0);

  // Viewability config for auto-playing videos
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 80,
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleKeys = new Set(viewableItems.map(item => `${item.item.type}-${item.item.data.id}`));
    setVisibleItems(visibleKeys);
  }, []);

  // Hide tab bar background when feed is focused, show when unfocused
  // Resume videos when returning to feed view
  useFocusEffect(
    useCallback(() => {
      setTabBarBackgroundVisible(false);
      resumeVideos();
      return () => {
        setTabBarBackgroundVisible(true);
      };
    }, [setTabBarBackgroundVisible, resumeVideos])
  );

  // Animated style for FAB that follows tab bar visibility
  const fabAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{
        translateY: withTiming(tabBarVisible.value === 1 ? 0 : 80, {
          duration: 200,
        }),
      }],
    };
  });

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const isScrollingDown = currentScrollY > lastScrollY.current;

    if (isScrollingDown && currentScrollY > 20) {
      // Scrolling down - hide tab bar
      setTabBarVisible(false);
    } else if (!isScrollingDown && currentScrollY < lastScrollY.current - 10) {
      // Scrolling up significantly - show tab bar
      setTabBarVisible(true);
    }

    lastScrollY.current = currentScrollY;
  }, [setTabBarVisible]);


  const loadFeed = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [workouts, posts, user] = await Promise.all([
        feedService.getGlobalWorkoutFeed(PAGE_SIZE, 0),
        feedService.getPosts(PAGE_SIZE, 0),
        userSyncService.getCurrentUser(),
      ]);

      // Combine and sort by date
      const combined: FeedItem[] = [
        ...workouts.map(w => ({ type: 'workout' as const, data: w })),
        ...posts.map(p => ({ type: 'post' as const, data: p })),
      ].sort((a, b) => {
        const dateA = a.data.created_at instanceof Date ? a.data.created_at : new Date(a.data.created_at);
        const dateB = b.data.created_at instanceof Date ? b.data.created_at : new Date(b.data.created_at);
        return dateB.getTime() - dateA.getTime();
      });

      setFeedItems(combined);
      setCurrentUserId(user?.id || null);
      setHasMore(workouts.length >= PAGE_SIZE || posts.length >= PAGE_SIZE);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const workoutCount = feedItems.filter(i => i.type === 'workout').length;
      const postCount = feedItems.filter(i => i.type === 'post').length;

      const [moreWorkouts, morePosts] = await Promise.all([
        feedService.getGlobalWorkoutFeed(PAGE_SIZE, workoutCount),
        feedService.getPosts(PAGE_SIZE, postCount),
      ]);

      if (moreWorkouts.length < PAGE_SIZE && morePosts.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (moreWorkouts.length > 0 || morePosts.length > 0) {
        const newItems: FeedItem[] = [
          ...moreWorkouts.map(w => ({ type: 'workout' as const, data: w })),
          ...morePosts.map(p => ({ type: 'post' as const, data: p })),
        ].sort((a, b) => {
          const dateA = a.data.created_at instanceof Date ? a.data.created_at : new Date(a.data.created_at);
          const dateB = b.data.created_at instanceof Date ? b.data.created_at : new Date(b.data.created_at);
          return dateB.getTime() - dateA.getTime();
        });

        setFeedItems(prev => [...prev, ...newItems]);
      }
    } catch (error) {
      console.error('Error loading more feed:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [feedItems, hasMore, isLoadingMore]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed, refreshTrigger]);

  const handleUserPress = (userId: string, username: string, profilePictureUrl?: string) => {
    onUserPress({
      id: userId,
      device_id: '',
      username,
      profile_picture_url: profilePictureUrl,
    });
  };

  const handleWorkoutPress = (workout: FeedWorkout) => {
    setSelectedWorkout(workout);
  };

  const handlePostPress = (post: FeedPost) => {
    setSelectedPost(post);
  };

  const updatePostInFeed = (updatedPost: FeedPost) => {
    setFeedItems(prev => prev.map(item => {
      if (item.type === 'post' && item.data.id === updatedPost.id) {
        return { ...item, data: updatedPost };
      }
      return item;
    }));
    setSelectedPost(updatedPost);
  };

  const updateWorkoutInFeed = (updatedWorkout: FeedWorkout) => {
    setFeedItems(prev => prev.map(item => {
      if (item.type === 'workout' && item.data.id === updatedWorkout.id) {
        return { ...item, data: updatedWorkout };
      }
      return item;
    }));
    setSelectedWorkout(updatedWorkout);
  };

  const handleWorkoutLike = async (workoutId: string) => {
    const success = await feedService.toggleLike(workoutId);
    if (success) {
      setFeedItems(prev => prev.map(item => {
        if (item.type !== 'workout' || item.data.id !== workoutId) return item;

        const workout = item.data;
        const feedData = workout.feed_data || {};
        const likes = [...(feedData.likes || [])];
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

        const updated = {
          ...workout,
          feed_data: { ...feedData, likes },
        };

        if (selectedWorkout?.id === workoutId) {
          setSelectedWorkout(updated);
        }

        return { ...item, data: updated };
      }));
    }
  };

  const handlePostLike = async (postId: string) => {
    const success = await feedService.togglePostLike(postId);
    if (success) {
      setFeedItems(prev => prev.map(item => {
        if (item.type !== 'post' || item.data.id !== postId) return item;

        const post = item.data;
        const feedData = post.feed_data || {};
        const likes = [...(feedData.likes || [])];
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

        return {
          ...item,
          data: { ...post, feed_data: { ...feedData, likes } },
        };
      }));
    }
  };

  const handleCreatePost = () => {
    playHapticFeedback('light', false);
    setShowCreatePost(true);
  };

  const handlePostCreated = () => {
    loadFeed(true);
  };

  const renderItem = ({ item }: { item: FeedItem }) => {
    const itemKey = `${item.type}-${item.data.id}`;
    const isVisible = visibleItems.has(itemKey);

    if (item.type === 'workout') {
      const workout = item.data;
      return (
        <FeedCard
          workout={workout}
          onPress={() => handleWorkoutPress(workout)}
          onUserPress={() => handleUserPress(workout.user_id, workout.username, workout.profile_picture_url)}
          onLike={() => handleWorkoutLike(workout.id)}
          onComment={() => handleWorkoutPress(workout)}
          currentUserId={currentUserId}
        />
      );
    } else {
      const post = item.data;
      return (
        <FeedPostCard
          post={post}
          onUserPress={() => handleUserPress(post.user_id, post.username, post.profile_picture_url)}
          onLike={() => handlePostLike(post.id)}
          onComment={() => handlePostPress(post)}
          currentUserId={currentUserId}
          isVisible={isVisible}
        />
      );
    }
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyFeed}>
      <Ionicons name="barbell-outline" size={48} color={currentTheme.colors.text + '30'} />
      <Text style={[styles.emptyFeedTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
        No posts yet
      </Text>
      <Text style={[styles.emptyFeedText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
        Be the first to share something!
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={{ paddingHorizontal: 20 }}>
        <SkeletonCard variant="feed" />
        <SkeletonCard variant="feed" />
        <SkeletonCard variant="feed" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={feedItems}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadFeed(true)}
            tintColor={currentTheme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Button */}
      <Animated.View style={[styles.fabContainer, fabAnimatedStyle]}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: currentTheme.colors.primary }]}
          onPress={handleCreatePost}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <WorkoutThreadModal
        visible={selectedWorkout !== null}
        onClose={() => setSelectedWorkout(null)}
        workout={selectedWorkout}
        currentUserId={currentUserId}
        onLike={() => selectedWorkout && handleWorkoutLike(selectedWorkout.id)}
        onWorkoutUpdated={updateWorkoutInFeed}
        onUserPress={handleUserPress}
      />

      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onPostCreated={handlePostCreated}
      />

      <CommentsModal
        visible={selectedPost !== null}
        onClose={() => setSelectedPost(null)}
        post={selectedPost}
        currentUserId={currentUserId}
        onPostUpdated={updatePostInFeed}
        onUserPress={handleUserPress}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyFeedTitle: {
    fontSize: 18,
    marginTop: 8,
  },
  emptyFeedText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 100,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
