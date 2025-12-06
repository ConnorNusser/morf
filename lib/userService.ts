import {
  ALL_FEATURED_SECONDARY_LIFTS,
  FeaturedLiftType,
  FeaturedSecondaryLiftType,
  isFeaturedSecondaryLift,
  isMainLift,
  MAIN_LIFTS,
  MainLiftType,
  UserLift,
  UserProfile,
  UserProgress
} from '@/types';
import { storageService } from './storage';
import { calculateStrengthPercentile, getStrengthLevelName, OneRMCalculator } from './strengthStandards';
import { convertWeightToLbs } from './utils';
class UserService {
  // Initialize new user with profile or update existing profile
  async createUserProfile(profile: Omit<UserProfile, 'age'> & { age: number }): Promise<void> {
    const existingProfile = await this.getRealUserProfile();
    const realProfile: UserProfile = {
      ...profile,
      // Preserve existing lifts when updating profile
      lifts: profile.lifts || existingProfile?.lifts || [],
      secondaryLifts: profile.secondaryLifts || existingProfile?.secondaryLifts || [],
      weightUnitPreference: profile.weightUnitPreference || existingProfile?.weightUnitPreference || 'lbs',
    };
    
    await storageService.saveUserProfile(realProfile);
  }

  // Add or update a user's lift
  async recordLift(lift: Omit<UserLift, 'dateRecorded'>, liftType: 'main' | 'secondary'): Promise<void> {
    const profile = await this.getRealUserProfile();
    if (!profile) throw new Error('No user profile found');

    const weightInLbs = convertWeightToLbs(lift.weight, lift.unit);

    if (liftType === 'main') {
      profile.lifts.push({
      ...lift,
      weight: weightInLbs,
      unit: 'lbs',
      dateRecorded: new Date(),
    });
    } else {
      profile.secondaryLifts.push({
        ...lift,
        weight: weightInLbs,
        unit: 'lbs',
        dateRecorded: new Date(),
      });
    }

    await storageService.saveUserProfile(profile);
  }

  // Calculate real user progress from recorded lifts
  async calculateRealUserProgress(): Promise<UserProgress[]> {
    const profile = await this.getRealUserProfile();
    if (!profile) return [];

    const bodyWeightInLbs = convertWeightToLbs(profile.weight.value, profile.weight.unit);

    const allLifts: Record<string, UserProgress> = {};

    for (const lift of profile.lifts) {
      // Skip lifts with zero weight to avoid meaningless progress calculations
      if (lift.weight <= 0) continue;
      
      let maxEstimatedLift = OneRMCalculator.estimate(lift.weight, lift.reps);
      const percentile = calculateStrengthPercentile(
        maxEstimatedLift,
        bodyWeightInLbs,
        profile.gender,
        lift.id,
        profile.age
      );
      if (lift.id in allLifts && maxEstimatedLift > allLifts[lift.id].personalRecord) {
        allLifts[lift.id] = {
          workoutId: lift.id,
          personalRecord: maxEstimatedLift,
          lastUpdated: lift.dateRecorded,
          percentileRanking: Math.round(percentile),
          strengthLevel: getStrengthLevelName(percentile),
        }
        
      } else {
        allLifts[lift.id] = {
          workoutId: lift.id,
          personalRecord: maxEstimatedLift,
          lastUpdated: lift.dateRecorded,
          percentileRanking: Math.round(percentile),
          strengthLevel: getStrengthLevelName(percentile),
        }
      }
    }

    return Object.values(allLifts);
  }

  async getUsersTopLifts(): Promise<UserProgress[]> {
    const profile = await this.getRealUserProfile();
    const topLifts: Record<MainLiftType, UserLift> = {
      "squat-barbell": {
        parentId: '',
        id: 'squat-barbell',
        weight: 0,
        reps: 0,
        dateRecorded: new Date(),
        unit: 'lbs',
      },
      "bench-press-barbell": {
        parentId: '',
        id: 'bench-press-barbell',
        weight: 0,
        reps: 0,
        unit: 'lbs',
        dateRecorded: new Date(),
      },
      "deadlift-barbell": {
        parentId: '',
        id: 'deadlift-barbell',
        weight: 0,
        reps: 0,
        unit: 'lbs',
        dateRecorded: new Date(),
      },
      "overhead-press-barbell": {
        parentId: '',
        id: 'overhead-press-barbell',
        weight: 0,
        reps: 0,
        unit: 'lbs',
        dateRecorded: new Date(),
      },
    };

    for (const lift of profile?.lifts || []) {
      // Skip lifts with zero weight to avoid meaningless records
      if (lift.weight <= 0) continue;
      
      if (lift.id in topLifts && OneRMCalculator.estimate(lift.weight, lift.reps) > OneRMCalculator.estimate(topLifts[lift.id as MainLiftType].weight, topLifts[lift.id as MainLiftType].reps)) {
        topLifts[lift.id as MainLiftType] = lift;
      }
    }


    const bodyWeightInLbs = convertWeightToLbs(profile?.weight.value || 0, profile?.weight.unit || 'lbs');

    return Object.values(topLifts).map(lift => {
      const maxEstimatedLift = OneRMCalculator.estimate(lift.weight, lift.reps);
      const percentile = calculateStrengthPercentile(
        maxEstimatedLift,
        bodyWeightInLbs,
        profile?.gender || 'male',
        lift.id,
        profile?.age || 20
      );
      return {
        workoutId: lift.id,
        personalRecord: maxEstimatedLift,
        lastUpdated: lift.dateRecorded,
        percentileRanking: Math.round(percentile),
        strengthLevel: getStrengthLevelName(percentile),
      };
    });
  }

