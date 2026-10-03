import IconButton from '@/components/IconButton';
import { useLikePop } from '@/hooks/useLikePop';
import { Text, View } from '@/components/Themed';
import PplExercisesModal from '@/components/feed/workoutThread/PplExercisesModal';
import WorkoutCommentComposer from '@/components/feed/workoutThread/WorkoutCommentComposer';
import WorkoutCommentList from '@/components/feed/workoutThread/WorkoutCommentList';
import WorkoutExerciseList from '@/components/feed/workoutThread/WorkoutExerciseList';
import WorkoutThreadActions from '@/components/feed/workoutThread/WorkoutThreadActions';
import WorkoutThreadSummary from '@/components/feed/workoutThread/WorkoutThreadSummary';
import { useWorkoutThreadComments } from '@/components/feed/workoutThread/useWorkoutThreadComments';
import { useTheme } from '@/contexts/ThemeContext';
import { usePauseVideosWhileOpen } from '@/contexts/VideoPlayerContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { calculatePPLBreakdown, PPLCategory } from '@/lib/data/pplCategories';
import { groupExercisesByPPL, PPLExerciseEntry } from '@/lib/data/pplExerciseGroups';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { WeightUnit } from '@/types';
import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedWorkout } from './FeedCard';

interface WorkoutThreadModalProps {
  visible: boolean;
  onClose: () => void;
  workout: FeedWorkout | null;
  currentUserId: string | null;
  onLike?: () => void;
  onWorkoutUpdated?: (workout: FeedWorkout) => void;
  onUserPress?: (userId: string, username: string, profilePictureUrl?: string) => void;
  weightUnit?: WeightUnit;
}

export default function WorkoutThreadModal({
  visible,
  onClose,
  workout,
  currentUserId,
  onLike,
  onWorkoutUpdated,
  onUserPress,
  weightUnit = 'lbs',
}: WorkoutThreadModalProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  usePauseVideosWhileOpen(visible);
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    commentText,
    setCommentText,
    isSubmitting,
    comments,
    handleSubmitComment,
    handleDeleteComment,
    handleLikeComment,
  } = useWorkoutThreadComments({ workout, currentUserId, onWorkoutUpdated, scrollViewRef });
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(new Set());
  const [pplModalVisible, setPplModalVisible] = useState(false);
  const [selectedPplCategory, setSelectedPplCategory] = useState<PPLCategory | null>(null);

  const toggleExerciseExpanded = (index: number) => {
    playHapticFeedback('light', false);
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const { likeAnimatedStyle, pop } = useLikePop();

  // Must run before the early return below (Rules of Hooks).
  const pplBreakdown = useMemo(() => {
    if (!workout) return { counts: { push: 0, pull: 0, legs: 0 }, total: 0 };
    return calculatePPLBreakdown(workout.exercises);
  }, [workout]);

  const pplExercises = useMemo((): Record<PPLCategory, PPLExerciseEntry[]> => {
    if (!workout) return { push: [], pull: [], legs: [] };
    return groupExercisesByPPL(workout.exercises);
  }, [workout]);

  const handlePplChipPress = (category: PPLCategory) => {
    playHapticFeedback('light', false);
    setSelectedPplCategory(category);
    setPplModalVisible(true);
  };

  const handleClosePplModal = () => {
    setPplModalVisible(false);
    setSelectedPplCategory(null);
  };

  const handleLike = () => {
    playHapticFeedback('light', false);
    pop();
    onLike?.();
  };

  const handleUserTap = (userId: string, username: string, profilePictureUrl?: string) => {
    onClose();
    onUserPress?.(userId, username, profilePictureUrl);
  };

  if (!workout) return null;

  const feedData = workout.feed_data;
  const hasPRs = (feedData?.pr_count ?? 0) > 0;
  // Only show tier for workouts with tracked lifts (pr_count > 0).
  const strengthLevel = hasPRs ? (feedData?.strength_level as StrengthTier | undefined) : undefined;

  const likes = feedData?.likes || [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some(l => l.user_id === currentUserId) : false;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <RNView style={styles.headerSpacer} />
          <Text
            variant="emphasis"
            tone="primary"
            weight="semiBold"
            numberOfLines={1}
          >
            {workout.title}
          </Text>
          <IconButton icon="close" onPress={onClose} />
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
            <WorkoutThreadSummary
              workout={workout}
              weightUnit={weightUnit}
              hasPRs={hasPRs}
              strengthLevel={strengthLevel}
              pplBreakdown={pplBreakdown}
              onUserPress={handleUserTap}
              onPplChipPress={handlePplChipPress}
            />

            <WorkoutExerciseList
              exercises={workout.exercises}
              expandedExercises={expandedExercises}
              onToggleExercise={toggleExerciseExpanded}
            />

            <WorkoutThreadActions
              userHasLiked={userHasLiked}
              likeCount={likeCount}
              commentCount={comments.length}
              likeAnimatedStyle={likeAnimatedStyle}
              onLike={handleLike}
            />

            <WorkoutCommentList
              comments={comments}
              currentUserId={currentUserId}
              onDelete={handleDeleteComment}
              onLike={handleLikeComment}
              onUserPress={handleUserTap}
            />
          </ScrollView>

          <WorkoutCommentComposer
            commentText={commentText}
            onChangeText={setCommentText}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmitComment}
          />

        </KeyboardAvoidingView>
      </View>

      <PplExercisesModal
        visible={pplModalVisible}
        onClose={handleClosePplModal}
        selectedPplCategory={selectedPplCategory}
        pplExercises={pplExercises}
      />
    </Modal>
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
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 24,
    gap: 20,
  },
});
