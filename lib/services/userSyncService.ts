// INTENTIONAL: synced/leaderboard percentiles do NOT honor hiddenLiftIds —
// hiding a lift affects your local dashboard only, never your public rank.
import { supabase } from './supabase';
import { analyticsService } from './analytics';
import { geoService } from './geoService';
import { LoggedWorkout, RemoteUser, RemoteUserData, Friend, LeaderboardEntry, UserLift, MuscleGroupPercentiles, TopContribution, OverallLeaderboardEntry, UserPercentileData, isFeaturedLift, WeightUnit} from '@/types';
import { calculateStrengthPercentile, getStrengthLevelName, getStrengthTier, OneRMCalculator, StrengthTier, e1rmLbs} from '@/lib/data/strengthStandards';
import { roundedAverage as toAvg, calculateOverallPercentile, convertWeightToLbs, formatBestSet, setVolumeLbs} from '@/lib/utils/utils';
import { userService } from './userService';
import { getCatalogExercise, getExerciseById, EXERCISE_CATALOG } from '@/lib/workout/exerciseCatalog';
import { feedService, WorkoutExerciseSummary, WorkoutFeedData, WorkoutSummary } from './feedService';
import { attributeAchievements } from '@/lib/history/achievementAttribution';
import { storageService } from '@/lib/storage/storage';
import { containsProfanity } from '@/lib/utils/moderation';
import { LeagueMemberAggregates, LeagueTopLift } from '@/lib/leagues/types';

// Overall strength snapshot used by the feed to color/annotate author names.
export interface UserStrengthSummary {
  tier: StrengthTier;
  percentile: number;
}

class UserSyncService {
  private currentUserId: string | null = null;
  // user_id → overall strength; null marks a confirmed "no percentile row yet".
  private strengthLevelCache = new Map<string, UserStrengthSummary | null>();

