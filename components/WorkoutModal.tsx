import Button from '@/components/Button';
import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { getWorkoutById } from '@/lib/workouts';
import { ExerciseSet, GeneratedWorkout } from '@/types';
import * as Haptics from 'expo-haptics';
import {
  Activity,
  Brain,
  Cpu,
  Dumbbell,
  Flame,
  Settings,
  Shuffle,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';

// Golden ratio and Fibonacci spacing constants
const GOLDEN_RATIO = 1.618;
const SPACING_BASE = 8;
const SPACING = {
  xs: SPACING_BASE,           // 8
  sm: SPACING_BASE * 1.625,   // 13 (fibonacci)
  md: SPACING_BASE * 2.625,   // 21 (fibonacci)
  lg: SPACING_BASE * 4.25,    // 34 (fibonacci)
  xl: SPACING_BASE * 6.875,   // 55 (fibonacci)
};

interface WorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  workout: GeneratedWorkout | null;
  onStartWorkout?: () => void;
  onRegenerateWorkout?: (workoutType?: string) => Promise<GeneratedWorkout>;
  onWorkoutUpdate?: (workout: GeneratedWorkout) => void;
}

const WORKOUT_TYPES = [
  'Push (Chest, Shoulders, Triceps)',
  'Pull (Back, Biceps)',
  'Legs (Quads, Glutes, Hamstrings)',
  'Full Body',
  'Upper Body',
];

const WorkoutTypeFilter: React.FC<{
  selectedType: string | null;
  onTypeSelect: (type: string | null) => void;
}> = ({ selectedType, onTypeSelect }) => {
  const { currentTheme } = useTheme();
  const { play: playTapVariant1 } = useSound('tapVariant1');
  
  const workoutChips = [
    { id: null, label: 'Any' },
    { id: 'Push (Chest, Shoulders, Triceps)', label: 'Push' },
    { id: 'Pull (Back, Biceps)', label: 'Pull' },
    { id: 'Legs (Quads, Glutes, Hamstrings)', label: 'Legs' },
    { id: 'Full Body', label: 'Full Body' },
    { id: 'Upper Body', label: 'Upper' },
  ];

  const handlePress = async (chipId: string | null) => {
    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playTapVariant1();
    onTypeSelect(chipId);
  };

  return (
    <View style={[styles.chipContainer, { backgroundColor: 'transparent' }]}>
      <Text style={[
        styles.chipTitle,
        { 
          color: currentTheme.colors.text,
          fontFamily: currentTheme.properties.headingFontFamily,
        }
      ]}>
        Select your workout focus
      </Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScrollContainer}
      >
        {workoutChips.map((chip) => {
          const isSelected = selectedType === chip.id;
          return (
            <Button
              key={chip.id || 'any'}
              title={chip.label}
              onPress={() => handlePress(chip.id)}
              variant={isSelected ? 'primary' : 'secondary'}
              size="small"
              style={{
                backgroundColor: isSelected ? currentTheme.colors.primary : '#FFFFFF',
                borderRadius: currentTheme.borderRadius,
                paddingHorizontal: 20,
                marginRight: 8,
              }}
              textStyle={{
                color: isSelected ? '#FFFFFF' : currentTheme.colors.text,
                fontWeight: '500',
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

const FloatingElement: React.FC<{ 
  icon: any; 
  delay: number; 
  themeColors: any;
  startX: number;
  startY: number;
}> = ({ icon: Icon, delay, themeColors, startX, startY }) => {
  const translateY = React.useRef(new Animated.Value(0)).current;
  const translateX = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0.1)).current;
  const rotate = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const floatAnimation = () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -30,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: Math.random() > 0.5 ? 20 : -20,
            duration: 2500 + Math.random() * 1500,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 2500 + Math.random() * 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 6000 + Math.random() * 4000,
          useNativeDriver: true,
        }),
      ]).start(() => {
        rotate.setValue(0);
        floatAnimation();
      });
    };

    const timeout = setTimeout(floatAnimation, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.floatingElement,
        {
          left: startX,
          top: startY,
          opacity,
          transform: [
            { translateY },
            { translateX },
            { rotate: rotateInterpolate }
          ],
        },
      ]}
    >
      <Icon size={24} color={themeColors.primary} strokeWidth={1} />
    </Animated.View>
  );
};

