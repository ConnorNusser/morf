import { supabase } from './supabase';
import { analyticsService } from './analytics';
import { geoService } from './geoService';
import { GeneratedWorkout, RemoteUser, RemoteUserData, Friend, LeaderboardEntry, UserLift, MuscleGroupPercentiles, TopContribution, OverallLeaderboardEntry, UserPercentileData } from '@/types';
import { getStrengthLevelName, OneRMCalculator } from './strengthStandards';
import { calculateOverallPercentile, convertWeightToLbs } from './utils';
import { userService } from './userService';
import { getWorkoutById, ALL_WORKOUTS } from './workouts';

// Workout summary for social viewing
export interface WorkoutExerciseSummary {
  name: string;
  sets: number;
  bestSet: string;  // e.g., "185x8"
  isPR?: boolean;
}

export type ReactionType = 'kudos' | 'fire' | 'strong' | 'celebrate';

export interface FeedReaction {
  user_id: string;
  username: string;
  profile_picture_url?: string;
  reaction_type: ReactionType;
  created_at: string; // ISO string for jsonb storage
}

export interface FeedComment {
  id: string; // UUID for deletion
  user_id: string;
  username: string;
  profile_picture_url?: string;
  text: string;
  created_at: string; // ISO string for jsonb storage
}

export interface WorkoutFeedData {
  strength_level?: string;  // e.g., "B+", "A-"
  pr_count?: number;        // Number of PRs in this workout
  reactions?: FeedReaction[];
  comments?: FeedComment[];
}

export interface WorkoutSummary {
  id: string;
  title: string;
  created_at: Date;
  duration_seconds: number;
  exercise_count: number;
  set_count: number;
  total_volume: number;
  exercises: WorkoutExerciseSummary[];
  feed_data?: WorkoutFeedData;
}

// Profanity filter - common offensive words (lowercase)
const BLOCKED_WORDS = [
  // Slurs and hate speech
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'chink', 'spic', 'kike', 'wetback', 'beaner', 'gook', 'tranny', 'coon',
  // Profanity
  'fuck', 'shit', 'ass', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'bastard', 'damn', 'piss',
  // Sexual
  'penis', 'vagina', 'boob', 'tits', 'anal', 'porn', 'xxx', 'sex', 'nude', 'naked',
  // Violence
  'kill', 'murder', 'rape', 'terrorist', 'nazi', 'hitler',
  // Other offensive
  'pedo', 'molest', 'incest',
];

// Check if username contains profanity
function containsProfanity(username: string): boolean {
  const lower = username.toLowerCase();
  // Check for exact matches and substrings
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return true;
    }
  }
  // Check for leet speak variations (basic)
  const leetMap: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
  };
  let normalized = lower;
  for (const [leet, char] of Object.entries(leetMap)) {
    normalized = normalized.split(leet).join(char);
  }
  for (const word of BLOCKED_WORDS) {
    if (normalized.includes(word)) {
      return true;
    }
  }
  return false;
}

class UserSyncService {
  private currentUserId: string | null = null;