  async syncUser(username: string): Promise<RemoteUser | null> {
    if (!supabase) return null;

    try {
      const deviceId = await analyticsService.getDeviceId();

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

      // Upsert (not insert) to survive concurrent creation races.
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .upsert({ device_id: deviceId, username }, { onConflict: 'device_id' })
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

  // The current backend user, creating one (with a default username) if none exists.
  // Leaves this.currentUserId set so subsequent id-keyed updates work.
  private async getOrCreateUser(): Promise<RemoteUser | null> {
    const user = await this.getCurrentUser();
    if (user) return user;
    const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
    await analyticsService.setUsername(username);
    return this.syncUser(username);
  }

  // Patch fields on the current user's row (auto-creating the user first).
  private async updateUserField(fields: Record<string, unknown>): Promise<boolean> {
    if (!supabase) return false;
    try {
      const user = await this.getOrCreateUser();
      if (!user) return false;

      const { error } = await supabase
        .from('users')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', this.currentUserId);

      if (error) {
        console.error('Error updating user:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  }

  // Merges into the existing user_data jsonb so fields other callers own (e.g.
  // the featured achievement) survive a profile save.
  async syncProfileData(profileData: RemoteUserData): Promise<boolean> {
    return this.mergeUserData(profileData);
  }

  /** The achievement badge on this user's public profile (null clears it). */
  async syncFeaturedAchievement(achievementId: string | null): Promise<boolean> {
    return this.mergeUserData({ featured_achievement_id: achievementId ?? undefined });
  }

  /** Patch user_data without clobbering fields the patch doesn't mention. */
  private async mergeUserData(patch: Partial<RemoteUserData>): Promise<boolean> {
    if (!supabase) return false;
    try {
      const user = await this.getOrCreateUser();
      if (!user) return false;
      const { data } = await supabase
        .from('users')
        .select('user_data')
        .eq('id', this.currentUserId)
        .single();
      const merged = { ...(data?.user_data ?? {}), ...patch };
      // An explicit undefined means "clear this field".
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete (merged as Record<string, unknown>)[k];
      }
      return this.updateUserField({ user_data: merged });
    } catch (error) {
      console.error('Error merging user data:', error);
      return false;
    }
  }

  /** Returns null when valid, else an error message. */
  async validateUsername(username: string): Promise<string | null> {
    if (username.length < 1) {
      return 'Username cannot be empty';
    }
    if (username.length > 20) {
      return 'Username must be 20 characters or less';
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }

    if (containsProfanity(username)) {
      return 'Username contains inappropriate content';
    }

    if (!supabase) return null;

    try {
      const deviceId = await analyticsService.getDeviceId();

      const { data, error } = await supabase
        .from('users')
        .select('id, device_id')
        .eq('username', username)
        .single();

      if (error) {
        // PGRST116 = no rows → name is free
        if (error.code === 'PGRST116') return null;
        console.error('Error checking username:', error);
        return 'Error checking username availability';
      }

      // Available if the row is the current device's own.
      if (data.device_id === deviceId) {
        return null;
      }

      return 'Username is already taken';
    } catch (error) {
      console.error('Error checking username:', error);
      return 'Error checking username availability';
    }
  }

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

  async addFriend(friendId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      // Bidirectional: insert each direction separately so one already existing
      // doesn't abort the other.
      const insertions = [
        { user_id: user.id, friend_id: friendId },
        { user_id: friendId, friend_id: user.id },
      ];

      for (const insertion of insertions) {
        const { error } = await supabase
          .from('friends')
          .upsert(insertion, { onConflict: 'user_id,friend_id', ignoreDuplicates: true });

        if (error && error.code !== '23505') {
          console.error('Error adding friend:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error adding friend:', error);
      return false;
    }
  }

  async removeFriend(friendId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      // Remove both directions.
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

  private async syncCountryCode(countryCode: string): Promise<boolean> {
    return this.updateUserField({ country_code: countryCode });
  }

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

  async syncLifts(lifts: UserLift[]): Promise<void> {
    if (!supabase || lifts.length === 0) return;

    try {
      let user = await this.getCurrentUser();
      if (!user) {
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        user = await this.syncUser(username);
        if (!user) {
          console.error('Failed to create user for lift sync');
          analyticsService.logErr('sync', 'lifts_sync_no_user', 'Failed to create user for lift sync');
          return;
        }
      }

      const userProfile = await userService.getUserProfileOrDefault();
      const bodyWeightLbs = convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit);
      const gender = userProfile.gender === 'male' || userProfile.gender === 'female' ? userProfile.gender : 'male';
      const age = userProfile.age;

      const liftRecords = lifts.map((lift) => {
        const weightLbs = convertWeightToLbs(lift.weight, lift.unit);
        const estimated1rm = OneRMCalculator.estimate(weightLbs, lift.reps);

        let strengthTier: string | null = null;
        if (bodyWeightLbs > 0 && isFeaturedLift(lift.id)) {
          const percentile = calculateStrengthPercentile(
            estimated1rm,
            bodyWeightLbs,
            gender,
            lift.id,
            age
          );
          if (percentile > 0) {
            strengthTier = getStrengthTier(percentile);
          }
        }

        return {
          user_id: user.id,
          exercise_id: lift.id,
          weight: weightLbs,
          reps: lift.reps,
          estimated_1rm: estimated1rm,
          strength_tier: strengthTier,
          recorded_at: lift.dateRecorded,
        };
      });

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

  async getLeaderboard(exerciseIds: string[]): Promise<LeaderboardEntry[]> {
    if (!supabase || exerciseIds.length === 0) return [];

    try {
      let user = await this.getCurrentUser();
      if (!user) {
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        user = await this.syncUser(username);
        if (!user) return [];
      }

      const { data, error } = await supabase.rpc('get_friend_leaderboard', {
        p_user_id: user.id,
        p_exercise_ids: exerciseIds,
      });

      if (error) {
        console.error('Error getting leaderboard:', error);
        return [];
      }

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
          device_id: '', // not returned by the RPC
          username: row.username,
          profile_picture_url: row.profile_picture_url,
        },
        exercise_id: row.exercise_id,
        estimated_1rm: row.estimated_1rm,
        weight: 0, // not returned by the RPC
        reps: 0, // not returned by the RPC
        recorded_at: new Date(row.recorded_at),
        rank: row.rank,
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  private async syncPercentileData(
    overallPercentile: number,
    strengthLevel: string,
    muscleGroups: MuscleGroupPercentiles,
    topContributions: TopContribution[]
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      let user = await this.getCurrentUser();
      if (!user) {
        const username = await analyticsService.getUsername() || await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(username);
        user = await this.syncUser(username);
        if (!user) {
          analyticsService.logErr('sync', 'percentile_sync_no_user', 'Failed to get/create user for percentile sync');
          return false;
        }
      }

      const { data: existing } = await supabase
        .from('user_percentiles')
        .select('overall_percentile, percentile_history')
        .eq('user_id', user.id)
        .single();

      let percentileHistory: { percentile: number; date: string; muscleGroups?: MuscleGroupPercentiles }[] = existing?.percentile_history || [];
      const today = new Date().toISOString().split('T')[0];

      // Add a history entry only when the percentile changed (or none exists yet).
      const shouldAddEntry = !existing ||
        Math.round(existing.overall_percentile) !== Math.round(overallPercentile) ||
        percentileHistory.length === 0;

      if (shouldAddEntry) {
        // Drop today's existing entry so we update rather than duplicate.
        percentileHistory = percentileHistory.filter(h => h.date !== today);
        percentileHistory.push({
          percentile: Math.round(overallPercentile),
          date: today,
          muscleGroups: muscleGroups,
        });

        // Cap at ~1 year of daily entries.
        if (percentileHistory.length > 365) {
          percentileHistory = percentileHistory.slice(-365);
        }
      }

      const { error } = await supabase
        .from('user_percentiles')
        .upsert({
          user_id: user.id,
          overall_percentile: overallPercentile,
          strength_level: strengthLevel,
          muscle_groups: muscleGroups,
          top_contributions: topContributions,
          percentile_history: percentileHistory,
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
        topContributionsCount: topContributions.length,
        historyEntries: percentileHistory.length
      });
      return true;
    } catch (error) {
      console.error('Error syncing percentile data:', error);
      analyticsService.logErr('sync', 'percentile_sync_error', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /** Call after recording new lifts. */
  async calculateAndSyncPercentiles(): Promise<boolean> {
    try {
      const lifts = await userService.getAllFeaturedLifts();
      if (lifts.length === 0) {
        // Nothing to sync — not an error.
        analyticsService.logInfo('sync', 'percentile_sync_skipped', 'No lifts to sync');
        return false;
      }

      const nonZeroPercentiles = lifts.map(l => l.percentileRanking).filter(p => p > 0);
      if (nonZeroPercentiles.length === 0) {
        // All-zero usually means body weight is missing from the profile.
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

      const muscleGroups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes'] as const;
      const liftToMuscles: Record<string, string[]> = {};
      EXERCISE_CATALOG.forEach((w: { id: string; primaryMuscles?: string[] }) => {
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

      const muscleGroupPercentiles: MuscleGroupPercentiles = {
        chest: toAvg(groupToValues['chest']),
        back: toAvg(groupToValues['back']),
        shoulders: toAvg(groupToValues['shoulders']),
        arms: toAvg(groupToValues['arms']),
        legs: toAvg(groupToValues['legs']),
        glutes: toAvg(groupToValues['glutes']),
      };

      const sortedLifts = [...lifts].sort((a, b) => b.percentileRanking - a.percentileRanking);
      const topContributions: TopContribution[] = sortedLifts
        .filter(l => l.percentileRanking > 0)
        .slice(0, 5)
        .map(l => {
          const workout = getCatalogExercise(l.workoutId);
          return {
            exercise_id: l.workoutId,
            name: workout?.name || l.workoutId.replace('-', ' '),
            percentile: l.percentileRanking,
            weight: l.personalRecord,
          };
        });

      return this.syncPercentileData(overallPercentile, strengthLevel, muscleGroupPercentiles, topContributions);
    } catch (error) {
      console.error('Error calculating and syncing percentiles:', error);
      return false;
    }
  }

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

      const friends = await this.getFriends();
      const friendIds = friends.map(f => f.user.id);

      const userIds = [user.id, ...friendIds]; // include the user themselves

      const { data, error } = await supabase
        .from('overall_leaderboard')
        .select('*')
        .in('user_id', userIds)
        .order('overall_percentile', { ascending: false });

      if (error) {
        console.error('Error getting friends overall leaderboard:', error);
        return [];
      }

      // Rerank within friends only.
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
        percentile_history: data.percentile_history || [],
        updated_at: data.updated_at ? new Date(data.updated_at) : undefined,
      };
    } catch (error) {
      console.error('Error getting user percentile data:', error);
      return null;
    }
  }

  /**
   * Batch lookup of overall strength (from user_percentiles), for tier-coloring
   * feed author names and showing their percentile. Cached per session — tiers
   * move slowly, so pagination and re-renders don't refetch known users.
   */
  async getUserStrengthLevels(userIds: string[]): Promise<Record<string, UserStrengthSummary>> {
    const result: Record<string, UserStrengthSummary> = {};
    const missing: string[] = [];

    for (const id of new Set(userIds)) {
      if (this.strengthLevelCache.has(id)) {
        const cached = this.strengthLevelCache.get(id);
        if (cached) result[id] = cached;
      } else {
        missing.push(id);
      }
    }

    if (missing.length === 0 || !supabase) return result;

    try {
      const { data, error } = await supabase
        .from('user_percentiles')
        .select('user_id, strength_level, overall_percentile')
        .in('user_id', missing);

      if (error) {
        console.error('Error fetching strength levels:', error);
        return result;
      }

      for (const row of data || []) {
        const tier = (row.strength_level as StrengthTier) || null;
        const summary = tier ? { tier, percentile: Math.round(row.overall_percentile ?? 0) } : null;
        this.strengthLevelCache.set(row.user_id, summary);
        if (summary) result[row.user_id] = summary;
      }
      // Cache the misses too so users without percentile rows don't refetch.
      for (const id of missing) {
        if (!this.strengthLevelCache.has(id)) this.strengthLevelCache.set(id, null);
      }
    } catch (error) {
      console.error('Error fetching strength levels:', error);
    }

    return result;
  }

  /**
   * All lift rows for an exercise recorded on or before the cutoff — the raw
   * material for reconstructing the board as of that date (user_lifts is
   * append-only, so history is complete). Feeds lib/gamification/leaderboardInsights.
   */
  async getLiftRowsAsOf(exerciseId: string, cutoffIso: string): Promise<{ user_id: string; estimated_1rm: number }[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('user_lifts')
        .select('user_id, estimated_1rm')
        .eq('exercise_id', exerciseId)
        .lte('recorded_at', cutoffIso)
        .limit(5000);

      if (error) {
        console.error('Error fetching historical lifts:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error fetching historical lifts:', error);
      return [];
    }
  }

  /**
   * Weekly-league aggregates for the viewer's week window (docs/leagues-v1-spec.md):
   * every user active in the window + the viewer, raw and unscored — scoring is
   * lib/leagues/scoring.ts. Empty when the backend (or the RPC) is unavailable.
   */
  async getLeagueWeek(weekStart: Date, weekEnd: Date): Promise<LeagueMemberAggregates[]> {
    if (!supabase) return [];

    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_league_week', {
        p_user_id: user.id,
        p_week_start: weekStart.toISOString(),
        p_week_end: weekEnd.toISOString(),
      });

      if (error) {
        console.error('Error getting league week:', error);
        return [];
      }

      return (data || []).map((row: {
        user_id: string;
        username: string;
        profile_picture_url: string | null;
        sessions: number;
        active_days: number;
        volume_lbs: number | null;
        top_lifts: LeagueTopLift[] | null;
        is_friend: boolean;
      }) => ({
        user_id: row.user_id,
        username: row.username,
        profile_picture_url: row.profile_picture_url ?? null,
        sessions: row.sessions ?? 0,
        active_days: row.active_days ?? 0,
        // Pre-014 RPC shapes degrade to zero volume / no lifts.
        volume_lbs: Number(row.volume_lbs ?? 0),
        top_lifts: Array.isArray(row.top_lifts) ? row.top_lifts : [],
        is_friend: !!row.is_friend,
      }));
    } catch (error) {
      console.error('Error getting league week:', error);
      return [];
    }
  }

  /** Percentile snapshot histories for a set of users (empty array = no history yet). */
  async getPercentileHistories(userIds: string[]): Promise<Record<string, { percentile: number; date: string }[]>> {
    if (!supabase || userIds.length === 0) return {};

    try {
      const { data, error } = await supabase
        .from('user_percentiles')
        .select('user_id, percentile_history')
        .in('user_id', userIds);

      if (error) {
        console.error('Error fetching percentile histories:', error);
        return {};
      }

      const result: Record<string, { percentile: number; date: string }[]> = {};
      for (const row of data || []) {
        result[row.user_id] = row.percentile_history || [];
      }
      return result;
    } catch (error) {
      console.error('Error fetching percentile histories:', error);
      return {};
    }
  }

  /**
   * The viewer's own standing on a lift board, even when they're outside the
   * visible top 50. Global rank comes from the exercise_leaderboard view;
   * a country rank is recomputed by counting compatriots above them.
   */
  async getMyLiftStanding(exerciseId: string, countryCode?: string | null): Promise<{ rank: number; oneRm: number; tier?: string } | null> {
    if (!supabase) return null;

    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('exercise_leaderboard')
        .select('estimated_1rm, strength_tier, rank')
        .eq('exercise_id', exerciseId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return null;

      let rank = data.rank as number;
      if (countryCode) {
        const { count, error: countError } = await supabase
          .from('exercise_leaderboard')
          .select('user_id', { count: 'exact', head: true })
          .eq('exercise_id', exerciseId)
          .eq('country_code', countryCode)
          .gt('estimated_1rm', data.estimated_1rm);
        if (countError || count == null) return null;
        rank = count + 1;
      }

      return { rank, oneRm: data.estimated_1rm, tier: data.strength_tier || undefined };
    } catch (error) {
      console.error('Error fetching own lift standing:', error);
      return null;
    }
  }

  /** Same as getMyLiftStanding, for the overall-percentile board. */
  async getMyOverallStanding(countryCode?: string | null): Promise<{ rank: number; percentile: number; tier?: string } | null> {
    if (!supabase) return null;

    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('overall_leaderboard')
        .select('overall_percentile, strength_level, rank')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return null;

      let rank = data.rank as number;
      if (countryCode) {
        const { count, error: countError } = await supabase
          .from('overall_leaderboard')
          .select('user_id', { count: 'exact', head: true })
          .eq('country_code', countryCode)
          .gt('overall_percentile', data.overall_percentile);
        if (countError || count == null) return null;
        rank = count + 1;
      }

      return { rank, percentile: data.overall_percentile, tier: data.strength_level || undefined };
    } catch (error) {
      console.error('Error fetching own overall standing:', error);
      return null;
    }
  }

  async syncWorkout(workout: LoggedWorkout, durationSeconds: number, prCount: number = 0): Promise<boolean> {
    if (!supabase) return false;

    try {
      const user = await this.getCurrentUser();
      if (!user) {
        analyticsService.logErr('sync', 'workout_sync_no_user', 'No user found for workout sync');
        return false;
      }

      const userProfile = await userService.getUserProfileOrDefault();
      const bodyWeightLbs = convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit);
      const gender = userProfile.gender || 'male';

      // Async to support custom-exercise lookup.
      const exercisesWithSets = workout.exercises.filter(ex => ex.completedSets.length > 0);
      const exerciseSummariesRaw = await Promise.all(
        exercisesWithSets.map(async ex => {
          const completedSets = ex.completedSets.filter(s => s.completed);
          if (completedSets.length === 0) {
            return null;
          }

          // Look up first so trackingType is known below (supports custom exercises).
          const exerciseInfo = await getExerciseById(ex.id);
          const trackingType = exerciseInfo?.trackingType || 'reps';

          let bestSet = completedSets[0];
          if (trackingType === 'reps' && completedSets.length > 1) {
            // Best by estimated 1RM (consistent with summary and history cards).
            bestSet = completedSets.reduce((best, current) => {
              const best1RM = e1rmLbs(best.weight, best.reps, best.unit as WeightUnit);
              const current1RM = e1rmLbs(current.weight, current.reps, current.unit as WeightUnit);
              return current1RM > best1RM ? current : best;
            }, completedSets[0]);
          } else if (trackingType === 'cardio' && completedSets.length > 1) {
            // Cardio: best = longest distance/duration.
            bestSet = completedSets.reduce((best, current) => {
              const bestScore = (best.distance || 0) + (best.duration || 0);
              const currentScore = (current.distance || 0) + (current.duration || 0);
              return currentScore > bestScore ? current : best;
            }, completedSets[0]);
          } else if (trackingType === 'timed' && completedSets.length > 1) {
            // Timed: best = longest duration.
            bestSet = completedSets.reduce((best, current) => {
              return (current.duration || 0) > (best.duration || 0) ? current : best;
            }, completedSets[0]);
          }

          // Percentile only for featured reps-based lifts.
          let percentile: number | undefined;
          if (trackingType === 'reps' && bestSet && isFeaturedLift(ex.id) && bodyWeightLbs > 0) {
            const estimated1RM = e1rmLbs(bestSet.weight, bestSet.reps, bestSet.unit as WeightUnit);
            // Age-adjusted, same as the profile percentile — the feed card must agree.
            percentile = calculateStrengthPercentile(estimated1RM, bodyWeightLbs, gender, ex.id, userProfile.age);
            if (percentile <= 0) percentile = undefined;
          }

          const allSets = completedSets.map((set, index) => ({
            setNumber: index + 1,
            weight: set.weight,
            reps: set.reps,
            unit: set.unit as 'lbs' | 'kg',
            duration: set.duration,
            distance: set.distance,
            isPersonalRecord: bestSet && set === bestSet,
          }));

          return {
            name: exerciseInfo?.name || ex.id.replace(/-/g, ' ').replace(/_/g, ' '),
            sets: completedSets.length,
            // Unit included — viewers have no other way to know the logger's unit.
            bestSet: bestSet ? formatBestSet(bestSet, trackingType, { showUnit: true }) : '',
            exerciseId: ex.id,
            percentile,
            allSets,
            trackingType,
          };
        })
      );

      const exerciseSummaries = exerciseSummariesRaw.filter(
        (ex): ex is NonNullable<typeof ex> => ex !== null
      ) as WorkoutExerciseSummary[];

      const totalSets = workout.exercises.reduce(
        (sum, ex) => sum + ex.completedSets.filter(s => s.completed).length,
        0
      );
      const totalVolume = workout.exercises.reduce((sum, ex) => {
        return sum + ex.completedSets
          .filter(s => s.completed)
          .reduce((setSum, set) => setSum + setVolumeLbs(set), 0);
      }, 0);

      // Cardio totals: read trackingType off the exercise summaries.
      let totalDistanceMeters = 0;
      let totalCardioSeconds = 0;
      workout.exercises.forEach((ex, index) => {
        const trackingType = exerciseSummaries[index]?.trackingType || 'reps';
        if (trackingType === 'cardio') {
          ex.completedSets.filter(s => s.completed).forEach(set => {
            totalDistanceMeters += set.distance || 0;
            totalCardioSeconds += set.duration || 0;
          });
        }
      });

      const percentileData = await this.getUserPercentileData(user.id);
      // Achievements this workout earned, via the same history replay the History
      // tab uses (so feed and log agree). Ids only — clients bundle art/copy.
      let achievementIds: string[] = [];
      try {
        const history = await storageService.getWorkoutHistory();
        const withThis = history.some(w => w.id === workout.id) ? history : [...history, workout];
        const unit = userProfile.weightUnitPreference || 'lbs';
        achievementIds = (attributeAchievements(withThis, unit)[workout.id] ?? []).map(a => a.id);
      } catch (err) {
        console.error('Error attributing achievements for feed:', err);
      }
      const feedData: WorkoutFeedData = {
        strength_level: percentileData?.strength_level,
        pr_count: prCount,
        achievement_ids: achievementIds.length > 0 ? achievementIds : undefined,
      };

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
          total_distance_meters: Math.round(totalDistanceMeters),
          total_cardio_seconds: Math.round(totalCardioSeconds),
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

      // Also push to the feed server with the gamification snapshot the cards render.
      feedService.saveWorkoutToFeed({
        title: workout.title,
        duration_seconds: durationSeconds,
        exercise_count: exerciseSummaries.length,
        set_count: totalSets,
        total_volume: Math.round(totalVolume),
        total_distance_meters: Math.round(totalDistanceMeters),
        total_cardio_seconds: Math.round(totalCardioSeconds),
        exercises: exerciseSummaries,
      }, feedData).catch(err => {
        console.error('Error syncing workout to feed server:', err);
        analyticsService.logErr('sync', 'feed_workout_sync_failed', err instanceof Error ? err.message : 'Unknown error');
      });

      return true;
    } catch (error) {
      console.error('Error syncing workout:', error);
      analyticsService.logErr('sync', 'workout_sync_error', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

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

  /** Historical lift data for progression charts. */
  async getUserLiftHistory(userId: string, exerciseId: string): Promise<{ estimated_1rm: number; recorded_at: Date }[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('user_lifts')
        .select('estimated_1rm, recorded_at')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .order('recorded_at', { ascending: true });

      if (error) {
        console.error('Error fetching lift history:', error);
        return [];
      }

      return (data || []).map(lift => ({
        estimated_1rm: lift.estimated_1rm,
        recorded_at: new Date(lift.recorded_at),
      }));
    } catch (error) {
      console.error('Error fetching lift history:', error);
      return [];
    }
  }

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

}

export const userSyncService = new UserSyncService();