const BackgroundEffects: React.FC<{ themeColors: any; isActive: boolean }> = ({ 
  themeColors, 
  isActive 
}) => {
  const backgroundOpacity = React.useRef(new Animated.Value(0)).current;
  
  const floatingIcons = [
    { icon: Dumbbell, x: '10%', y: '15%' },
    { icon: Zap, x: '85%', y: '25%' },
    { icon: Target, x: '15%', y: '45%' },
    { icon: Activity, x: '80%', y: '55%' },
    { icon: Flame, x: '20%', y: '75%' },
    { icon: Brain, x: '75%', y: '80%' },
  ];

  React.useEffect(() => {
    Animated.timing(backgroundOpacity, {
      toValue: isActive ? 1 : 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [isActive]);

  if (!isActive) return null;

  return (
    <Animated.View 
      style={[
        styles.backgroundEffects,
        { opacity: backgroundOpacity }
      ]}
      pointerEvents="none"
    >
      {floatingIcons.map((item, index) => (
        <FloatingElement
          key={index}
          icon={item.icon}
          delay={index * 500}
          themeColors={themeColors}
          startX={parseFloat(item.x) / 100 * 300} // Approximate screen width
          startY={parseFloat(item.y) / 100 * 600} // Approximate screen height
        />
      ))}
    </Animated.View>
  );
};

const AnimatedButton: React.FC<{
  isRegenerating: boolean;
  onPress: () => void;
  themeColors: any;
}> = ({ isRegenerating, onPress, themeColors }) => {
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isRegenerating) {
      // Simple opacity pulse for loading state
      const pulseAnimation = () => {
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (isRegenerating) pulseAnimation();
        });
      };
      pulseAnimation();
    } else {
      opacity.setValue(1);
    }
  }, [isRegenerating]);

  return (
    <Animated.View style={{ opacity: isRegenerating ? opacity : 1, flex: 0.7 }}>
      <Button
        title={isRegenerating ? 'Regenerating' : 'Generate Workout'}
        onPress={onPress}
        variant="secondary"
        size="small"
        disabled={isRegenerating}
        style={{
          flex: 1,
          minHeight: 40,
          opacity: isRegenerating ? 0.7 : 1,
        }}
        hapticType="heavy"
      />
    </Animated.View>
  );
};

