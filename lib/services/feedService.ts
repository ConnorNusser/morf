import { supabase } from './supabase';
import { analyticsService } from './analytics';
import { feedApi } from './feedApi';
import { containsProfanity } from '@/lib/utils/moderation';

// Feed types
export interface FeedLike {
  user_id: string;
  username: string;
  profile_picture_url?: string;
  created_at: string;
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
  likes?: FeedLike[];
  comments?: FeedComment[];
}

// Individual set data for detailed workout viewing
export interface WorkoutSetData {
  setNumber: number;
  weight: number;
  reps: number;
  unit: 'lbs' | 'kg';
  isPersonalRecord?: boolean;
}

export interface WorkoutExerciseSummary {
  name: string;
  sets: number;
  bestSet: string;
  isPR?: boolean;
  exerciseId?: string; // For tier lookup on feed display
  percentile?: number; // Calculated strength percentile for this exercise
  allSets?: WorkoutSetData[]; // Full set breakdown for detailed view
}

export interface WorkoutSummary {
  id: string;
  title: string;
  created_at: Date;
  duration_seconds: number;
  exercise_count: number;
  set_count: number;
  total_volume: number;
  volume_unit?: 'lbs' | 'kg'; // User's preferred unit for display
  exercises: WorkoutExerciseSummary[];
  feed_data?: WorkoutFeedData;
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
  media?: PostMedia[];  // Array of media items
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
  media?: MediaInput[];  // Array of media to upload
}

export type FeedWorkout = WorkoutSummary & {
  username: string;
  profile_picture_url?: string;
  user_id: string;
};

class FeedService {
  /**
   * Get current user from Supabase (user data stays on Supabase)
   */
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

  /**
   * Get friends' recent workouts for feed (friendships stay on Supabase)
   */
  async getFriendsWorkoutFeed(limit: number = 20): Promise<FeedWorkout[]> {
    if (!supabase) return [];

    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      // Get friend IDs from Supabase
      const { data: friends } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', user.id);

      if (!friends || friends.length === 0) return [];

      const friendIds = friends.map(f => f.friend_id);

      // Get workouts from self-hosted API and filter by friends
      const allWorkouts = await feedApi.getWorkouts(user.id, 100, 0);
      return allWorkouts
        .filter(w => friendIds.includes(w.user_id))
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching friends workout feed:', error);
      return [];
    }
  }

  /**
   * Get global workout feed (all users) with pagination
   */
  async getGlobalWorkoutFeed(limit: number = 20, offset: number = 0): Promise<FeedWorkout[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      return await feedApi.getWorkouts(user.id, limit, offset);
    } catch (error) {
      console.error('Error fetching global workout feed:', error);
      // Re-throw to allow UI to display the error
      throw error;
    }
  }

  /**
   * Toggle like on a workout
   */
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

  /**
   * Add a comment to a workout
   */
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

  /**
   * Delete a comment from a workout
   */
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

  /**
   * Toggle like on a workout comment
   */
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

  /**
   * Save a workout to the feed
   */
  async saveWorkoutToFeed(workout: {
    title: string;
    duration_seconds: number;
    exercise_count: number;
    set_count: number;
    total_volume: number;
    exercises: WorkoutExerciseSummary[];
  }): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      return await feedApi.saveWorkout(user.id, workout, user.username, user.profile_picture_url);
    } catch (error) {
      console.error('Error saving workout to feed:', error);
      return false;
    }
  }

  /**
   * Create a new post with optional media
   */
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

  /**
   * Get posts for the feed
   */
  async getPosts(limit: number = 20, offset: number = 0): Promise<FeedPost[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      return await feedApi.getPosts(user.id, limit, offset);
    } catch (error) {
      console.error('Error fetching posts:', error);
      // Re-throw to allow UI to display the error
      throw error;
    }
  }

  /**
   * Toggle like on a post
   */
  async togglePostLike(postId: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      return await feedApi.togglePostLike(
        postId,
        user.id,
        user.username,
        user.profile_picture_url
      );
    } catch (error) {
      console.error('Error toggling post like:', error);
      return false;
    }
  }

  /**
   * Add comment to a post
   */
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

  /**
   * Delete comment from a post
   */
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

  /**
   * Toggle like on a post comment
   */
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

  /**
   * Get combined feed (workouts + posts)
   */
  async getCombinedFeed(limit: number = 20, offset: number = 0): Promise<(FeedWorkout | FeedPost)[]> {
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      return await feedApi.getFeed(user.id, limit, offset);
    } catch (error) {
      console.error('Error fetching combined feed:', error);
      return [];
    }
  }
}

export const feedService = new FeedService();
