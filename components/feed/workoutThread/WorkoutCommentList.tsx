import WorkoutCommentItem from '@/components/feed/workoutThread/WorkoutCommentItem';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { FeedComment } from '@/lib/services/feedService';
import React from 'react';
import { StyleSheet } from 'react-native';

interface WorkoutCommentListProps {
  comments: FeedComment[];
  currentUserId: string | null;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  onUserPress: (userId: string, username: string, profilePictureUrl?: string) => void;
}

export default function WorkoutCommentList({
  comments,
  currentUserId,
  onDelete,
  onLike,
  onUserPress,
}: WorkoutCommentListProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={styles.commentsSection}>
      <Text style={[styles.commentsTitle, { color: currentTheme.colors.text, fontWeight: '600' }]}>
        Comments {comments.length > 0 && `(${comments.length})`}
      </Text>

      {comments.length === 0 ? (
        <Text style={[styles.noComments, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}>
          No comments yet. Be the first!
        </Text>
      ) : (
        <View style={styles.commentsList}>
          {comments.map(comment => (
            <WorkoutCommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isAuthor={comment.user_id === currentUserId}
              onDelete={onDelete}
              onLike={onLike}
              onUserPress={onUserPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  commentsSection: {
    gap: 12,
  },
  commentsTitle: {
    fontSize: 16,
  },
  noComments: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentsList: {
    gap: 16,
  },
});
