import { useAlert } from '@/components/CustomAlert';
import { FeedWorkout } from '@/components/feed/FeedCard';
import { FeedComment, feedService, toggleLikeFor } from '@/lib/services/feedService';
import { containsProfanity } from '@/lib/utils/moderation';
import { RefObject, useRef, useState } from 'react';
import { Keyboard, ScrollView } from 'react-native';

interface UseWorkoutThreadCommentsParams {
  workout: FeedWorkout | null;
  currentUserId: string | null;
  onWorkoutUpdated?: (workout: FeedWorkout) => void;
  scrollViewRef: RefObject<ScrollView | null>;
}

// Composer state plus the add / delete / like comment handlers for a workout
// thread. Each handler waits for the server, then pushes the updated workout up,
// or tells the user when the action did not go through.
export function useWorkoutThreadComments({
  workout,
  currentUserId,
  onWorkoutUpdated,
  scrollViewRef,
}: UseWorkoutThreadCommentsParams) {
  const { showAlert } = useAlert();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Always the newest workout, so a handler that resolves late builds on what
  // other actions have already applied instead of the list it saw at tap time.
  const latestWorkoutRef = useRef(workout);
  latestWorkoutRef.current = workout;

  const feedData = workout?.feed_data;
  const comments = feedData?.comments || [];

  const applyCommentUpdate = (
    target: FeedWorkout,
    update: (current: FeedComment[]) => FeedComment[],
  ) => {
    // If the thread moved to another workout meanwhile, fall back to the one acted on.
    const isCurrent = latestWorkoutRef.current?.id === target.id;
    const base = isCurrent ? latestWorkoutRef.current! : target;
    const updatedWorkout: FeedWorkout = {
      ...base,
      feed_data: { ...base.feed_data, comments: update(base.feed_data?.comments || []) },
    };
    // Keep the ref ahead of the parent re-render for back-to-back completions.
    if (isCurrent) latestWorkoutRef.current = updatedWorkout;
    onWorkoutUpdated?.(updatedWorkout);
  };

  const handleSubmitComment = async () => {
    if (!workout) return;
    if (!commentText.trim() || isSubmitting) return;

    Keyboard.dismiss();
    setIsSubmitting(true);
    const trimmedComment = commentText.trim();
    const newComment = await feedService.addComment(workout.id, trimmedComment);
    setIsSubmitting(false);

    if (newComment) {
      setCommentText('');
      applyCommentUpdate(workout, current => [...current, newComment]);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } else {
      // The service rejects profanity with the same null as a network failure.
      showAlert({
        title: 'Comment Not Posted',
        message: containsProfanity(trimmedComment)
          ? 'Your comment contains language that is not allowed. Please edit it and try again.'
          : 'Could not post your comment. Please try again.',
        type: 'error',
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!workout) return;
    const success = await feedService.deleteComment(workout.id, commentId);
    if (success) {
      applyCommentUpdate(workout, current => current.filter(c => c.id !== commentId));
    } else {
      showAlert({ title: 'Error', message: 'Could not delete the comment. Please try again.', type: 'error' });
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!workout) return;
    const success = await feedService.toggleWorkoutCommentLike(workout.id, commentId);
    if (success) {
      applyCommentUpdate(workout, current => current.map(c => {
        if (c.id !== commentId) return c;

        const commentLikes = toggleLikeFor(c.likes, currentUserId);
        return { ...c, likes: commentLikes };
      }));
    } else {
      showAlert({ title: 'Error', message: 'Could not update your like. Please try again.', type: 'error' });
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
