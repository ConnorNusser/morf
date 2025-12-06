import SkeletonCard from '@/components/SkeletonCard';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ReactionType, userSyncService } from '@/lib/userSyncService';
import { RemoteUser } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';
import FeedCard, { FeedWorkout } from './FeedCard';
import WorkoutThreadModal from './WorkoutThreadModal';

const PAGE_SIZE = 15;

interface FeedViewProps {
  onUserPress: (user: RemoteUser) => void;
  refreshTrigger?: number;
}

export default function FeedView({ onUserPress, refreshTrigger }: FeedViewProps) {
  const { currentTheme } = useTheme();
  const [feedWorkouts, setFeedWorkouts] = useState<FeedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<FeedWorkout | null>(null);

  const loadFeed = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [feed, user] = await Promise.all([
        userSyncService.getGlobalWorkoutFeed(PAGE_SIZE, 0),
        userSyncService.getCurrentUser(),
      ]);
      setFeedWorkouts(feed);
      setCurrentUserId(user?.id || null);
      setHasMore(feed.length >= PAGE_SIZE);
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
      const offset = feedWorkouts.length;
      const moreFeed = await userSyncService.getGlobalWorkoutFeed(PAGE_SIZE, offset);

      if (moreFeed.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (moreFeed.length > 0) {
        setFeedWorkouts(prev => [...prev, ...moreFeed]);
      }
    } catch (error) {
      console.error('Error loading more feed:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [feedWorkouts.length, hasMore, isLoadingMore]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed, refreshTrigger]);

  const handleUserPress = (workout: FeedWorkout) => {
    onUserPress({
      id: workout.user_id,
      device_id: '',
      username: workout.username,
      profile_picture_url: workout.profile_picture_url,
    });
  };

  const handleCardPress = (workout: FeedWorkout) => {
    setSelectedWorkout(workout);
  };

  const updateWorkoutInFeed = (updatedWorkout: FeedWorkout) => {
    setFeedWorkouts(prev => prev.map(w =>
      w.id === updatedWorkout.id ? updatedWorkout : w
    ));
    setSelectedWorkout(updatedWorkout);
  };

  const handleReaction = async (workoutId: string, reactionType: ReactionType) => {
    const success = await userSyncService.toggleReaction(workoutId, reactionType);
    if (success) {
      // Optimistically update the local state
      setFeedWorkouts(prev => prev.map(workout => {
        if (workout.id !== workoutId) return workout;

        const feedData = workout.feed_data || {};
        const reactions = [...(feedData.reactions || [])];
        const existingIndex = reactions.findIndex(r => r.user_id === currentUserId);

        if (existingIndex >= 0) {
          if (reactions[existingIndex].reaction_type === reactionType) {
            reactions.splice(existingIndex, 1);
          } else {
            reactions[existingIndex] = {
              ...reactions[existingIndex],
              reaction_type: reactionType,
            };
          }
        } else if (currentUserId) {
          reactions.push({
            user_id: currentUserId,
            username: '',
            reaction_type: reactionType,
            created_at: new Date().toISOString(),
          });
        }

        const updated = {
          ...workout,
          feed_data: { ...feedData, reactions },
        };

        // Also update selected workout if it's the same one
        if (selectedWorkout?.id === workoutId) {
          setSelectedWorkout(updated);
        }

        return updated;
      }));
    }
  };

  const renderItem = ({ item }: { item: FeedWorkout }) => (
    <FeedCard
      workout={item}
      onPress={() => handleCardPress(item)}
      onUserPress={() => handleUserPress(item)}
      onReaction={(type) => handleReaction(item.id, type)}
      onComment={() => handleCardPress(item)}
      currentUserId={currentUserId}
    />
  );

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
        No workouts yet
      </Text>
      <Text style={[styles.emptyFeedText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
        Workouts from the community will appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={{ gap: 16 }}>
        <SkeletonCard variant="stats" />
        <SkeletonCard variant="stats" />
        <SkeletonCard variant="stats" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={feedWorkouts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadFeed(true)}
            tintColor={currentTheme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <WorkoutThreadModal
        visible={selectedWorkout !== null}
        onClose={() => setSelectedWorkout(null)}
        workout={selectedWorkout}
        currentUserId={currentUserId}
        onReaction={(type) => selectedWorkout && handleReaction(selectedWorkout.id, type)}
        onWorkoutUpdated={updateWorkoutInFeed}
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
});