  /**
   * Create or update a user in Supabase
   */
  async syncUser(username: string): Promise<RemoteUser | null> {
    if (!supabase) return null;

    try {
      const deviceId = await analyticsService.getDeviceId();

      // Check if user already exists by device_id
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('device_id', deviceId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine
        console.error('Error fetching user:', fetchError);
        analyticsService.logErr('sync', 'user_fetch_failed', fetchError.message, { code: fetchError.code });
        return null;
      }

      if (existingUser) {
        // Update username if changed
        if (existingUser.username !== username) {
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ username, updated_at: new Date().toISOString() })
            .eq('id', existingUser.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating user:', updateError);
            analyticsService.logErr('sync', 'user_update_failed', updateError.message, { code: updateError.code });
            return null;
          }

          this.currentUserId = updatedUser.id;
          analyticsService.logInfo('sync', 'user_updated', 'Username updated', { oldUsername: existingUser.username, newUsername: username });
          return updatedUser as RemoteUser;
        }

        this.currentUserId = existingUser.id;
        return existingUser as RemoteUser;
      }

      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({ device_id: deviceId, username })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        analyticsService.logErr('sync', 'user_create_failed', insertError.message, { code: insertError.code });
        return null;
      }

      this.currentUserId = newUser.id;
      analyticsService.logInfo('sync', 'user_created', 'New user created', { username });
      return newUser as RemoteUser;
    } catch (error) {
      console.error('Error syncing user:', error);
      analyticsService.logErr('sync', 'user_sync_error', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Get the current user from Supabase by device ID
   */
  async getCurrentUser(): Promise<RemoteUser | null> {
    if (!supabase) return null;

    try {
      const deviceId = await analyticsService.getDeviceId();

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('device_id', deviceId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Error getting current user:', error);
        }
        return null;
      }

      this.currentUserId = user.id;
      return user as RemoteUser;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Sync user profile data (height, weight, gender) to Supabase
   */
  async syncProfileData(profileData: RemoteUserData): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) {
        // Auto-create user if they don't exist
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        const newUser = await this.syncUser(username);
        if (!newUser) return false;
      }

      const { error } = await supabase
        .from('users')
        .update({
          user_data: profileData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.currentUserId);

      if (error) {
        console.error('Error syncing profile data:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error syncing profile data:', error);
      return false;
    }
  }

  /**
   * Validate username and return detailed error message
   * Returns null if valid, or error message string if invalid
   */
  async validateUsername(username: string): Promise<string | null> {
    // Check length
    if (username.length < 1) {
      return 'Username cannot be empty';
    }
    if (username.length > 20) {
      return 'Username must be 20 characters or less';
    }

    // Check format (alphanumeric, underscores, hyphens only)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }

    // Check for profanity
    if (containsProfanity(username)) {
      return 'Username contains inappropriate content';
    }

    // Check uniqueness in database
    if (!supabase) return null;

    try {
      const deviceId = await analyticsService.getDeviceId();

      const { data, error } = await supabase
        .from('users')
        .select('id, device_id')
        .eq('username', username)
        .single();

      if (error) {
        // PGRST116 means no user found, so username is available
        if (error.code === 'PGRST116') return null;
        console.error('Error checking username:', error);
        return 'Error checking username availability';
      }

      // Username is available if it belongs to the current device
      if (data.device_id === deviceId) {
        return null;
      }

      return 'Username is already taken';
    } catch (error) {
      console.error('Error checking username:', error);
      return 'Error checking username availability';
    }
  }

  /**
   * Check if a username is available (returns boolean)
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const error = await this.validateUsername(username);
    return error === null;
  }

  /**
   * Search users by username (partial match)
   */
  async searchUsers(query: string): Promise<RemoteUser[]> {
    if (!supabase || !query.trim()) return [];

    try {
      const deviceId = await analyticsService.getDeviceId();

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', `%${query}%`)
        .neq('device_id', deviceId) // Exclude current user
        .limit(20);

      if (error) {
        console.error('Error searching users:', error);
        return [];
      }

      return (data || []) as RemoteUser[];
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  /**
   * Add a friend by their user ID
   */
  async addFriend(friendId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      // Add bidirectional friendship (both directions)
      const { error } = await supabase.from('friends').insert([
        { user_id: user.id, friend_id: friendId },
        { user_id: friendId, friend_id: user.id },
      ]);

      if (error) {
        // Ignore duplicate key errors (already friends)
        if (error.code === '23505') return true;
        console.error('Error adding friend:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding friend:', error);
      return false;
    }
  }

  /**
   * Remove a friend
   */
  async removeFriend(friendId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      // Remove both directions of friendship
      const { error } = await supabase
        .from('friends')
        .delete()
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

      if (error) {
        console.error('Error removing friend:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      return false;
    }
  }

  /**
   * Get the current user's friends list
   */
  async getFriends(): Promise<Friend[]> {
    if (!supabase) return [];

    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          created_at,
          friend:friend_id (
            id,
            device_id,
            username,
            profile_picture_url,
            country_code,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error getting friends:', error);
        return [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((row: any) => ({
        id: row.id,
        user: row.friend as RemoteUser,
        created_at: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Error getting friends:', error);
      return [];
    }
  }

  /**
   * Check if a user is already a friend
   */
  async isFriend(friendId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', friendId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return false;
        console.error('Error checking friend status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking friend status:', error);
      return false;
    }
  }

  /**
   * Sync user's country code to Supabase
   */
  async syncCountryCode(countryCode: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) {
        // Auto-create user if they don't exist
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        const newUser = await this.syncUser(username);
        if (!newUser) return false;
      }

      const { error } = await supabase
        .from('users')
        .update({
          country_code: countryCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.currentUserId);

      if (error) {
        console.error('Error syncing country code:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error syncing country code:', error);
      return false;
    }
  }

  /**
   * Get and sync user's country from geo-location
   */
  async syncUserCountry(): Promise<string | null> {
    try {
      const countryCode = await geoService.requestAndGetCountry();
      if (countryCode) {
        await this.syncCountryCode(countryCode);
      }
      return countryCode;
    } catch (error) {
      console.error('Error syncing user country:', error);
      return null;
    }
  }

  /**
   * Get list of unique countries from users who have lift data
   */
  async getAvailableCountries(): Promise<string[]> {
    if (!supabase) return [];

    try {
      // Query from the leaderboard view to only get countries with lift data
      const { data, error } = await supabase
        .from('exercise_leaderboard')
        .select('country_code')
        .not('country_code', 'is', null);

      if (error) {
        console.error('Error getting countries:', error);
        return [];
      }

      // Get unique country codes
      const countries = [...new Set(
        (data || [])
          .map(row => row.country_code as string)
          .filter(Boolean)
      )].sort();

      return countries;
    } catch (error) {
      console.error('Error getting countries:', error);
      return [];
    }
  }

  /**
   * Sync local lifts to Supabase for leaderboard
   */
  async syncLifts(lifts: UserLift[]): Promise<void> {
    if (!supabase || lifts.length === 0) return;

    try {
      // Get or create user
      let user = await this.getCurrentUser();
      if (!user) {
        // Auto-create user with default username if they don't exist
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        user = await this.syncUser(username);
        if (!user) {
          console.error('Failed to create user for lift sync');
          analyticsService.logErr('sync', 'lifts_sync_no_user', 'Failed to create user for lift sync');
          return;
        }
      }

      // Convert lifts to the format Supabase expects
      const liftRecords = lifts.map((lift) => ({
        user_id: user.id,
        exercise_id: lift.id,
        weight: convertWeightToLbs(lift.weight, lift.unit),
        reps: lift.reps,
        estimated_1rm: OneRMCalculator.estimate(
          convertWeightToLbs(lift.weight, lift.unit),
          lift.reps
        ),
        recorded_at: lift.dateRecorded,
      }));

      // Upsert lifts (insert or update if already exists)
      const { error } = await supabase.from('user_lifts').insert(liftRecords);

      if (error) {
        console.error('Error syncing lifts:', error);
        analyticsService.logErr('sync', 'lifts_sync_failed', error.message, {
          code: error.code,
          liftCount: lifts.length
        });
      } else {
        analyticsService.logInfo('sync', 'lifts_synced', `Synced ${lifts.length} lifts`, {
          liftCount: lifts.length,
          exerciseIds: lifts.map(l => l.id)
        });
      }
    } catch (error) {
      console.error('Error syncing lifts:', error);
      analyticsService.logErr('sync', 'lifts_sync_error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get leaderboard data for specified exercises
   */
  async getLeaderboard(exerciseIds: string[]): Promise<LeaderboardEntry[]> {
    if (!supabase || exerciseIds.length === 0) return [];

    try {
      let user = await this.getCurrentUser();
      if (!user) {
        // Auto-create user if they don't exist
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        user = await this.syncUser(username);
        if (!user) return [];
      }

      // Use the database function to get friend leaderboard
      const { data, error } = await supabase.rpc('get_friend_leaderboard', {
        p_user_id: user.id,
        p_exercise_ids: exerciseIds,
      });

      if (error) {
        console.error('Error getting leaderboard:', error);
        return [];
      }

      // Map the data to LeaderboardEntry format
      return (data || []).map((row: {
        user_id: string;
        username: string;
        profile_picture_url?: string;
        exercise_id: string;
        estimated_1rm: number;
        recorded_at: string;
        rank: number;
      }) => ({
        user: {
          id: row.user_id,
          device_id: '', // Not returned by function
          username: row.username,
          profile_picture_url: row.profile_picture_url,
        },
        exercise_id: row.exercise_id,
        estimated_1rm: row.estimated_1rm,
        weight: 0, // Not returned by function
        reps: 0, // Not returned by function
        recorded_at: new Date(row.recorded_at),
        rank: row.rank,
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  /**
   * Get leaderboard for a specific exercise
   */
  async getExerciseLeaderboard(exerciseId: string): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard([exerciseId]);
  }

  /**
   * Sync user's overall percentile data to Supabase
   */
  async syncPercentileData(
    overallPercentile: number,
    strengthLevel: string,
    muscleGroups: MuscleGroupPercentiles,
    topContributions: TopContribution[]
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      let user = await this.getCurrentUser();
      if (!user) {
        // Auto-create user if they don't exist
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        user = await this.syncUser(username);
        if (!user) {
          analyticsService.logErr('sync', 'percentile_sync_no_user', 'Failed to get/create user for percentile sync');
          return false;
        }
      }

      // Upsert percentile data
      const { error } = await supabase
        .from('user_percentiles')
        .upsert({
          user_id: user.id,
          overall_percentile: overallPercentile,
          strength_level: strengthLevel,
          muscle_groups: muscleGroups,
          top_contributions: topContributions,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error syncing percentile data:', error);
        analyticsService.logErr('sync', 'percentile_sync_failed', error.message, {
          code: error.code,
          overallPercentile,
          strengthLevel
        });
        return false;
      }

      analyticsService.logInfo('sync', 'percentile_synced', 'Percentile data synced', {
        overallPercentile,
        strengthLevel,
        topContributionsCount: topContributions.length
      });
      return true;
    } catch (error) {
      console.error('Error syncing percentile data:', error);
      analyticsService.logErr('sync', 'percentile_sync_error', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Calculate and sync percentile data based on current user lifts
   * Call this after recording new lifts
   */
  async calculateAndSyncPercentiles(): Promise<boolean> {
    try {
      // Get all featured lifts with percentiles
      const lifts = await userService.getAllFeaturedLifts();
      if (lifts.length === 0) {
        // No lifts to sync - not an error, just early return
        analyticsService.logInfo('sync', 'percentile_sync_skipped', 'No lifts to sync');
        return false;
      }

      // Calculate overall percentile
      const nonZeroPercentiles = lifts.map(l => l.percentileRanking).filter(p => p > 0);
      if (nonZeroPercentiles.length === 0) {
        // Log this issue to Supabase for debugging - likely missing body weight
        analyticsService.logErr('sync', 'percentile_sync_zero', 'All percentiles are 0 - likely missing body weight in profile', {
          liftsCount: lifts.length,
          lifts: lifts.slice(0, 10).map(l => ({
            id: l.workoutId,
            pr: l.personalRecord,
            pct: l.percentileRanking
          })),
        });
        return false;
      }

      const overallPercentile = calculateOverallPercentile(nonZeroPercentiles);
      const strengthLevel = getStrengthLevelName(overallPercentile);

      // Build muscle group percentiles
      const muscleGroups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes'] as const;
      const liftToMuscles: Record<string, string[]> = {};
      ALL_WORKOUTS.forEach((w: { id: string; primaryMuscles?: string[] }) => {
        liftToMuscles[w.id] = [...(w.primaryMuscles || [])];
      });

      const groupToValues: Record<string, number[]> = {};
      muscleGroups.forEach(g => (groupToValues[g] = []));

      lifts.forEach(l => {
        const groups = liftToMuscles[l.workoutId] || [];
        groups.forEach(g => {
          if (g in groupToValues && l.percentileRanking > 0) {
            groupToValues[g].push(l.percentileRanking);
          }
        });
      });

      const toAvg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
      const muscleGroupPercentiles: MuscleGroupPercentiles = {
        chest: toAvg(groupToValues['chest']),
        back: toAvg(groupToValues['back']),
        shoulders: toAvg(groupToValues['shoulders']),
        arms: toAvg(groupToValues['arms']),
        legs: toAvg(groupToValues['legs']),
        glutes: toAvg(groupToValues['glutes']),
      };

      // Build top contributions
      const sortedLifts = [...lifts].sort((a, b) => b.percentileRanking - a.percentileRanking);
      const topContributions: TopContribution[] = sortedLifts
        .filter(l => l.percentileRanking > 0)
        .slice(0, 5)
        .map(l => {
          const workout = getWorkoutById(l.workoutId);
          return {
            exercise_id: l.workoutId,
            name: workout?.name || l.workoutId.replace('-', ' '),
            percentile: l.percentileRanking,
          };
        });

      // Sync to Supabase
      return this.syncPercentileData(overallPercentile, strengthLevel, muscleGroupPercentiles, topContributions);
    } catch (error) {
      console.error('Error calculating and syncing percentiles:', error);
      return false;
    }
  }

  /**
   * Get overall strength leaderboard (global)
   */
  async getOverallLeaderboard(countryCode?: string | null): Promise<OverallLeaderboardEntry[]> {
    if (!supabase) return [];

    try {
      let query = supabase
        .from('overall_leaderboard')
        .select('*')
        .order('overall_percentile', { ascending: false })
        .limit(50);

      if (countryCode) {
        query = query.eq('country_code', countryCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting overall leaderboard:', error);
        return [];
      }

      return (data || []).map((row: {
        user_id: string;
        username: string;
        country_code?: string;
        profile_picture_url?: string;
        overall_percentile: number;
        strength_level: string;
        muscle_groups: MuscleGroupPercentiles;
        top_contributions: TopContribution[];
        rank: number;
      }) => ({
        user: {
          id: row.user_id,
          device_id: '',
          username: row.username,
          country_code: row.country_code,
          profile_picture_url: row.profile_picture_url,
        },
        overall_percentile: row.overall_percentile,
        strength_level: row.strength_level,
        muscle_groups: row.muscle_groups || { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, glutes: 0 },
        top_contributions: row.top_contributions || [],
        rank: row.rank,
      }));
    } catch (error) {
      console.error('Error getting overall leaderboard:', error);
      return [];
    }
  }

  /**
   * Get overall strength leaderboard for friends
   */
  async getFriendsOverallLeaderboard(): Promise<OverallLeaderboardEntry[]> {
    if (!supabase) return [];

    try {
      let user = await this.getCurrentUser();
      if (!user) {
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        user = await this.syncUser(username);
        if (!user) return [];
      }

      // Get user's friends
      const friends = await this.getFriends();
      const friendIds = friends.map(f => f.user.id);

      // Include the user themselves
      const userIds = [user.id, ...friendIds];

      const { data, error } = await supabase
        .from('overall_leaderboard')
        .select('*')
        .in('user_id', userIds)
        .order('overall_percentile', { ascending: false });

      if (error) {
        console.error('Error getting friends overall leaderboard:', error);
        return [];
      }

      // Rerank based on friends only
      return (data || []).map((row: {
        user_id: string;
        username: string;
        country_code?: string;
        profile_picture_url?: string;
        overall_percentile: number;
        strength_level: string;
        muscle_groups: MuscleGroupPercentiles;
        top_contributions: TopContribution[];
      }, index: number) => ({
        user: {
          id: row.user_id,
          device_id: '',
          username: row.username,
          country_code: row.country_code,
          profile_picture_url: row.profile_picture_url,
        },
        overall_percentile: row.overall_percentile,
        strength_level: row.strength_level,
        muscle_groups: row.muscle_groups || { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, glutes: 0 },
        top_contributions: row.top_contributions || [],
        rank: index + 1,
      }));
    } catch (error) {
      console.error('Error getting friends overall leaderboard:', error);
      return [];
    }
  }

  /**
   * Get a specific user's percentile data
   */
  async getUserPercentileData(userId: string): Promise<UserPercentileData | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('user_percentiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Error getting user percentile data:', error);
        }
        return null;
      }

      return {
        user_id: data.user_id,
        overall_percentile: data.overall_percentile,
        strength_level: data.strength_level,
        muscle_groups: data.muscle_groups || { chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, glutes: 0 },
        top_contributions: data.top_contributions || [],
        updated_at: data.updated_at ? new Date(data.updated_at) : undefined,
      };
    } catch (error) {
      console.error('Error getting user percentile data:', error);
      return null;
    }
  }

  /**
   * Sync a completed workout to Supabase for social viewing
   */
  async syncWorkout(workout: GeneratedWorkout, durationSeconds: number, prCount: number = 0): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) {
        analyticsService.logErr('sync', 'workout_sync_no_user', 'No user found for workout sync');
        return false;
      }

      // Build exercise summaries
      const exerciseSummaries: WorkoutExerciseSummary[] = workout.exercises
        .filter(ex => ex.completedSets.length > 0)
        .map(ex => {
          const completedSets = ex.completedSets.filter(s => s.completed);
          const bestSet = completedSets.reduce((best, current) => {
            const bestVolume = best.weight * best.reps;
            const currentVolume = current.weight * current.reps;
            return currentVolume > bestVolume ? current : best;
          }, completedSets[0]);

          const exerciseInfo = getWorkoutById(ex.id);
          return {
            name: exerciseInfo?.name || ex.id.replace(/-/g, ' '),
            sets: completedSets.length,
            bestSet: bestSet ? `${bestSet.weight}x${bestSet.reps}` : '',
          };
        });

      // Calculate totals
      const totalSets = workout.exercises.reduce(
        (sum, ex) => sum + ex.completedSets.filter(s => s.completed).length,
        0
      );
      const totalVolume = workout.exercises.reduce((sum, ex) => {
        return sum + ex.completedSets
          .filter(s => s.completed)
          .reduce((setSum, set) => {
            const weightInLbs = set.unit === 'kg' ? set.weight * 2.205 : set.weight;
            return setSum + (weightInLbs * set.reps);
          }, 0);
      }, 0);

      // Get user's current strength level for feed display
      const percentileData = await this.getUserPercentileData(user.id);
      const feedData: WorkoutFeedData = {
        strength_level: percentileData?.strength_level,
        pr_count: prCount,
      };

      // Upsert workout
      const { error } = await supabase
        .from('user_workouts')
        .upsert({
          id: workout.id,
          user_id: user.id,
          title: workout.title,
          created_at: workout.createdAt.toISOString(),
          duration_seconds: durationSeconds,
          exercise_count: exerciseSummaries.length,
          set_count: totalSets,
          total_volume: Math.round(totalVolume),
          exercises: exerciseSummaries,
          feed_data: feedData,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'id',
        });

      if (error) {
        console.error('Error syncing workout:', error);
        analyticsService.logErr('sync', 'workout_sync_failed', error.message, {
          code: error.code,
          workoutId: workout.id
        });
        return false;
      }

      analyticsService.logInfo('sync', 'workout_synced', 'Workout synced to Supabase', {
        workoutId: workout.id,
        exerciseCount: exerciseSummaries.length,
        totalSets,
        totalVolume: Math.round(totalVolume),
        strengthLevel: feedData.strength_level,
        prCount
      });
      return true;
    } catch (error) {
      console.error('Error syncing workout:', error);
      analyticsService.logErr('sync', 'workout_sync_error', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get a user's recent workouts
   */
  async getUserWorkouts(userId: string, limit: number = 10): Promise<WorkoutSummary[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('user_workouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user workouts:', error);
        return [];
      }

      return (data || []).map(w => ({
        id: w.id,
        title: w.title,
        created_at: new Date(w.created_at),
        duration_seconds: w.duration_seconds,
        exercise_count: w.exercise_count,
        set_count: w.set_count,
        total_volume: w.total_volume,
        exercises: w.exercises as WorkoutExerciseSummary[],
      }));
    } catch (error) {
      console.error('Error fetching user workouts:', error);
      return [];
    }
  }

  /**
   * Delete a synced workout
   */
  async deleteWorkout(workoutId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('user_workouts')
        .delete()
        .eq('id', workoutId);

      if (error) {
        console.error('Error deleting workout:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error deleting workout:', error);
      return false;
    }
  }

  /**
   * Get friends' recent workouts for feed
   */
  async getFriendsWorkoutFeed(limit: number = 20): Promise<(WorkoutSummary & { username: string; profile_picture_url?: string; user_id: string })[]> {
    if (!supabase) return [];

    try {
      const friends = await this.getFriends();
      if (friends.length === 0) return [];

      const friendIds = friends.map(f => f.user.id);

      const { data, error } = await supabase
        .from('user_workouts')
        .select(`
          *,
          users!inner(username, profile_picture_url)
        `)
        .in('user_id', friendIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching friends workout feed:', error);
        return [];
      }

      return (data || []).map(w => ({
        id: w.id,
        user_id: w.user_id,
        title: w.title,
        created_at: new Date(w.created_at),
        duration_seconds: w.duration_seconds,
        exercise_count: w.exercise_count,
        set_count: w.set_count,
        total_volume: w.total_volume,
        exercises: w.exercises as WorkoutExerciseSummary[],
        username: (w.users as { username: string }).username,
        profile_picture_url: (w.users as { profile_picture_url?: string }).profile_picture_url,
      }));
    } catch (error) {
      console.error('Error fetching friends workout feed:', error);
      return [];
    }
  }

  /**
   * Get global workout feed (all users) with pagination
   */
  async getGlobalWorkoutFeed(limit: number = 20, offset: number = 0): Promise<(WorkoutSummary & { username: string; profile_picture_url?: string; user_id: string })[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('user_workouts')
        .select(`
          *,
          users!inner(username, profile_picture_url)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching global workout feed:', error);
        return [];
      }

      return (data || []).map(w => ({
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
        username: (w.users as { username: string }).username,
        profile_picture_url: (w.users as { profile_picture_url?: string }).profile_picture_url,
      }));
    } catch (error) {
      console.error('Error fetching global workout feed:', error);
      return [];
    }
  }

  /**
   * Toggle reaction on a workout (add, change, or remove)
   * If user already has same reaction, removes it. If different, updates it.
   */
  async toggleReaction(workoutId: string, reactionType: ReactionType): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      // Get current workout feed_data
      const { data: workout, error: fetchError } = await supabase
        .from('user_workouts')
        .select('feed_data')
        .eq('id', workoutId)
        .single();

      if (fetchError) {
        console.error('Error fetching workout for reaction:', fetchError);
        return false;
      }

      const feedData: WorkoutFeedData = (workout?.feed_data as WorkoutFeedData) || {};
      const reactions = feedData.reactions || [];

      // Check if user already has a reaction
      const existingIndex = reactions.findIndex(r => r.user_id === user.id);

      if (existingIndex >= 0) {
        if (reactions[existingIndex].reaction_type === reactionType) {
          // Same reaction - remove it
          reactions.splice(existingIndex, 1);
        } else {
          // Different reaction - update it
          reactions[existingIndex] = {
            user_id: user.id,
            username: user.username,
            profile_picture_url: user.profile_picture_url,
            reaction_type: reactionType,
            created_at: new Date().toISOString(),
          };
        }
      } else {
        // Add new reaction
        reactions.push({
          user_id: user.id,
          username: user.username,
          profile_picture_url: user.profile_picture_url,
          reaction_type: reactionType,
          created_at: new Date().toISOString(),
        });
      }

      // Update feed_data
      const { error: updateError } = await supabase
        .from('user_workouts')
        .update({ feed_data: { ...feedData, reactions } })
        .eq('id', workoutId);

      if (updateError) {
        console.error('Error updating reaction:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error toggling reaction:', error);
      return false;
    }
  }

  /**
   * Add a comment to a workout
   */
  async addComment(workoutId: string, text: string): Promise<FeedComment | null> {
    if (!supabase) return null;

    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      // Basic profanity check on comment
      if (containsProfanity(text)) {
        console.warn('Comment contains profanity');
        return null;
      }

      // Get current workout feed_data
      const { data: workout, error: fetchError } = await supabase
        .from('user_workouts')
        .select('feed_data')
        .eq('id', workoutId)
        .single();

      if (fetchError) {
        console.error('Error fetching workout for comment:', fetchError);
        return null;
      }

      const feedData: WorkoutFeedData = (workout?.feed_data as WorkoutFeedData) || {};
      const comments = feedData.comments || [];

      // Create new comment (generate simple UUID)
      const newComment: FeedComment = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: user.id,
        username: user.username,
        profile_picture_url: user.profile_picture_url,
        text: text.trim(),
        created_at: new Date().toISOString(),
      };

      comments.push(newComment);

      // Update feed_data
      const { error: updateError } = await supabase
        .from('user_workouts')
        .update({ feed_data: { ...feedData, comments } })
        .eq('id', workoutId);

      if (updateError) {
        console.error('Error adding comment:', updateError);
        return null;
      }

      return newComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      return null;
    }
  }

  /**
   * Delete a comment from a workout (only comment author or workout owner can delete)
   */
  async deleteComment(workoutId: string, commentId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      // Get current workout
      const { data: workout, error: fetchError } = await supabase
        .from('user_workouts')
        .select('feed_data, user_id')
        .eq('id', workoutId)
        .single();

      if (fetchError) {
        console.error('Error fetching workout for comment deletion:', fetchError);
        return false;
      }

      const feedData: WorkoutFeedData = (workout?.feed_data as WorkoutFeedData) || {};
      const comments = feedData.comments || [];

      // Find comment
      const commentIndex = comments.findIndex(c => c.id === commentId);
      if (commentIndex < 0) return false;

      // Check if user can delete (comment author or workout owner)
      const comment = comments[commentIndex];
      if (comment.user_id !== user.id && workout.user_id !== user.id) {
        console.warn('User not authorized to delete this comment');
        return false;
      }

      comments.splice(commentIndex, 1);

      // Update feed_data
      const { error: updateError } = await supabase
        .from('user_workouts')
        .update({ feed_data: { ...feedData, comments } })
        .eq('id', workoutId);

      if (updateError) {
        console.error('Error deleting comment:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      return false;
    }
  }

  /**
   * Get the current user's reaction on a workout (if any)
   */
  getUserReactionFromFeedData(feedData: WorkoutFeedData | undefined, userId: string): ReactionType | undefined {
    if (!feedData?.reactions) return undefined;
    const reaction = feedData.reactions.find(r => r.user_id === userId);
    return reaction?.reaction_type;
  }
}

export const userSyncService = new UserSyncService();
