import { useRoutine } from '@/contexts/RoutineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { aiRoutineService } from '@/lib/aiRoutineService';
import { storageService } from '@/lib/storage';
import { userService } from '@/lib/userService';
import { Equipment } from '@/lib/workouts';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CreateRoutineFlowProps {
  onClose: () => void;
  onCreateRoutine?: (data: RoutineCreationData) => void;
}

export interface RoutineCreationData {
  daysPerWeek: number | null;
  useWorkoutFilters: boolean | null;
  trainingStyle: string | null;
  workoutDuration: number | null;
  equipment: string | null;
  muscleGroupFocus: string[];
  inspiration: string[];
}

interface StepOption {
  id: string | number;
  title: string;
  description: string;
}

interface StepConfig {
  title: string;
  field: keyof RoutineCreationData;
  options: StepOption[];
  multiSelect?: boolean;
}

export default function CreateRoutineFlow({ onClose, onCreateRoutine }: CreateRoutineFlowProps) {
  const { currentTheme } = useTheme();
  const { createRoutine, setCurrentRoutine } = useRoutine();
  const [currentStep, setCurrentStep] = useState(0);
  const [useFilters, setUseFilters] = useState<boolean | null>(null);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [routineData, setRoutineData] = useState<RoutineCreationData>({
    daysPerWeek: null,
    useWorkoutFilters: null,
    trainingStyle: null,
    workoutDuration: null,
    equipment: null,
    muscleGroupFocus: [],
    inspiration: [],
  });

  // Step configurations
  const getSteps = (): StepConfig[] => {
    const baseSteps: StepConfig[] = [
      {
        title: 'How many days per week?',
        field: 'daysPerWeek',
        options: [
          { id: 2, title: '2 Days', description: 'Minimal commitment, perfect for beginners' },
          { id: 3, title: '3 Days', description: 'Great for beginners or busy schedules' },
          { id: 4, title: '4 Days', description: 'Balanced approach for most people' },
          { id: 5, title: '5 Days', description: 'More volume for experienced lifters' },
          { id: 6, title: '6 Days', description: 'High frequency for serious athletes' },
          { id: 7, title: '7 Days', description: 'Daily training for dedicated athletes' },
        ],
      },
      {
        title: 'What\'s your training style?',
        field: 'trainingStyle',
        options: [
          { id: 'powerlifting', title: 'Powerlifting', description: 'Focus on squat, bench, deadlift strength' },
          { id: 'bodybuilding', title: 'Bodybuilding', description: 'Muscle building and hypertrophy focus' },
          { id: 'general', title: 'General Fitness', description: 'Balanced strength and conditioning' },
          { id: 'athletic', title: 'Athletic Performance', description: 'Sports-specific training and power' },
          { id: 'functional', title: 'Functional Fitness', description: 'Real-world movement patterns' },
          { id: 'bodyweight', title: 'Bodyweight/Calisthenics', description: 'Bodyweight skills and strength' },
        ],
      },
      {
        title: 'How long per workout?',
        field: 'workoutDuration',
        options: [
          { id: 30, title: '30 Minutes', description: 'Quick and efficient workouts' },
          { id: 45, title: '45 Minutes', description: 'Balanced workout length' },
          { id: 60, title: '60 Minutes', description: 'Standard gym session' },
          { id: 90, title: '90 Minutes', description: 'Extended training sessions' },
        ],
      },
    ];

    // Only add equipment step if not using filters
    if (!useFilters) {
      baseSteps.push({
        title: 'What equipment do you have?',
        field: 'equipment',
        options: [
          { id: 'full-gym', title: 'Full Gym', description: 'Access to all gym equipment' },
          { id: 'home-gym', title: 'Home Gym', description: 'Dumbbells, barbells, bench, rack' },
          { id: 'basic', title: 'Basic Equipment', description: 'Dumbbells and resistance bands' },
          { id: 'bodyweight', title: 'Bodyweight Only', description: 'No equipment needed' },
        ],
      });
    }

    // Add muscle group focus step
    baseSteps.push({
      title: 'Which muscle groups do you want to focus on? (Optional)',
      field: 'muscleGroupFocus',
      multiSelect: true,
      options: [
        { id: 'chest', title: 'Chest', description: 'Pectorals and upper body pressing' },
        { id: 'back', title: 'Back', description: 'Lats, rhomboids, and rear delts' },
        { id: 'shoulders', title: 'Shoulders', description: 'Deltoids and shoulder stability' },
        { id: 'arms', title: 'Arms', description: 'Biceps, triceps, and forearms' },
        { id: 'legs', title: 'Legs', description: 'Quads, hamstrings, and glutes' },
        { id: 'calves', title: 'Calves', description: 'Lower leg development' },
        { id: 'abs', title: 'Abs', description: 'Core strength and definition' },
        { id: 'full-body', title: 'Full Body', description: 'Balanced overall development' },
      ],
    });

    // Always add inspiration step (but make it optional)
    baseSteps.push({
      title: 'What inspires you? (Optional)',
      field: 'inspiration',
      multiSelect: true,
      options: [
        { id: 'classic-bodybuilding', title: 'Classic Bodybuilding', description: 'Golden era aesthetics and proportions' },
        { id: 'mass-building', title: 'Mass Building', description: 'Focus on maximum muscle size' },
        { id: 'strength-focused', title: 'Strength Focused', description: 'Heavy compound movements' },
        { id: 'aesthetic-physique', title: 'Aesthetic Physique', description: 'Balanced proportions and definition' },
        { id: 'science-based', title: 'Science-Based', description: 'Evidence-driven training methods' },
        { id: 'high-intensity', title: 'High Intensity', description: 'Maximum effort and intensity' },
        { id: 'periodization', title: 'Periodization', description: 'Structured training cycles' },
        { id: 'functional-strength', title: 'Functional Strength', description: 'Real-world applicable power' },
        { id: 'powerlifting-focus', title: 'Powerlifting Focus', description: 'Competition-style strength training' },
        { id: 'varied-training', title: 'Varied Training', description: 'Constantly changing workouts' },
        { id: 'minimalist', title: 'Minimalist', description: 'Simple, basic movements' },
        { id: 'explosive-power', title: 'Explosive Power', description: 'Speed and athletic performance' },
      ],
    });

    return baseSteps;
  };

  const steps = getSteps();
  const totalSteps = steps.length;

  const handleClose = () => {
    setCurrentStep(0);
    setUseFilters(null);
    setRoutineData({
      daysPerWeek: null,
      useWorkoutFilters: null,
      trainingStyle: null,
      workoutDuration: null,
      equipment: null,
      muscleGroupFocus: [],
      inspiration: [],
    });
    onClose();
  };

  const handleFiltersChoice = (choice: boolean) => {
    setUseFilters(choice);
    setRoutineData(prev => ({ ...prev, useWorkoutFilters: choice }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      setUseFilters(null);
    }
  };

  const handleOptionSelect = (field: keyof RoutineCreationData, value: string | number, multiSelect = false) => {
    if (multiSelect && (field === 'inspiration' || field === 'muscleGroupFocus')) {
      setRoutineData(prev => {
        const currentArray = prev[field] as string[];
        return {
          ...prev,
          [field]: currentArray.includes(value as string)
            ? currentArray.filter(item => item !== value)
            : [...currentArray, value as string],
        };
      });
    } else {
      setRoutineData(prev => ({ ...prev, [field]: value }));
    }
  };

  const isOptionSelected = (field: keyof RoutineCreationData, value: string | number) => {
    const fieldValue = routineData[field];
    if (field === 'inspiration' || field === 'muscleGroupFocus') {
      return (fieldValue as string[]).includes(value as string);
    }
    return fieldValue === value;
  };

  const canProceed = () => {
    if (useFilters === null) return false;
    
    const currentStepConfig = steps[currentStep];
    if (!currentStepConfig) return false;

    const value = routineData[currentStepConfig.field];
    
    // Make inspiration optional - users can proceed without selecting any
    if (currentStepConfig.field === 'inspiration') {
      return true;
    }
    
    // Make muscle group focus optional - users can proceed without selecting any
    if (currentStepConfig.field === 'muscleGroupFocus') {
      return true;
    }
    
    if (currentStepConfig.multiSelect) {
      return Array.isArray(value) && value.length > 0;
    }
    return value !== null;
  };

  const renderOption = (option: StepOption, stepConfig: StepConfig) => {
    const isSelected = isOptionSelected(stepConfig.field, option.id);
    
    return (
      <TouchableOpacity
        key={option.id}
        onPress={() => handleOptionSelect(stepConfig.field, option.id, stepConfig.multiSelect)}
        style={[
          styles.optionCard,
          {
            backgroundColor: isSelected ? currentTheme.colors.primary + '20' : currentTheme.colors.surface,
            borderColor: isSelected ? currentTheme.colors.primary : currentTheme.colors.border,
          }
        ]}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.optionTitle,
          {
            color: isSelected ? currentTheme.colors.primary : currentTheme.colors.text,
            fontFamily: 'Raleway_600SemiBold',
          }
        ]}>
          {option.title.length > 25 ? option.title.substring(0, 25) + '...' : option.title}
        </Text>
        <Text style={[
          styles.optionDescription,
          {
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_400Regular',
            opacity: 0.7,
          }
        ]}>
          {option.description.length > 60 ? option.description.substring(0, 60) + '...' : option.description}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFiltersQuestion = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { 
        color: currentTheme.colors.text,
        fontFamily: 'Raleway_600SemiBold',
      }]}>
        Do you want to use existing workout filters?
      </Text>
      
      <View style={styles.optionsContainer}>
        {[
          { id: 'yes', title: 'Yes', description: 'Use my current workout filters (does not include Training Style)' },
          { id: 'no', title: 'No', description: 'Create a new routine from scratch' },
        ].map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => handleFiltersChoice(option.id === 'yes')}
            style={[
              styles.optionCard,
              {
                backgroundColor: useFilters === (option.id === 'yes') ? currentTheme.colors.primary + '20' : currentTheme.colors.surface,
                borderColor: useFilters === (option.id === 'yes') ? currentTheme.colors.primary : currentTheme.colors.border,
              }
            ]}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.optionTitle,
              {
                color: useFilters === (option.id === 'yes') ? currentTheme.colors.primary : currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              {option.title.length > 25 ? option.title.substring(0, 25) + '...' : option.title}
            </Text>
            <Text style={[
              styles.optionDescription,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
                opacity: 0.7,
              }
            ]}>
              {option.description.length > 60 ? option.description.substring(0, 60) + '...' : option.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep = () => {
    if (useFilters === null) {
      return renderFiltersQuestion();
    }

    const stepConfig = steps[currentStep];
    if (!stepConfig) return null;

    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { 
          color: currentTheme.colors.text,
          fontFamily: 'Raleway_600SemiBold',
        }]}>
          {stepConfig.title}
        </Text>
        
        <View style={styles.optionsContainer}>
          {stepConfig.options.map(option => renderOption(option, stepConfig))}
        </View>
      </View>
    );
  };

  const renderNavigationButtons = () => {
    if (useFilters === null) return null;

    return (
      <View style={[styles.navigationContainer, { backgroundColor: currentTheme.colors.background }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: currentTheme.colors.surface }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={currentTheme.colors.text} />
          <Text style={[styles.backButtonText, { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_500Medium',
          }]}>
            Back
          </Text>
        </TouchableOpacity>
        
        {currentStep < totalSteps - 1 ? (
          <TouchableOpacity
            onPress={handleNext}
            disabled={!canProceed()}
            style={[
              styles.nextButton, 
              { 
                backgroundColor: canProceed() ? currentTheme.colors.primary : currentTheme.colors.border,
                marginLeft: 12,
              }
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.nextButtonText, { 
              color: canProceed() ? currentTheme.colors.background : currentTheme.colors.text + '60',
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Next
            </Text>
            <Ionicons 
              name="arrow-forward" 
              size={20} 
              color={canProceed() ? currentTheme.colors.background : currentTheme.colors.text + '60'} 
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={async () => {
              if (!canProceed()) return;
              
              setIsCreatingRoutine(true);
              try {
                // Build workout context
                const userProfile = await userService.getUserProfileOrDefault();
                const userProgress = await storageService.getUserProgress();
                const workoutHistory = await storageService.getWorkoutHistory();
                const userPreferences = await storageService.getUserPreferences();
                const workoutFilters = routineData.useWorkoutFilters ? await storageService.getWorkoutFilters() : undefined;

                const context = {
                  userProfile,
                  userProgress,
                  availableEquipment: (userPreferences.preferredEquipment || []) as Equipment[],
                  workoutHistory,
                  workoutFilters,
                  preferences: {
                    duration: routineData.workoutDuration || undefined,
                    excludeBodyweight: userPreferences.excludeBodyweight,
                  },
                };

                const routine = await aiRoutineService.generateRoutine(context, routineData);
                
                await createRoutine(routine);
                await setCurrentRoutine(routine);

                if (onCreateRoutine) {
                  onCreateRoutine(routineData);
                }
                handleClose();
              } catch (error) {
                console.error('Failed to create routine:', error);
                // You can add proper error handling UI here
                Alert.alert('Failed to create routine', 'Please try again.');
              } finally {
                setIsCreatingRoutine(false);
              }
            }}
            disabled={!canProceed() || isCreatingRoutine}
            style={[
              styles.nextButton, 
              { 
                backgroundColor: (canProceed() && !isCreatingRoutine) ? currentTheme.colors.primary : currentTheme.colors.border,
                marginLeft: 12,
              }
            ]}
            activeOpacity={0.7}
          >
            {isCreatingRoutine ? (
              <ActivityIndicator size="small" color={currentTheme.colors.background} />
            ) : (
              <>
                <Text style={[styles.nextButtonText, { 
                  color: (canProceed() && !isCreatingRoutine) ? currentTheme.colors.background : currentTheme.colors.text + '60',
                  fontFamily: 'Raleway_600SemiBold',
                }]}>
                  Create Routine
                </Text>
                <Ionicons 
                  name="checkmark" 
                  size={20} 
                  color={(canProceed() && !isCreatingRoutine) ? currentTheme.colors.background : currentTheme.colors.text + '60'} 
                />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderProgressBar = () => {
    if (useFilters === null) return null;
    
    const progress = (currentStep + 1) / totalSteps;
    
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderProgressBar()}
        {renderStep()}
      </ScrollView>
      {renderNavigationButtons()}
    </View>
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
    paddingTop: 20,
    paddingBottom: 140,
  },
  progressBarContainer: {
    alignItems: 'center',
    marginBottom: 30,
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
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  optionsContainer: {
    width: '100%',
    gap: 10,
  },
  optionCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  optionDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 