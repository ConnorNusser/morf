import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { userService } from '@/lib/userService';
import { Equipment, Gender, HeightUnit, WeightUnit } from '@/types';
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

const ALL_EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'smith-machine', 'cable', 'kettlebell', 'bodyweight'];

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [height, setHeight] = useState<{ value: number; unit: HeightUnit }>({ value: 5.9, unit: 'feet' });
  const [weight, setWeight] = useState<{ value: number; unit: WeightUnit }>({ value: 185, unit: 'lbs' });
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs');
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

  const handleWeightUnitChange = (weightUnit: WeightUnit) => {
    playHapticFeedback('selection', false);
    playSound();
    setWeightUnit(weightUnit);
  };

  const canProceedFromStep = () => {
    switch (currentStep) {
      case 0: return true; // Welcome step
      case 1: return height.value > 0; // Height step
      case 2: return weight.value > 0; // Weight step
      case 3: return true; // Gender step - always valid since we have default
      case 4: return age > 0 && age < 120; // Age step
      case 5: return availableEquipment.length > 0; // Equipment step
      case 6: return weightUnit !== null; // Weight unit step
      default: return false;
    }
  };

  const handleComplete = async () => {
    if (!height || !weight) return;

    setIsCreatingProfile(true);
    playHapticFeedback('medium', false);
    playUnlock();

    try {
      // Create user profile
      await userService.createUserProfile({
        height,
        weight,
        gender,
        age,
        lifts: [],
        secondaryLifts: [],
        weightUnitPreference: weightUnit,
        equipmentFilter: {
          mode: availableEquipment.length === ALL_EQUIPMENT.length ? 'all' : 'custom',
          includedEquipment: availableEquipment,
        },
      });

      onComplete();
    } catch (error) {
      console.error('Failed to create profile:', error);
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
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.welcomeTitle, { 
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_700Bold',
            }]}>
              Welcome to Morf!
            </Text>
            <Text style={[styles.welcomeSubtitle, { 
              color: currentTheme.colors.text + '90',
              fontFamily: 'Raleway_400Regular',
            }]}>
              {"Let's set up your profile to create personalized workouts just for you."}
            </Text>
            <Text style={[styles.stepIndicator, { 
              color: currentTheme.colors.text + '60',
              fontFamily: 'Raleway_400Regular',
            }]}>
              This will take about 1 minute
            </Text>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>{"What's your height?"}</Text>
            <Text style={[styles.stepSubtitle, { 
              color: currentTheme.colors.text + '80',
              fontFamily: 'Raleway_400Regular',
            }]}>
              This helps us calculate your strength percentiles and track progress.
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
              fontFamily: 'Raleway_600SemiBold',
            }]}>{"What's your weight?"}</Text>
            <Text style={[styles.stepSubtitle, { 
              color: currentTheme.colors.text + '80',
              fontFamily: 'Raleway_400Regular',
            }]}>
              We use this to personalize your workout recommendations.
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
              fontFamily: 'Raleway_600SemiBold',
            }]}>{"What's your gender?"}</Text>
            <Text style={[styles.stepSubtitle, { 
              color: currentTheme.colors.text + '80',
              fontFamily: 'Raleway_400Regular',
            }]}>
              This helps us provide more accurate strength standards.
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
              fontFamily: 'Raleway_600SemiBold',
            }]}>{"What's your age?"}</Text>
            <Text style={[styles.stepSubtitle, { 
              color: currentTheme.colors.text + '80',
              fontFamily: 'Raleway_400Regular',
            }]}>
              This helps us provide more accurate strength standards.
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
              fontFamily: 'Raleway_600SemiBold',
            }]}>What equipment do you have?</Text>
            <Text style={[styles.stepSubtitle, {
              color: currentTheme.colors.text + '80',
              fontFamily: 'Raleway_400Regular',
            }]}>
              This helps us generate workouts with exercises you can actually do.
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
            <Text style={[styles.stepTitle, {
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>Choose your weight units</Text>
            
            <View style={styles.unitSelectionContainer}>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    { 
                      backgroundColor: weightUnit === 'lbs' ? currentTheme.colors.primary : currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  onPress={() => handleWeightUnitChange('lbs')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.unitButtonText,
                    { 
                      color: weightUnit === 'lbs' ? '#FFFFFF' : currentTheme.colors.text,
                      fontFamily: 'Raleway_600SemiBold',
                    }
                  ]}>
                    lbs
                  </Text>
                  <Text style={[
                    styles.unitButtonSubtext,
                    { 
                      color: weightUnit === 'lbs' ? '#FFFFFF' + '90' : currentTheme.colors.text + '70',
                      fontFamily: 'Raleway_400Regular',
                    }
                  ]}>
                    Imperial
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    { 
                      backgroundColor: weightUnit === 'kg' ? currentTheme.colors.primary : currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                  onPress={() => handleWeightUnitChange('kg')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.unitButtonText,
                    { 
                      color: weightUnit === 'kg' ? '#FFFFFF' : currentTheme.colors.text,
                      fontFamily: 'Raleway_600SemiBold',
                    }
                  ]}>
                    kg
                  </Text>
                  <Text style={[
                    styles.unitButtonSubtext,
                    { 
                      color: weightUnit === 'kg' ? '#FFFFFF' + '90' : currentTheme.colors.text + '70',
                      fontFamily: 'Raleway_400Regular',
                    }
                  ]}>
                    Metric
                  </Text>
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.unitHint, { 
                color: currentTheme.colors.text + '60',
                fontFamily: 'Raleway_400Regular',
              }]}>
                You can change this later in your profile settings
              </Text>
            </View>
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
        fontFamily: 'Raleway_500Medium',
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
              fontFamily: 'Raleway_500Medium',
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
            fontFamily: 'Raleway_600SemiBold',
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
                fontFamily: 'Raleway_600SemiBold',
              }]}>Complete</Text>
              <Ionicons name="checkmark" size={20} color={currentTheme.colors.background} />
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
    fontFamily: 'Raleway_700Bold',
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
  unitSelectionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  unitToggle: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
    gap: 12,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  unitButtonSubtext: {
    fontSize: 14,
    fontWeight: '400',
  },
  unitHint: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 