const SlotMachineLoader: React.FC<{ themeColors: any }> = ({ themeColors }) => {
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const spinAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(1);
  const pulseAnim = new Animated.Value(1);
  
  const icons = [
    { component: Dumbbell, name: 'dumbbell' },
    { component: Zap, name: 'zap' },
    { component: Target, name: 'target' },
    { component: TrendingUp, name: 'trending' },
    { component: Cpu, name: 'cpu' },
    { component: Shuffle, name: 'shuffle' },
    { component: Activity, name: 'activity' },
    { component: Flame, name: 'flame' },
    { component: Brain, name: 'brain' },
    { component: Settings, name: 'settings' }
  ];
  
  const loadingMessages = [
    'Calculating the best workout...',
    'Adding some randomness...',
    'Activating RNG...',
    'Analyzing your preferences...',
    'Optimizing muscle groups...',
    'Balancing difficulty...',
    'Fine-tuning exercises...',
    'Generating perfect sets...',
    'Calibrating intensity...',
    'Crafting your routine...'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIconIndex(prev => (prev + 1) % icons.length);
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
      
      // Sophisticated spin animation with scaling
      Animated.parallel([
        Animated.sequence([
          Animated.timing(spinAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(spinAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ]).start();
    }, 800); // Slowed down from 150ms to 800ms

    // Continuous pulse animation for the outer ring
    const pulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulseAnimation());
    };
    pulseAnimation();

    return () => clearInterval(interval);
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'], // Double spin for more drama
  });

  const CurrentIcon = icons[currentIconIndex].component;
  const currentMessage = loadingMessages[messageIndex];

  return (
    <View style={[styles.slotContainer, { backgroundColor: 'transparent' }]}>
      {/* Background effects */}
      <BackgroundEffects themeColors={themeColors} isActive={true} />
      
      {/* Outer pulsing ring */}
      <Animated.View 
        style={[
          styles.outerRing, 
          { 
            borderColor: themeColors.primary + '20',
            transform: [{ scale: pulseAnim }]
          }
        ]}
      />
      
      {/* Main icon container */}
      <View style={[styles.slotMachine, { 
        borderColor: themeColors.primary,
        backgroundColor: themeColors.background,
        shadowColor: themeColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8
      }]}>
        <Animated.View
          style={[
            { transform: [{ rotate: spin }, { scale: scaleAnim }] }
          ]}
        >
          <CurrentIcon 
            size={40} 
            color={themeColors.primary}
            strokeWidth={2}
          />
        </Animated.View>
      </View>
      
      {/* Loading message */}
      <Text style={[styles.slotMessage, { color: themeColors.text }]}>
        {currentMessage}
      </Text>
      
      {/* Animated dots */}
      <View style={[styles.slotDots, { backgroundColor: 'transparent' }]}>
        {[...Array(4)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { 
                backgroundColor: themeColors.primary,
                opacity: (messageIndex + i) % 4 === 0 ? 1 : 0.2,
                transform: [{ 
                  scale: (messageIndex + i) % 4 === 0 ? 1.2 : 1 
                }]
              }
            ]}
          />
        ))}
      </View>
      
      {/* Progress indicator */}
      <View style={[styles.progressContainer, { backgroundColor: themeColors.border }]}>
        <Animated.View 
          style={[
            styles.progressBar,
            { 
              backgroundColor: themeColors.primary,
              width: `${((messageIndex % 10) + 1) * 10}%`
            }
          ]}
        />
      </View>
    </View>
  );
};

const CompactExerciseRow: React.FC<{ 
  exercise: ExerciseSet; 
  index: number; 
  themeColors: any;
  isNew?: boolean;
}> = ({ exercise, index, themeColors, isNew = false }) => {
  const workoutDetails = getWorkoutById(exercise.id);
  const fadeAnim = React.useRef(new Animated.Value(isNew ? 0 : 1)).current;
  
  React.useEffect(() => {
    if (isNew) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(1);
    }
  }, [isNew, index, fadeAnim]);
  
  if (!workoutDetails) {
    return (
      <View style={[styles.exerciseRow, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.exerciseRowText, { color: themeColors.text }]}>
          Exercise not found: {exercise.id}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.exerciseRow, 
        { 
          borderBottomColor: themeColors.border,
          opacity: fadeAnim,
          backgroundColor: 'transparent'
        }
      ]}
    >
      <View style={[styles.exerciseNumber, { backgroundColor: themeColors.primary }]}>
        <Text style={[styles.exerciseNumberText, { color: 'white' }]}>
          {index + 1}
        </Text>
      </View>
      
      <View style={[styles.exerciseInfo, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.exerciseName, { color: themeColors.text }]}>
          {workoutDetails.name}
          {isNew && <Text style={{ color: themeColors.accent }} />}
        </Text>
        <Text style={[styles.exerciseTarget, { color: themeColors.text, opacity: 0.7 }]}>
          {workoutDetails.primaryMuscles.join(', ')}
        </Text>
      </View>
      
      <View style={[styles.exerciseSets, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.setsText, { color: themeColors.primary }]}>
          {exercise.sets} × {exercise.reps}
        </Text>
        <Text style={[styles.equipmentText, { color: themeColors.text, opacity: 0.6 }]}>
          {workoutDetails.equipment[0]}
        </Text>
      </View>
    </Animated.View>
  );
};

