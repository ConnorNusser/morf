import {
  ALL_FEATURED_SECONDARY_LIFTS,
  ExerciseRecord,
  FeaturedLiftType,
  FeaturedSecondaryLiftType,
  Gender,
  isFeaturedSecondaryLift,
  isMainLift,
  MAIN_LIFTS,
  MainLiftType,
  UserLift,
  UserProfile,
  UserProgress
} from '@/types';
import { storageService } from '@/lib/storage/storage';
import { calculateStrengthPercentile, getStrengthLevelName, OneRMCalculator } from '@/lib/data/strengthStandards';
import { userSyncService } from './userSyncService';
import { convertWeightToLbs } from '@/lib/utils/utils';
class UserService {
  // Initialize new user with profile or update existing profile
  async createUserProfile(profile: Omit<UserProfile, 'age'> & { age: number }): Promise<void> {
    const existingProfile = await this.getRealUserProfile();
    const realProfile: UserProfile = {
      ...profile,
      weightUnitPreference: profile.weightUnitPreference || existingProfile?.weightUnitPreference || 'lbs',
    };
    
    await storageService.saveUserProfile(realProfile);
  }


  // Real user progress = every rankable (main) exercise record, best-e1RM → percentile.
  async calculateRealUserProgress(): Promise<UserProgress[]> {
    const [profile, records] = await Promise.all([this.getRealUserProfile(), storageService.getExerciseRecords()]);
    if (!profile) return [];

    const bodyWeightLbs = convertWeightToLbs(profile.weight.value, profile.weight.unit);
    return Object.values(records)
      .filter(r => r.isMainLift && r.bestE1RMLbs > 0)
      .map(r => this.progressFromRecord(r.exerciseId, r, bodyWeightLbs, profile.gender, profile.age || 20));
  }

  // Build a UserProgress from an exercise record's best estimated 1RM (the single
  // source of "your best"). Zero PR → percentile 0, matching the old zero-lift path.
  private progressFromRecord(
    exerciseId: string,
    record: ExerciseRecord | undefined,
    bodyWeightLbs: number,
    gender: Gender,
    age: number
  ): UserProgress {
    const pr = Math.round(record?.bestE1RMLbs ?? 0);
    const percentile = calculateStrengthPercentile(pr, bodyWeightLbs, gender, exerciseId, age);
    return {
      workoutId: exerciseId,
      personalRecord: pr,
      lastUpdated: record?.bestE1RMAt ?? record?.updatedAt ?? new Date(),
      percentileRanking: Math.floor(percentile),
      strengthLevel: getStrengthLevelName(percentile),
    };
  }

  async getUsersTopLifts(): Promise<UserProgress[]> {
    const [profile, records] = await Promise.all([this.getRealUserProfile(), storageService.getExerciseRecords()]);
    const bodyWeightLbs = convertWeightToLbs(profile?.weight.value || 0, profile?.weight.unit || 'lbs');
    const gender = profile?.gender || 'male';
    const age = profile?.age || 20;
    // All four main lifts, including zeros for ones not yet trained.
    return (Object.values(MAIN_LIFTS) as MainLiftType[]).map(id =>
      this.progressFromRecord(id, records[id], bodyWeightLbs, gender, age)
    );
  }

  // Get user's top featured secondary lifts (only those with recorded data).
  async getUsersTopFeaturedSecondaryLifts(): Promise<UserProgress[]> {
    const [profile, records] = await Promise.all([this.getRealUserProfile(), storageService.getExerciseRecords()]);
    if (!profile) return [];

    const bodyWeightLbs = convertWeightToLbs(profile.weight.value, profile.weight.unit);
    return ALL_FEATURED_SECONDARY_LIFTS
      .filter(id => (records[id]?.bestE1RMLbs ?? 0) > 0)
      .map(id => this.progressFromRecord(id, records[id], bodyWeightLbs, profile.gender, profile.age || 20));
  }

  // Get all featured lifts (main + secondary) for dashboard display
  async getAllFeaturedLifts(): Promise<UserProgress[]> {
    const [mainLifts, secondaryLifts] = await Promise.all([
      this.getUsersTopLifts(),
      this.getUsersTopFeaturedSecondaryLifts()
    ]);

    // Preferred lift order for dashboard (first 5 lifts)
    const preferredOrder: string[] = [
      'bench-press-barbell',
      'squat-barbell',
      'deadlift-barbell',
      'overhead-press-barbell',
      'hip-thrust-barbell',
    ];

    // Combine all lifts
    const allLifts = [...mainLifts, ...secondaryLifts];

    // Sort: preferred lifts first (in order), then rest by percentile
    return allLifts.sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a.workoutId);
      const bIndex = preferredOrder.indexOf(b.workoutId);

