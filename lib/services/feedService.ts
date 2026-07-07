import { supabase } from './supabase';
import { analyticsService } from './analytics';
import { feedApi } from './feedApi';
import { containsProfanity } from '@/lib/utils/moderation';

export interface FeedLike {
  user_id: string;
  username: string;
  profile_picture_url?: string;
  created_at: string;
}

// Toggle the user's like in a new array; no-op add when userId is unset.
export function toggleLikeFor(likes: FeedLike[] | undefined, userId: string | null | undefined): FeedLike[] {
  const next = [...(likes || [])];
  const i = next.findIndex(l => l.user_id === userId);
  if (i >= 0) next.splice(i, 1);
  else if (userId) next.push({ user_id: userId, username: '', created_at: new Date().toISOString() });
  return next;
}

export interface FeedComment {
  id: string;
  user_id: string;
  username: string;
  profile_picture_url?: string;
  text: string;
  created_at: string;
  likes?: FeedLike[];
}

export interface WorkoutFeedData {
  strength_level?: string;
  pr_count?: number;
  /** Achievements this workout earned — ids only; art/copy are bundled. */
  achievement_ids?: string[];
  likes?: FeedLike[];
  comments?: FeedComment[];
}

export interface WorkoutSetData {
  setNumber: number;
  weight: number;
  reps: number;
  unit: 'lbs' | 'kg';
  isPersonalRecord?: boolean;
  duration?: number;  // seconds
  distance?: number;  // meters
}

export interface WorkoutExerciseSummary {
  name: string;
  sets: number;
  bestSet: string;
  isPR?: boolean;
  exerciseId?: string; // for tier lookup on feed display
  percentile?: number;
  allSets?: WorkoutSetData[];
  trackingType?: 'reps' | 'timed' | 'cardio';
}

export interface WorkoutSummary {
  id: string;
  title: string;
  created_at: Date;
  duration_seconds: number;
  exercise_count: number;
  set_count: number;
  total_volume: number;
  volume_unit?: 'lbs' | 'kg';
  exercises: WorkoutExerciseSummary[];
  feed_data?: WorkoutFeedData;
  total_distance_meters?: number;
  total_cardio_seconds?: number;
}

export interface PostFeedData {
  likes?: FeedLike[];
  comments?: FeedComment[];
}

export interface PostMedia {
  url: string;
  type: 'video' | 'image';
}

export interface FeedPost {
  id: string;
  user_id: string;
  text: string;
  media?: PostMedia[];
  created_at: Date;
  feed_data?: PostFeedData;
  username: string;
  profile_picture_url?: string;
}

export interface MediaInput {
  uri: string;
  type: 'video' | 'image';
}

export interface CreatePostInput {
  text: string;
  media?: MediaInput[];
}

export type FeedWorkout = WorkoutSummary & {
  username: string;
  profile_picture_url?: string;
  user_id: string;
};

class FeedService {
  private async getCurrentUser(): Promise<{ id: string; username: string; profile_picture_url?: string } | null> {
    if (!supabase) return null;

    try {
      const deviceId = await analyticsService.getDeviceId();
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, profile_picture_url')
        .eq('device_id', deviceId)
        .single();

      if (error) return null;
      return user;
    } catch {
      return null;
    }
  }

  async getGlobalWorkoutFeed(limit: number = 20, offset: number = 0): Promise<FeedWorkout[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      return await feedApi.getWorkouts(user.id, limit, offset);
    } catch (error) {
      console.error('Error fetching global workout feed:', error);
      throw error; // re-throw so the UI can surface the error
    }
  }

  async toggleLike(workoutId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      return await feedApi.toggleWorkoutLike(
        workoutId,
        user.id,
        user.username,
        user.profile_picture_url
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      return false;
    }
  }

  async addComment(workoutId: string, text: string): Promise<FeedComment | null> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      if (containsProfanity(text)) {
        console.warn('Comment contains profanity');
        return null;
      }

      return await feedApi.addWorkoutComment(
        workoutId,
        user.id,
        user.username,
        user.profile_picture_url,
        text.trim()
      );
    } catch (error) {
      console.error('Error adding comment:', error);
      return null;
    }
  }

  async deleteComment(workoutId: string, commentId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      return await feedApi.deleteWorkoutComment(workoutId, commentId, user.id);
    } catch (error) {
      console.error('Error deleting comment:', error);
      return false;
    }
  }

  async toggleWorkoutCommentLike(workoutId: string, commentId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      return await feedApi.toggleWorkoutCommentLike(
        workoutId,
        commentId,
        user.id,
        user.username,
        user.profile_picture_url
      );
    } catch (error) {
      console.error('Error toggling workout comment like:', error);
      return false;
    }
  }

  async saveWorkoutToFeed(workout: {
    title: string;
    duration_seconds: number;
    exercise_count: number;
    set_count: number;
    total_volume: number;
    total_distance_meters?: number;
    total_cardio_seconds?: number;
    exercises: WorkoutExerciseSummary[];
  }, feedData?: WorkoutFeedData): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      return await feedApi.saveWorkout(user.id, workout, user.username, user.profile_picture_url, feedData);
    } catch (error) {
      console.error('Error saving workout to feed:', error);
      return false;
    }
  }

  async createPost(input: CreatePostInput): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        console.error('createPost: No user found');
        return false;
      }

      if (containsProfanity(input.text)) {
        console.error('createPost: Post contains profanity');
        return false;
      }

      const result = await feedApi.createPost(
        user.id,
        user.username,
        input.text,
        input.media,
        user.profile_picture_url
      );

      return result;
    } catch (error) {
      console.error('Error creating post:', error);
      return false;
    }
  }

  async getPosts(limit: number = 20, offset: number = 0): Promise<FeedPost[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      return await feedApi.getPosts(user.id, limit, offset);
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error; // re-throw so the UI can surface the error
    }
  }

  /** Returns { success, liked } where liked is true for a like, false for an unlike. */
  async togglePostLike(postId: string): Promise<{ success: boolean; liked: boolean }> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return { success: false, liked: false };

      return await feedApi.togglePostLike(
        postId,
        user.id,
        user.username,
        user.profile_picture_url
      );
    } catch (error) {
      console.error('Error toggling post like:', error);
      return { success: false, liked: false };
    }
  }

  async addPostComment(postId: string, text: string): Promise<FeedComment | null> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      if (containsProfanity(text)) {
        console.warn('Comment contains profanity');
        return null;
      }

      return await feedApi.addPostComment(
        postId,
        user.id,
        user.username,
        user.profile_picture_url,
        text
      );
    } catch (error) {
      console.error('Error adding comment to post:', error);
      return null;
    }
  }

  async deletePostComment(postId: string, commentId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      return await feedApi.deletePostComment(postId, commentId, user.id);
    } catch (error) {
      console.error('Error deleting post comment:', error);
      return false;
    }
  }

  async togglePostCommentLike(postId: string, commentId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      return await feedApi.togglePostCommentLike(
        postId,
        commentId,
        user.id,
        user.username,
        user.profile_picture_url
      );
    } catch (error) {
      console.error('Error toggling post comment like:', error);
      return false;
    }
  }
}

export const feedService = new FeedService();