  // Get user's top featured secondary lifts
  async getUsersTopFeaturedSecondaryLifts(): Promise<UserProgress[]> {
    const profile = await this.getRealUserProfile();
    if (!profile) return [];

    const bodyWeightInLbs = convertWeightToLbs(profile.weight.value, profile.weight.unit);
    const topSecondaryLifts: Partial<Record<FeaturedSecondaryLiftType, UserLift>> = {};

    // Initialize all featured secondary lifts with zero values
    for (const liftId of ALL_FEATURED_SECONDARY_LIFTS) {
      topSecondaryLifts[liftId] = {
        parentId: '',
        id: liftId,
        weight: 0,
        reps: 0,
        unit: 'lbs',
        dateRecorded: new Date(),
      };
    }

    // Find the best lift for each featured secondary exercise
    for (const lift of profile.secondaryLifts || []) {
      if (lift.weight <= 0) continue;
      
      if (isFeaturedSecondaryLift(lift.id)) {
        const currentBest = topSecondaryLifts[lift.id];
        if (currentBest && OneRMCalculator.estimate(lift.weight, lift.reps) > OneRMCalculator.estimate(currentBest.weight, currentBest.reps)) {
          topSecondaryLifts[lift.id] = lift;
        }
      }
    }

    // Convert to UserProgress array, only including lifts with recorded data
    return Object.values(topSecondaryLifts)
      .filter(lift => lift.weight > 0)
      .map(lift => {
        const maxEstimatedLift = OneRMCalculator.estimate(lift.weight, lift.reps);
        const percentile = calculateStrengthPercentile(
          maxEstimatedLift,
          bodyWeightInLbs,
          profile.gender,
          lift.id,
          profile.age || 20
        );
        return {
          workoutId: lift.id,
          personalRecord: maxEstimatedLift,
          lastUpdated: lift.dateRecorded,
          percentileRanking: Math.round(percentile),
          strengthLevel: getStrengthLevelName(percentile),
        };
      });
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

  async getTopLiftById(liftId: MainLiftType | string): Promise<UserProgress | undefined> {
    if (isMainLift(liftId)) {
      const lift = await this.getUsersTopLifts().then(lifts => lifts.find(lift => lift.workoutId === liftId));
      return lift ?? undefined;
    }
    const profile = await this.getRealUserProfile();
    const bodyWeightInLbs = convertWeightToLbs(profile?.weight.value || 0, profile?.weight.unit || 'lbs');
    const lift = profile?.secondaryLifts.filter(lift => lift.id === liftId && lift.weight > 0)
      .sort((a, b) => OneRMCalculator.estimate(b.weight, b.reps) - OneRMCalculator.estimate(a.weight, a.reps))[0];
    
    if (lift) {
      const percentile = calculateStrengthPercentile(
        OneRMCalculator.estimate(lift.weight, lift.reps),
        bodyWeightInLbs,
        profile?.gender || 'male',
        lift.id,
        profile?.age || 20
      );
      return {
        workoutId: lift.id,
        personalRecord: OneRMCalculator.estimate(lift.weight, lift.reps),
        lastUpdated: lift.dateRecorded,
        percentileRanking: Math.round(percentile),
        strengthLevel: getStrengthLevelName(percentile),
      };
    }
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
        lifts: [],
        secondaryLifts: [],
        weightUnitPreference: 'lbs' as const,
      };
      
      await this.createUserProfile(defaultProfile);
      return { ...defaultProfile } as UserProfile;
    }
    
