import { userService } from '@/lib/services/userService';
import { userSyncService } from '@/lib/services/userSyncService';
import { UserProfile } from '@/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface UserContextType {
  userProfile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (profile: Omit<UserProfile, 'age'> & { age: number }) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const profile = await userService.getRealUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (profile: Omit<UserProfile, 'age'> & { age: number }) => {
    try {
      await userService.createUserProfile(profile);
      // Set the profile directly instead of refreshing to avoid unnecessary re-renders
      setUserProfile(profile as UserProfile);

      // Sync profile data to Supabase (fire and forget)
      userSyncService.syncProfileData({
        height: profile.height,
        weight: profile.weight,
        gender: profile.gender,
      }).catch(err => console.error('Error syncing profile to Supabase:', err));
    } catch (error) {
      console.error('Error updating user profile:', error);
      // If update failed, refresh to ensure we have correct state
      await refreshProfile();
      throw error;
    }
  }, [refreshProfile]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const value: UserContextType = useMemo(() => ({
    userProfile,
    isLoading,
    refreshProfile,
    updateProfile,
  }), [userProfile, isLoading, refreshProfile, updateProfile]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
} 