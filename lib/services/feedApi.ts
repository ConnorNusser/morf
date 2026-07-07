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
  total_distance_meters?: number;
  total_cardio_seconds?: number;
  exercises: WorkoutExerciseSummary[];
  feed_data?: WorkoutFeedData;
  username: string;
  profile_picture_url?: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// API client for the self-hosted feed server.
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

  async getPosts(userId: string, limit: number = 20, offset: number = 0): Promise<FeedPost[]> {
    const { data, error } = await this.request<ApiPostItem[]>(
      'GET',
      `/api/posts?limit=${limit}&offset=${offset}`,
      userId
    );

    if (error || !data) return [];

    return data.map(p => {
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

        // React Native's FormData file shape.
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

  /** Returns { success, liked } where liked is true for a like, false for an unlike. */
  async togglePostLike(
    postId: string,
    userId: string,
    username: string,
    profilePictureUrl?: string
  ): Promise<{ success: boolean; liked: boolean }> {
    const { data, error } = await this.request<{ success: boolean; liked: boolean }>(
      'POST',
      `/api/posts/${postId}/like`,
      userId,
      { username, profile_picture_url: profilePictureUrl }
    );
    return { success: !error && !!data?.success, liked: !!data?.liked };
  }

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

  async deletePostComment(postId: string, commentId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.request<{ success: boolean }>(
      'DELETE',
      `/api/posts/${postId}/comment/${commentId}`,
      userId
    );
    return !error && !!data?.success;
  }

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
      total_distance_meters: w.total_distance_meters,
      total_cardio_seconds: w.total_cardio_seconds,
      exercises: w.exercises as WorkoutExerciseSummary[],
      feed_data: w.feed_data as WorkoutFeedData | undefined,
      username: w.username,
      profile_picture_url: w.profile_picture_url,
    }));
  }

  async saveWorkout(
    userId: string,
    workout: {
      title: string;
      duration_seconds: number;
      exercise_count: number;
      set_count: number;
      total_volume: number;
      total_distance_meters?: number;
      total_cardio_seconds?: number;
      exercises: WorkoutExerciseSummary[];
    },
    username: string,
    profilePictureUrl?: string,
    // Gamification snapshot (tier / PR count / earned achievement ids), merged
    // over the base likes/comments.
    feedData?: object
  ): Promise<boolean> {
    const { error } = await this.request<{ id: string }>('POST', '/api/workouts', userId, {
      ...workout,
      username,
      profile_picture_url: profilePictureUrl,
      feed_data: { likes: [], comments: [], ...(feedData ?? {}) },
    });
    return !error;
  }

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