export default function WorkoutModal({ 
  visible, 
  onClose, 
  workout, 
  onStartWorkout,
  onRegenerateWorkout,
  onWorkoutUpdate
}: WorkoutModalProps) {
  const { currentTheme } = useTheme();
  const [currentWorkout, setCurrentWorkout] = useState<GeneratedWorkout | null>(workout);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isNewWorkout, setIsNewWorkout] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<string | null>(null);
  const { play: playSelectionComplete } = useSound('selectionComplete');
  // Update internal state when workout prop changes
  React.useEffect(() => {
    setCurrentWorkout(workout);
    setIsNewWorkout(false);
  }, [workout]);

  const handleRegenerate = async () => {
    if (!onRegenerateWorkout) return;
    
    setIsRegenerating(true);
    setIsNewWorkout(false);
    
    try {
      const newWorkout = await onRegenerateWorkout(selectedWorkoutType || undefined);
      
      // Add a small delay to make the slot machine feel more realistic
      setTimeout(() => {
        setCurrentWorkout(newWorkout);
        setIsNewWorkout(true);
        setIsRegenerating(false);
        
        // Notify parent component of the updated workout
        if (onWorkoutUpdate) {
          onWorkoutUpdate(newWorkout);
        }
      }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
      
    } catch (error) {
      console.error('Error regenerating workout:', error);
      setIsRegenerating(false);
    }
  };

  const handleStartWorkout = () => {
    playSelectionComplete();
    // Use the current workout from this modal's state, not the parent's potentially stale state
    if (onStartWorkout && currentWorkout) {
      onStartWorkout();
    }
  };

  if (!currentWorkout) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header with close button */}
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <View style={[styles.headerContent, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.workoutTitle, { color: currentTheme.colors.text }]}>
              {currentWorkout.title}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: currentTheme.colors.text }]}>✕</Text>
            </Pressable>
          </View>
        </View>

        {/* Compact action buttons at the top */}
        <View style={[styles.actionButtons, { backgroundColor: 'transparent' }]}>
          <AnimatedButton
            isRegenerating={isRegenerating}
            onPress={handleRegenerate}
            themeColors={currentTheme.colors}
          />
          <Button
            title="Start"
            onPress={handleStartWorkout}
            variant="primary"
            size="small"
            style={StyleSheet.flatten([styles.startButton, { marginLeft: 6 }])}
            hapticType="light"
          />
        </View>

        {/* Workout type filter */}
        <WorkoutTypeFilter
          selectedType={selectedWorkoutType}
          onTypeSelect={(type) => setSelectedWorkoutType(type)}
        />

        {isRegenerating ? (
          <SlotMachineLoader themeColors={currentTheme.colors} />
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Compact workout stats */}
            <Card style={StyleSheet.flatten([
              styles.statsCard, 
              isNewWorkout && { backgroundColor: currentTheme.colors.accent + '10' }
            ])} variant="subtle">
              <View style={[styles.statsRow, { backgroundColor: 'transparent' }]}>
                <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.statNumber, { color: currentTheme.colors.primary }]}>
                    {currentWorkout.exercises.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>exercises</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.statNumber, { color: currentTheme.colors.accent }]}>
                    {currentWorkout.estimatedDuration}m
                  </Text>
                  <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>duration</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.statNumber, { color: currentTheme.colors.text }]}>
                    {currentWorkout.difficulty}
                  </Text>
                  <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>level</Text>
                </View>
              </View>
            </Card>

            {/* Compact exercise list */}
            <Card style={styles.exercisesCard} variant="elevated">
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
                Exercise Plan
              </Text>
              
              {currentWorkout.exercises.map((exercise, index) => (
                <CompactExerciseRow
                  key={`${exercise.id}-${index}`}
                  exercise={exercise}
                  index={index}
                  themeColors={currentTheme.colors}
                  isNew={isNewWorkout}
                />
              ))}
            </Card>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 6,
    alignItems: 'stretch',
  },
  startButton: {
    flex: 0.3,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
  },
  slotContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  outerRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
  slotMachine: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  slotEmoji: {
    fontSize: 48,
  },
  slotMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  slotDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsCard: {
    marginBottom: 16,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  workoutDescription: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  exercisesCard: {
    marginBottom: 40,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  exerciseRowText: {
    fontSize: 14,
    padding: 12,
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  exerciseTarget: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  exerciseSets: {
    alignItems: 'flex-end',
  },
  setsText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  equipmentText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  progressContainer: {
    width: 200,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  floatingElement: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundEffects: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  chipContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  chipScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
}); 