import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { analyticsService } from '@/lib/services/analytics';
import playHapticFeedback from '@/lib/utils/haptic';
import { userService } from '@/lib/services/userService';
import { userSyncService } from '@/lib/services/userSyncService';
import { tierEmblemFor } from '@/lib/gamification/tierEmblems';
import { Equipment, Gender, HeightUnit, WeightUnit } from '@/types';
import { ALL_EQUIPMENT } from '@/lib/workout/equipment';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import EquipmentFilterInput from './inputs/EquipmentFilterInput';
import GenderInput from './inputs/GenderInput';
import HeightInput from './inputs/HeightInput';
import WeightInput from './inputs/WeightInput';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [height, setHeight] = useState<{ value: number; unit: HeightUnit }>({ value: 5.9, unit: 'feet' });
  const [weight, setWeight] = useState<{ value: number; unit: WeightUnit }>({ value: 185, unit: 'lbs' });
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState<number>(28);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>(ALL_EQUIPMENT);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  const { currentTheme } = useTheme();
  const { play: playSound } = useSound('pop');
  const { play: playUnlock } = useSound('unlock');

  const totalSteps = 7;

  const handleNext = () => {
    playHapticFeedback('selection', false);
    playSound();
    setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
  };

  const handleBack = () => {
    playHapticFeedback('selection', false);
    playSound();
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const canProceedFromStep = () => {
    switch (currentStep) {
      case 0: return true;
      case 1: return height.value > 0;
      case 2: return weight.value > 0;
      case 3: return true;
      case 4: return age > 0 && age < 120;
      case 5: return availableEquipment.length > 0;
      case 6: return true;
      default: return false;
    }
  };

  const handleComplete = async () => {
    setIsCreatingProfile(true);
    playHapticFeedback('medium', false);
    playUnlock();

    try {
      await userService.createUserProfile({
        height,
        weight,
        gender,
        age,
        weightUnitPreference: weight.unit,
        equipmentFilter: {
          mode: availableEquipment.length === ALL_EQUIPMENT.length ? 'all' : 'custom',
          includedEquipment: availableEquipment,
        },
      });

      // Sync to Supabase, fire and forget.
      userSyncService.syncProfileData({
        height,
        weight,
        gender,
      }).catch(err => console.error('Error syncing profile to Supabase:', err));

      analyticsService.logInfo('auth', 'onboarding_completed', 'User completed onboarding', {
        heightUnit: height.unit,
        weightUnit: weight.unit,
        gender,
        age,
        equipmentCount: availableEquipment.length,
      });

      onComplete();
    } catch (error) {
      console.error('Failed to create profile:', error);
      analyticsService.logErr('auth', 'onboarding_failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Image
              source={require('@/assets/images/icon-original.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.welcomeTitle, { 
              color: currentTheme.colors.text,
            }]}>
              Welcome to Morf
            </Text>
            <Text style={[styles.welcomeSubtitle, { 
              color: currentTheme.colors.text + '90',
            }]}>
              Log your lifts, get graded against real strength standards, and
              climb the tiers.
            </Text>
            {/* The climb, in the app's own pixel language: E up to S. */}
            <View style={styles.tierLadderRow}>
              {(['E', 'D', 'C', 'B', 'A', 'S'] as const).map((t, i) => (
                <Image
                  key={t}
                  source={tierEmblemFor(t)}
                  style={[styles.tierLadderEmblem, { width: 30 + i * 4, height: 30 + i * 4 }]}
                  resizeMode="contain"
                />
              ))}
            </View>
            <Text style={[styles.stepIndicator, { 
              color: currentTheme.colors.text + '60',
            }]}>
              Setup takes about a minute · no account needed
            </Text>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { 
              color: currentTheme.colors.text,
            }]}>{"What's your height?"}</Text>
            <Text style={[styles.stepSubtitle, { 
              color: currentTheme.colors.text + '80',
            }]}>
              Rounds out your strength profile.
            </Text>
            <View style={styles.inputWrapper}>
              <HeightInput value={height} onChange={setHeight} style={styles.inputComponent} />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { 
              color: currentTheme.colors.text,
            }]}>{"What's your weight?"}</Text>
            <Text style={[styles.stepSubtitle, { 
              color: currentTheme.colors.text + '80',
            }]}>
              Your lifts are graded relative to bodyweight — this one matters most.
            </Text>
            <View style={styles.inputWrapper}>
              <WeightInput value={weight} onChange={setWeight} style={styles.inputComponent} />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { 
              color: currentTheme.colors.text,
            }]}>{"What's your gender?"}</Text>
            <Text style={[styles.stepSubtitle, { 
              color: currentTheme.colors.text + '80',
            }]}>
              {"Strength curves differ — you'll be graded against the right one."}
            </Text>
            <View style={styles.inputWrapper}>
              <GenderInput value={gender} onChange={setGender} style={styles.inputComponent} />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { 
              color: currentTheme.colors.text,
            }]}>{"What's your age?"}</Text>
            <Text style={[styles.stepSubtitle, { 
              color: currentTheme.colors.text + '80',
            }]}>
              {"Standards shift with age — you're graded against your bracket."}
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.ageInput, 
                  { 
                    color: currentTheme.colors.text,
                    borderColor: currentTheme.colors.border,
                    backgroundColor: currentTheme.colors.surface,
                  }
                ]}
                keyboardType="numeric"
                value={age.toString()}
                onChangeText={(text) => {
                  const numericAge = parseInt(text) || 0;
                  setAge(numericAge);
                }}
                placeholder="28"
                placeholderTextColor={currentTheme.colors.text + '60'}
                maxLength={3}
              />
            </View>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, {
              color: currentTheme.colors.text,
            }]}>What equipment do you have?</Text>
            <Text style={[styles.stepSubtitle, {
              color: currentTheme.colors.text + '80',
            }]}>
              So generated workouts only use gear you can actually reach.
            </Text>
            <View style={styles.inputWrapper}>
              <EquipmentFilterInput
                value={availableEquipment}
                onChange={setAvailableEquipment}
                style={styles.inputComponent}
              />
            </View>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContent}>
            <Image source={tierEmblemFor('E')} style={styles.payoffEmblem} resizeMode="contain" />
            <Text style={[styles.stepTitle, {
              color: currentTheme.colors.text,
            }]}>You start at E</Text>
            <Text style={[styles.stepSubtitle, {
              color: currentTheme.colors.text + '80',
            }]}>
              Everyone does. Log your first workout and your lifts get graded
              against real strength standards — then the climb begins.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { backgroundColor: currentTheme.colors.border }]}>
        <View 
          style={[
            styles.progressFill, 
            { 
              backgroundColor: currentTheme.colors.primary,
              width: `${((currentStep + 1) / totalSteps) * 100}%`
            }
          ]} 
        />
      </View>
      <Text style={[styles.progressText, { 
        color: currentTheme.colors.text + '70',
      }]}>
        {currentStep + 1} of {totalSteps}
      </Text>
    </View>
  );

  const renderNavigationButtons = () => (
    <View style={[styles.navigationContainer, { backgroundColor: currentTheme.colors.background }]}>
      <TouchableOpacity
        style={[
          styles.backButton,
          currentStep === 0 && styles.hiddenButton
        ]}
        onPress={handleBack}
        disabled={currentStep === 0}
        activeOpacity={0.7}
      >
        {currentStep > 0 && (
          <>
            <Ionicons name="chevron-back" size={20} color={currentTheme.colors.text} />
            <Text style={[styles.backButtonText, { 
              color: currentTheme.colors.text,
            }]}>Back</Text>
          </>
        )}
      </TouchableOpacity>

      {currentStep < totalSteps - 1 ? (
        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: currentTheme.colors.primary },
            !canProceedFromStep() && { 
              backgroundColor: currentTheme.colors.border,
              opacity: 0.5,
            }
          ]}
          onPress={handleNext}
          disabled={!canProceedFromStep()}
          activeOpacity={0.8}
        >
          <Text style={[styles.nextButtonText, { 
            color: currentTheme.colors.background,
          }]}>Next</Text>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.background} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: currentTheme.colors.primary },
            (!canProceedFromStep() || isCreatingProfile) && { 
              backgroundColor: currentTheme.colors.border,
              opacity: 0.5,
            }
          ]}
          onPress={handleComplete}
          disabled={!canProceedFromStep() || isCreatingProfile}
          activeOpacity={0.8}
        >
          {isCreatingProfile ? (
            <ActivityIndicator size="small" color={currentTheme.colors.background} />
          ) : (
            <>
              <Text style={[styles.nextButtonText, { 
                color: currentTheme.colors.background,
              }]}>Start lifting</Text>
              <Ionicons name="arrow-forward" size={20} color={currentTheme.colors.background} />
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {renderProgressBar()}
          {renderStep()}
        </ScrollView>
        {renderNavigationButtons()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 140,
  },
  progressBarContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  progressBar: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  stepContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  welcomeSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  stepIndicator: {
    fontSize: 14,
    textAlign: 'center',
  },
  payoffEmblem: {
    width: 128,
    height: 128,
    alignSelf: 'center',
    marginBottom: 28,
  },
  tierLadderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 24,
  },
  tierLadderEmblem: {
    opacity: 0.95,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  inputComponent: {
    marginBottom: 0,
  },
  ageInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 40,
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 50,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  hiddenButton: {
    opacity: 0,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 