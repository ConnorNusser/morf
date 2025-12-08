import {
  FeedComment,
  FeedPost,
  FeedWorkout,
  MediaInput,
  PostFeedData,
  PostMedia,
  WorkoutExerciseSummary,
  WorkoutFeedData,
} from './feedService';

const FEED_API_URL = 'https://feed.morf.fyi';

// API response types
interface ApiFeedItem {
  id: string;
  type: 'workout' | 'post';
  user_id: string;
  title?: string;
  text?: string;
  created_at: string;
  duration_seconds?: number;
  exercise_count?: number;
  set_count?: number;
  total_volume?: number;
  exercises?: WorkoutExerciseSummary[];
  media?: { url: string; type: 'video' | 'image' }[];
  feed_data?: WorkoutFeedData | PostFeedData;
  username: string;
  profile_picture_url?: string;
}

interface ApiPostItem {
  id: string;
  user_id: string;
  text: string;
  media?: { url: string; type: 'video' | 'image' }[];
  created_at: string;
  feed_data?: PostFeedData;
  username: string;
  profile_picture_url?: string;
}

interface ApiWorkoutItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  duration_seconds: number;
  exercise_count: number;
  set_count: number;
  total_volume: number;
  exercises: WorkoutExerciseSummary[];
  feed_data?: WorkoutFeedData;
  username: string;
  profile_picture_url?: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * API client for the self-hosted feed server
 */
class FeedApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = FEED_API_URL;
  }

  private async request<T>(
    method: string,
    path: string,
    userId: string,
    body?: Record<string, unknown> | FormData
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    try {
      const headers: Record<string, string> = {
        'x-user-id': userId,
      };

      const isFormData = body instanceof FormData;
      if (!isFormData && body) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        method,
        headers,
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`Feed API error: ${method} ${path} - Status ${response.status}: ${errorText}`);
        try {
          const errorJson = JSON.parse(errorText);
          return { error: errorJson.error || 'Request failed' };
        } catch {
          return { error: `Request failed: ${response.status}` };
        }
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Feed API error: ${method} ${path}:`, errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Get combined feed (workouts + posts)
   */
  async getFeed(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<(FeedWorkout | FeedPost)[]> {
    const { data, error } = await this.request<ApiFeedItem[]>(
      'GET',
      `/api/feed?limit=${limit}&offset=${offset}`,
      userId
    );

    if (error || !data) return [];

    return data.map(item => {
      if (item.type === 'workout') {
        return {
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          created_at: new Date(item.created_at),
          duration_seconds: item.duration_seconds,
          exercise_count: item.exercise_count,
          set_count: item.set_count,
          total_volume: item.total_volume,
          exercises: item.exercises as WorkoutExerciseSummary[],
          feed_data: item.feed_data as WorkoutFeedData | undefined,
          username: item.username,
          profile_picture_url: item.profile_picture_url,
        } as FeedWorkout;
      } else {
        // Map media array with full URLs
        const media: PostMedia[] = (item.media || []).map((m: { url: string; type: 'video' | 'image' }) => ({
          url: `${this.baseUrl}${m.url}`,
          type: m.type,
        }));

        return {
          id: item.id,
          user_id: item.user_id,
          text: item.text,
          media: media.length > 0 ? media : undefined,
          created_at: new Date(item.created_at),
          feed_data: item.feed_data as PostFeedData | undefined,
          username: item.username,
          profile_picture_url: item.profile_picture_url,
        } as FeedPost;
      }
    });
  }

  /**
   * Get posts only
   */
  async getPosts(userId: string, limit: number = 20, offset: number = 0): Promise<FeedPost[]> {
    const { data, error } = await this.request<ApiPostItem[]>(
      'GET',
      `/api/posts?limit=${limit}&offset=${offset}`,
      userId
    );

    if (error || !data) return [];

    return data.map(p => {
      // Map media array with full URLs
      const media: PostMedia[] = (p.media || []).map((m: { url: string; type: 'video' | 'image' }) => ({
        url: `${this.baseUrl}${m.url}`,
        type: m.type,
      }));

      return {
        id: p.id,
        user_id: p.user_id,
        text: p.text,
        media: media.length > 0 ? media : undefined,
        created_at: new Date(p.created_at),
        feed_data: p.feed_data as PostFeedData | undefined,
        username: p.username,
        profile_picture_url: p.profile_picture_url,
      };
    });
  }

  /**
   * Create a new post with optional multiple media files
   */
  async createPost(
    userId: string,
    username: string,
    text: string,
    mediaItems?: MediaInput[],
    profilePictureUrl?: string
  ): Promise<boolean> {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('username', username);
    if (profilePictureUrl) {
      formData.append('profile_picture_url', profilePictureUrl);
    }

    if (mediaItems && mediaItems.length > 0) {
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const ext = item.type === 'video' ? 'mp4' : 'jpg';
        const mimeType = item.type === 'video' ? 'video/mp4' : 'image/jpeg';

        // React Native FormData file format
        formData.append('media', {
          uri: item.uri,
          type: mimeType,
          name: `upload_${i}.${ext}`,
        } as unknown as Blob);
      }
    }

    const { error } = await this.request<{ id: string }>('POST', '/api/posts', userId, formData);
    if (error) {
      console.error('createPost failed:', error);
    }
    return !error;
  }

  /**
   * Toggle like on a post
   */
  async togglePostLike(
    postId: string,
    userId: string,
    username: string,
    profilePictureUrl?: string
  ): Promise<boolean> {
    const { data, error } = await this.request<{ success: boolean; liked: boolean }>(
      'POST',
      `/api/posts/${postId}/like`,
      userId,
      { username, profile_picture_url: profilePictureUrl }
    );
    return !error && !!data?.success;
  }

  /**
   * Add comment to a post
   */
  async addPostComment(
    postId: string,
    userId: string,
    username: string,
    profilePictureUrl: string | undefined,
    text: string
  ): Promise<FeedComment | null> {
    const { data, error } = await this.request<FeedComment>(
      'POST',
      `/api/posts/${postId}/comment`,
      userId,
      { text, username, profile_picture_url: profilePictureUrl }
    );
    return error ? null : data || null;
  }

  /**
   * Delete comment from a post
   */
  async deletePostComment(postId: string, commentId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.request<{ success: boolean }>(
      'DELETE',
      `/api/posts/${postId}/comment/${commentId}`,
      userId
    );
    return !error && !!data?.success;
  }

  /**
   * Toggle like on a post comment
   */
  async togglePostCommentLike(
    postId: string,
    commentId: string,
    userId: string,
    username: string,
    profilePictureUrl?: string
  ): Promise<boolean> {
    const { data, error } = await this.request<{ success: boolean; liked: boolean }>(
      'POST',
      `/api/posts/${postId}/comment/${commentId}/like`,
      userId,
      { username, profile_picture_url: profilePictureUrl }
    );
    return !error && !!data?.success;
  }

  /**
   * Get workouts only
   */
  async getWorkouts(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<FeedWorkout[]> {
    const { data, error } = await this.request<ApiWorkoutItem[]>(
      'GET',
      `/api/workouts?limit=${limit}&offset=${offset}`,
      userId
    );

    if (error || !data) return [];

    return data.map(w => ({
      id: w.id,
      user_id: w.user_id,
      title: w.title,
      created_at: new Date(w.created_at),
      duration_seconds: w.duration_seconds,
      exercise_count: w.exercise_count,
      set_count: w.set_count,
      total_volume: w.total_volume,
      exercises: w.exercises as WorkoutExerciseSummary[],
      feed_data: w.feed_data as WorkoutFeedData | undefined,
      username: w.username,
      profile_picture_url: w.profile_picture_url,
    }));
  }

  /**
   * Save a workout to the feed
   */
  async saveWorkout(
    userId: string,
    workout: {
      title: string;
      duration_seconds: number;
      exercise_count: number;
      set_count: number;
      total_volume: number;
      exercises: WorkoutExerciseSummary[];
    },
    username: string,
    profilePictureUrl?: string
  ): Promise<boolean> {
    const { error } = await this.request<{ id: string }>('POST', '/api/workouts', userId, {
      ...workout,
      username,
      profile_picture_url: profilePictureUrl,
      feed_data: { likes: [], comments: [] },
    });
    return !error;
  }

  /**
   * Toggle like on a workout
   */
  async toggleWorkoutLike(
    workoutId: string,
    userId: string,
    username: string,
    profilePictureUrl?: string
  ): Promise<boolean> {
    const { data, error } = await this.request<{ success: boolean; liked: boolean }>(
      'POST',
      `/api/workouts/${workoutId}/like`,
      userId,
      { username, profile_picture_url: profilePictureUrl }
    );
    return !error && !!data?.success;
  }

  /**
   * Add comment to a workout
   */
  async addWorkoutComment(
    workoutId: string,
    userId: string,
    username: string,
    profilePictureUrl: string | undefined,
    text: string
  ): Promise<FeedComment | null> {
    const { data, error } = await this.request<FeedComment>(
      'POST',
      `/api/workouts/${workoutId}/comment`,
      userId,
      { text, username, profile_picture_url: profilePictureUrl }
    );
    return error ? null : data || null;
  }

  /**
   * Delete comment from a workout
   */
  async deleteWorkoutComment(
    workoutId: string,
    commentId: string,
    userId: string
  ): Promise<boolean> {
    const { data, error } = await this.request<{ success: boolean }>(
      'DELETE',
      `/api/workouts/${workoutId}/comment/${commentId}`,
      userId
    );
    return !error && !!data?.success;
  }

  /**
   * Toggle like on a workout comment
   */
  async toggleWorkoutCommentLike(
    workoutId: string,
    commentId: string,
    userId: string,
    username: string,
    profilePictureUrl?: string
  ): Promise<boolean> {
    const { data, error } = await this.request<{ success: boolean; liked: boolean }>(
      'POST',
      `/api/workouts/${workoutId}/comment/${commentId}/like`,
      userId,
      { username, profile_picture_url: profilePictureUrl }
    );
    return !error && !!data?.success;
  }
}

export const feedApi = new FeedApi();