      // Both are preferred lifts - sort by preferred order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      // Only a is preferred - a comes first
      if (aIndex !== -1) return -1;
      // Only b is preferred - b comes first
      if (bIndex !== -1) return 1;
      // Neither preferred - sort by percentile (highest first)
      return b.percentileRanking - a.percentileRanking;
    });
  }

  // Removed isSetupComplete functionality - profiles are always considered setup

  // Get user profile (cast to UserProfile if it exists)
  async getRealUserProfile(): Promise<UserProfile | null> {
    const profile = await storageService.getUserProfile();
    if (!profile) return null;
    return profile as UserProfile;
  }

  // Get user profile with automatic default creation
  async getUserProfileOrDefault(): Promise<UserProfile> {
    const profile = await this.getRealUserProfile();
    
    if (!profile) {
      // Create default profile if none exists
      const defaultProfile = {
        height: { value: 5.9, unit: 'feet' as const },
        weight: { value: 185, unit: 'lbs' as const },
        gender: 'male' as const,
        age: 28,
        weightUnitPreference: 'lbs' as const,
      };
      
      await this.createUserProfile(defaultProfile);
      return { ...defaultProfile } as UserProfile;
    }
    
    return profile;
  }

  // Get all lifts for any featured lift ID (main or secondary) as UserProgress array
  async getAllLiftsForFeaturedExercise(liftId: FeaturedLiftType): Promise<UserProgress[] | undefined> {
    const [profile, raw] = await Promise.all([this.getRealUserProfile(), this.getRawLiftsForFeaturedExercise(liftId)]);
    if (!profile || !raw) return undefined;

    const bodyWeightLbs = convertWeightToLbs(profile.weight.value, profile.weight.unit);
    return raw.map(lift => {
      const e1rm = OneRMCalculator.estimate(lift.weight, lift.reps);
      const percentile = calculateStrengthPercentile(e1rm, bodyWeightLbs, profile.gender, lift.id, profile.age);
      return {
        workoutId: lift.id,
        personalRecord: e1rm,
        lastUpdated: lift.dateRecorded,
        percentileRanking: Math.floor(percentile),
        strengthLevel: getStrengthLevelName(percentile),
      };
    });
  }

  // Per-session history for a lift, derived from workout history (one point per
  // workout = that session's best set, normalized to lbs). Replaces the old
  // profile.lifts store, which just duplicated workout history.
  async getRawLiftsForFeaturedExercise(liftId: FeaturedLiftType): Promise<UserLift[] | undefined> {
    const history = await storageService.getWorkoutHistory();
    const lifts: UserLift[] = [];
    for (const w of history) {
      const ex = w.exercises.find(e => e.id === liftId);
      const done = ex?.completedSets?.filter(s => s.completed && s.weight > 0) ?? [];
      if (done.length === 0) continue;
      const best = done.reduce((a, b) =>
        OneRMCalculator.estimate(b.weight, b.reps) > OneRMCalculator.estimate(a.weight, a.reps) ? b : a
      );
      lifts.push({
        parentId: w.id,
        id: liftId,
        weight: best.unit === 'lbs' ? best.weight : convertWeightToLbs(best.weight, best.unit),
        reps: best.reps,
        unit: 'lbs',
        dateRecorded: new Date(w.createdAt),
      });
    }
    if (lifts.length === 0) return undefined;
    return lifts.sort((a, b) => a.dateRecorded.getTime() - b.dateRecorded.getTime());
  }

  // Delete a workout and all associated lifts with matching parentId
  async deleteWorkoutAndLifts(workoutId: string): Promise<void> {
    try {
      // Delete the workout from local storage (the source of exercise records +
      // rank history now — no separate lift store to prune).
      await storageService.deleteWorkout(workoutId);

      // Delete the workout from Supabase (for feed/social features)
      await userSyncService.deleteWorkout(workoutId);
    } catch (error) {
      console.error('Error deleting workout and associated lifts:', error);
      throw error;
    }
  }
}

export const userService = new UserService(); 