    return profile;
  }

  // Get user's current lifts
  async getUserLifts(): Promise<UserLift[]> {
    const profile = await this.getRealUserProfile();
    return profile?.lifts || [];
  }

  // Get all lifts for a specific main lift ID as UserProgress array
  async getAllLiftsById(liftId: MainLiftType): Promise<UserProgress[] | undefined> {
    const profile = await this.getRealUserProfile();
    if (!profile) return undefined;
    
    const bodyWeightInLbs = convertWeightToLbs(profile.weight.value, profile.weight.unit);
    const mainLifts = profile.lifts.filter(lift => lift.id === liftId && lift.weight > 0);
    
    if (mainLifts.length === 0) return undefined;
    
    return mainLifts
      .sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime())
      .map(lift => {
        const maxEstimatedLift = OneRMCalculator.estimate(lift.weight, lift.reps);
        const percentile = calculateStrengthPercentile(
          maxEstimatedLift,
          bodyWeightInLbs,
          profile.gender,
          lift.id,
          profile.age
        );
        return {
          workoutId: lift.id,
          personalRecord: maxEstimatedLift,
          lastUpdated: lift.dateRecorded,
          percentileRanking: Math.round(percentile),
          strengthLevel: getStrengthLevelName(percentile),
        };
      });
  }

  // Get all lifts for any featured lift ID (main or secondary) as UserProgress array
  async getAllLiftsForFeaturedExercise(liftId: FeaturedLiftType): Promise<UserProgress[] | undefined> {
    const profile = await this.getRealUserProfile();
    if (!profile) return undefined;
    
    const bodyWeightInLbs = convertWeightToLbs(profile.weight.value, profile.weight.unit);
    let lifts: UserLift[] = [];

    if (isMainLift(liftId)) {
      lifts = profile.lifts.filter(lift => lift.id === liftId && lift.weight > 0);
    } else if (isFeaturedSecondaryLift(liftId)) {
      lifts = profile.secondaryLifts.filter(lift => lift.id === liftId && lift.weight > 0);
    }
    
    if (lifts.length === 0) return undefined;
    
    return lifts
      .sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime())
      .map(lift => {
        const maxEstimatedLift = OneRMCalculator.estimate(lift.weight, lift.reps);
        const percentile = calculateStrengthPercentile(
          maxEstimatedLift,
          bodyWeightInLbs,
          profile.gender,
          lift.id,
          profile.age
        );
        return {
          workoutId: lift.id,
          personalRecord: maxEstimatedLift,
          lastUpdated: lift.dateRecorded,
          percentileRanking: Math.round(percentile),
          strengthLevel: getStrengthLevelName(percentile),
        };
      });
  }

  // Get raw lift data for detailed history display
  async getRawLiftsById(liftId: MainLiftType): Promise<UserLift[] | undefined> {
    const profile = await this.getRealUserProfile();
    if (!profile) return undefined;
    
    const mainLifts = profile.lifts.filter(lift => lift.id === liftId);
    
    if (mainLifts.length === 0) return undefined;
    
    return mainLifts.sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime());
  }

  // Get raw lift data for any featured lift (main or secondary)
  async getRawLiftsForFeaturedExercise(liftId: FeaturedLiftType): Promise<UserLift[] | undefined> {
    const profile = await this.getRealUserProfile();
    if (!profile) return undefined;
    
    let lifts: UserLift[] = [];

    if (isMainLift(liftId)) {
      lifts = profile.lifts.filter(lift => lift.id === liftId);
    } else if (isFeaturedSecondaryLift(liftId)) {
      lifts = profile.secondaryLifts.filter(lift => lift.id === liftId);
    }
    
    if (lifts.length === 0) return undefined;
    
    return lifts.sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime());
  }

  // Check if user needs to record lifts for main exercises
  async getMissingMainLifts(): Promise<string[]> {
    const lifts = await this.getUserLifts();
    const mainLifts: MainLiftType[] = Object.values(MAIN_LIFTS);
    const recordedLifts = lifts.map(l => l.id);
    
    return mainLifts.filter(lift => !recordedLifts.includes(lift));
  }

  // Delete a workout and all associated lifts with matching parentId
  async deleteWorkoutAndLifts(workoutId: string): Promise<void> {
    try {
      // Delete the workout from storage
      await storageService.deleteWorkout(workoutId);
      
      // Get current user profile
      const profile = await this.getRealUserProfile();
      if (!profile) return;
      
      // Filter out lifts with matching parentId from main lifts
      const filteredMainLifts = profile.lifts.filter(lift => lift.parentId !== workoutId);
      
      // Filter out lifts with matching parentId from secondary lifts
      const filteredSecondaryLifts = profile.secondaryLifts.filter(lift => lift.parentId !== workoutId);
      
      // Update the profile with filtered lifts
      const updatedProfile = {
        ...profile,
        lifts: filteredMainLifts,
        secondaryLifts: filteredSecondaryLifts,
      };
      
      // Save the updated profile
      await storageService.saveUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error deleting workout and associated lifts:', error);
      throw error;
    }
  }
}

export const userService = new UserService(); 