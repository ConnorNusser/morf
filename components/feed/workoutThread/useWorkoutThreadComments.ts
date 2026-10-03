import { FeedWorkout } from '@/components/feed/FeedCard';
import { feedService, toggleLikeFor } from '@/lib/services/feedService';
import { RefObject, useState } from 'react';
import { Keyboard, ScrollView } from 'react-native';

interface UseWorkoutThreadCommentsParams {
  workout: FeedWorkout | null;
  currentUserId: string | null;
  onWorkoutUpdated?: (workout: FeedWorkout) => void;
  scrollViewRef: RefObject<ScrollView | null>;
}

// Composer state plus the add / delete / like comment handlers for a workout
// thread. Each handler waits for the server, then pushes the updated workout up.
export function useWorkoutThreadComments({
  workout,
  currentUserId,
  onWorkoutUpdated,
  scrollViewRef,
}: UseWorkoutThreadCommentsParams) {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feedData = workout?.feed_data;
  const comments = feedData?.comments || [];

  const handleSubmitComment = async () => {
    if (!workout) return;
    if (!commentText.trim() || isSubmitting) return;

    Keyboard.dismiss();
    setIsSubmitting(true);
    const newComment = await feedService.addComment(workout.id, commentText.trim());
    setIsSubmitting(false);

    if (newComment) {
      setCommentText('');
      const updatedComments = [...comments, newComment];
      const updatedWorkout: FeedWorkout = {
        ...workout,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onWorkoutUpdated?.(updatedWorkout);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!workout) return;
    const success = await feedService.deleteComment(workout.id, commentId);
    if (success) {
      const updatedComments = comments.filter(c => c.id !== commentId);
      const updatedWorkout: FeedWorkout = {
        ...workout,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onWorkoutUpdated?.(updatedWorkout);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!workout) return;
    const success = await feedService.toggleWorkoutCommentLike(workout.id, commentId);
    if (success) {
      const updatedComments = comments.map(c => {
        if (c.id !== commentId) return c;

        const commentLikes = toggleLikeFor(c.likes, currentUserId);
        return { ...c, likes: commentLikes };
      });

      const updatedWorkout: FeedWorkout = {
        ...workout,
        feed_data: { ...feedData, comments: updatedComments },
      };
      onWorkoutUpdated?.(updatedWorkout);
    }
  };

  return {
    commentText,
    setCommentText,
    isSubmitting,
    comments,
    handleSubmitComment,
    handleDeleteComment,
    handleLikeComment,
  };
}
