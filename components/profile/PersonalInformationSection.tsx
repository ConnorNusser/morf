import Button from '@/components/Button';
import Card from '@/components/Card';
import { useAlert } from '@/components/CustomAlert';
import GenderInput from '@/components/inputs/GenderInput';
import HeightInput from '@/components/inputs/HeightInput';
import WeightInput from '@/components/inputs/WeightInput';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { UserProfile } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface PersonalInformationSectionProps {
  userProfile: UserProfile | null;
  onProfileUpdate: () => Promise<void>;
}

export default function PersonalInformationSection({
  userProfile,
  onProfileUpdate: _onProfileUpdate
}: PersonalInformationSectionProps) {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const { updateProfile } = useUser();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localProfile, setLocalProfile] = useState(userProfile);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const getPersonalInfoSummary = () => {
    if (!localProfile) return '';
    
    const heightStr = localProfile.height?.unit === 'feet' 
      ? `${Math.floor(localProfile.height.value)}'${Math.round((localProfile.height.value % 1) * 12)}"`
      : `${localProfile.height?.value || 180}cm`;
    
    const weightStr = `${localProfile.weight?.value || 185}${localProfile.weight?.unit || 'lbs'}`;
    const gender = localProfile.gender ? localProfile.gender.charAt(0).toUpperCase() + localProfile.gender.slice(1) : 'Not set';
    
    return `${gender} • ${heightStr} • ${weightStr}`;
  };

  const handleSaveChanges = async () => {
    if (!localProfile) return;
    await updateProfile({
      ...localProfile,
      age: localProfile.age || 28,
    });
    showAlert({
      title: 'Changes Saved',
      message: 'Your profile has been updated',
      type: 'success',
    });
  };

  const handleHeightChange = async (height: UserProfile['height']) => {
    if (!localProfile) return;
    const updatedProfile = { ...localProfile, height };
    setLocalProfile(updatedProfile);
  };

  const handleWeightChange = async (weight: UserProfile['weight']) => {
    if (!localProfile) return;
    const updatedProfile = { ...localProfile, weight };
    setLocalProfile(updatedProfile);
  };

  const handleGenderChange = async (gender: UserProfile['gender']) => {
    if (!localProfile) return;
    const updatedProfile = { ...localProfile, gender };
    setLocalProfile(updatedProfile);
  };

  React.useEffect(() => {
    setLocalProfile(userProfile);
  }, [userProfile]);

  return (
    <Card style={styles.profileCard} variant="clean">
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionHeaderContent, { backgroundColor: 'transparent' }]}>
          <Text style={[
            styles.sectionTitle, 
            { 
              color: currentTheme.colors.text,
            }
          ]}>
            Personal Information
          </Text>
          {!isExpanded && (
            <Text style={[
              styles.personalInfoSubtitle, 
              { 
                color: currentTheme.colors.primary,
              }
            ]}>
              {getPersonalInfoSummary()}
            </Text>
          )}
        </View>
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={currentTheme.colors.text} 
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.profileInputs}>
          <HeightInput
            value={localProfile?.height ?? { value: 5.9, unit: 'feet' }}
            onChange={handleHeightChange}
          />

          <WeightInput
            value={localProfile?.weight ?? { value: 185, unit: 'lbs' }}
            onChange={handleWeightChange}
          />

          <GenderInput
            value={localProfile?.gender ?? 'male'}
            onChange={handleGenderChange}
          />
          <Button
            title="Save Changes"
            onPress={handleSaveChanges}
            variant="primary"
            size="large"
            hapticType="heavy"
            soundName="notification"
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  personalInfoSubtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  profileInputs: {
    paddingTop: 16,
    gap: 16,
  },
}); 