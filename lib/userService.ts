import {
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
      "squat": {
        parentId: '',
        id: 'squat',
        weight: 0,
        reps: 0,
        dateRecorded: new Date(),
        unit: 'lbs',
      },
      "bench-press": {
        parentId: '',
        id: 'bench-press',
        weight: 0,
        reps: 0,
        unit: 'lbs',
        dateRecorded: new Date(),
      },
      "deadlift": {
        parentId: '',
        id: 'deadlift',
        weight: 0,
        reps: 0,
        unit: 'lbs',
        dateRecorded: new Date(),
      },
      "overhead-press": {
        parentId: '',
        id: 'overhead-press',
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

  // Get raw lift data for detailed history display
  async getRawLiftsById(liftId: MainLiftType): Promise<UserLift[] | undefined> {
    const profile = await this.getRealUserProfile();
    if (!profile) return undefined;
    
    const mainLifts = profile.lifts.filter(lift => lift.id === liftId);
    
    if (mainLifts.length === 0) return undefined;
    
    return mainLifts.sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime());
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