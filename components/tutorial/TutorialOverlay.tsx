import { useTutorial } from '@/contexts/TutorialContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Href } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStepsByIndex, getTotalSteps, PointerDirection } from './tutorialSteps';
import { getTargetPosition } from './TutorialTarget';

const { width: _SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PointingHandProps {
  direction: PointerDirection;
  color: string;
}

function PointingHand({ direction, color: _color }: PointingHandProps) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (direction === 'up' || direction === 'down') {
      translateY.value = withRepeat(
        withSequence(
          withTiming(direction === 'up' ? -8 : 8, { duration: 500 }),
          withTiming(0, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      translateX.value = withRepeat(
        withSequence(
          withTiming(direction === 'left' ? -8 : 8, { duration: 500 }),
          withTiming(0, { duration: 500 })
        ),
        -1,
        true
      );
    }
  }, [direction, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  const getRotation = () => {
    switch (direction) {
      case 'up': return '0deg';
      case 'down': return '180deg';
      case 'left': return '270deg';
      case 'right': return '90deg';
    }
  };

  return (
    <Animated.View style={[styles.handContainer, animatedStyle, { transform: [{ rotate: getRotation() }] }]}>
      <Text style={styles.handEmoji}>👆</Text>
    </Animated.View>
  );
}

interface SpotlightProps {
  target: { x: number; y: number; width: number; height: number } | null;
}

function Spotlight({ target }: SpotlightProps) {
  if (!target) return null;

  const padding = 8;
  const spotlightStyle = {
    left: target.x - padding,
    top: target.y - padding,
    width: target.width + padding * 2,
    height: target.height + padding * 2,
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.spotlight, spotlightStyle]}
    />
  );
}

export function TutorialOverlay() {
  const {
    showTutorial,
    currentStep,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    setCurrentScreen,
  } = useTutorial();
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { play: playSound } = useSound('pop');
  const router = useRouter();
  const lastScreen = useRef<string | null>(null);
  const [targetPosition, setTargetPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const step = getStepsByIndex(currentStep);
  const totalSteps = getTotalSteps();
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  // Reset tracking when tutorial visibility changes
  useEffect(() => {
    if (!showTutorial) {
      lastScreen.current = null;
      setTargetPosition(null);
    }
  }, [showTutorial]);

  // Navigate to the correct screen when step changes
  useEffect(() => {
    if (step && showTutorial) {
      setCurrentScreen(step.screen);

      // Only navigate if the screen changed
      if (lastScreen.current !== step.screen) {
        lastScreen.current = step.screen;

        // Map screen names to routes
        const screenRoutes: Record<string, string> = {
          home: '/',
          workout: '/workout',
          history: '/history',
          profile: '/profile',
        };

        const route = screenRoutes[step.screen];
        if (route) {
          router.replace(route as Href);
        }
      }

      // Update target position after navigation settles
      if (step.targetId) {
        const checkTarget = () => {
          const pos = getTargetPosition(step.targetId!);
          if (pos) {
            setTargetPosition(pos);
          } else {
            setTargetPosition(null);
          }
        };

        // Check multiple times as components may still be measuring
        const timer1 = setTimeout(checkTarget, 200);
        const timer2 = setTimeout(checkTarget, 500);
        const timer3 = setTimeout(checkTarget, 1000);

        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
          clearTimeout(timer3);
        };
      } else {
        setTargetPosition(null);
      }
    }
  }, [step, currentStep, showTutorial, setCurrentScreen, router]);

  const handleNext = () => {
    playHapticFeedback('selection', false);
    playSound();
    if (isLastStep) {
      completeTutorial();
    } else {
      nextStep();
    }
  };

  const handlePrevious = () => {
    playHapticFeedback('selection', false);
    playSound();
    previousStep();
  };

  const handleSkip = () => {
    playHapticFeedback('selection', false);
    skipTutorial();
  };

  if (!showTutorial || !step) return null;

  const getTooltipPosition = () => {
    // If we have a target, position tooltip relative to it
    if (targetPosition && step.tooltipPosition === 'bottom') {
      const tooltipTop = targetPosition.y + targetPosition.height + 60;
      // Make sure tooltip doesn't go off screen
      if (tooltipTop + 250 > SCREEN_HEIGHT) {
        return { bottom: 120 };
      }
      return { top: tooltipTop };
    }

    switch (step.tooltipPosition) {
      case 'top':
        return { top: insets.top + 100 };
      case 'bottom':
        return { bottom: 120 };
      case 'center':
      default:
        return { top: SCREEN_HEIGHT * 0.3 };
    }
  };

  const getHandPosition = () => {
    if (!targetPosition || !step.pointerDirection) return null;

    const targetCenterX = targetPosition.x + targetPosition.width / 2;

    switch (step.pointerDirection) {
      case 'up':
        return {
          left: targetCenterX - 20,
          top: targetPosition.y + targetPosition.height + 15,
        };
      case 'down':
        return {
          left: targetCenterX - 20,
          top: targetPosition.y - 50,
        };
      case 'left':
        return {
          left: targetPosition.x + targetPosition.width + 10,
          top: targetPosition.y + targetPosition.height / 2 - 20,
        };
      case 'right':
        return {
          left: targetPosition.x - 50,
          top: targetPosition.y + targetPosition.height / 2 - 20,
        };
    }
  };

  const handPosition = getHandPosition();

  return (
    <Modal
      visible={showTutorial}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Glass overlay background */}
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={[styles.glassOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]}
        />

        {/* Spotlight cutout */}
        <Spotlight target={targetPosition} />

        {/* Pointing hand */}
        {handPosition && step.pointerDirection && (
          <Animated.View
            entering={FadeIn.duration(300).delay(200)}
            style={[styles.handWrapper, handPosition]}
          >
            <PointingHand
              direction={step.pointerDirection}
              color={currentTheme.colors.primary}
            />
          </Animated.View>
        )}

        {/* Tooltip card */}
        <Animated.View
          key={currentStep}
          entering={SlideInDown.duration(400).springify()}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.tooltipCard,
            getTooltipPosition(),
            {
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }
          ]}
        >
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            {Array.from({ length: totalSteps }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: index <= currentStep
                      ? currentTheme.colors.primary
                      : currentTheme.colors.border,
                  }
                ]}
              />
            ))}
          </View>

          {/* Step counter */}
          <Text style={[styles.stepCounter, { color: currentTheme.colors.text + '60' }]}>
            {currentStep + 1} of {totalSteps}
          </Text>

          {/* Title */}
          <Text style={[styles.title, {
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_700Bold',
          }]}>
            {step.title}
          </Text>

          {/* Description */}
          <Text style={[styles.description, {
            color: currentTheme.colors.text + '90',
            fontFamily: 'Raleway_400Regular',
          }]}>
            {step.description}
          </Text>

          {/* Navigation buttons */}
          <View style={styles.buttonContainer}>
            {!isFirstStep ? (
              <TouchableOpacity
                style={[styles.backButton]}
                onPress={handlePrevious}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={currentTheme.colors.text} />
                <Text style={[styles.backButtonText, {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.skipButton]}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={[styles.skipButtonText, {
                  color: currentTheme.colors.text + '80',
                  fontFamily: 'Raleway_500Medium',
                }]}>Skip Tour</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={[styles.nextButtonText, {
                color: '#FFFFFF',
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                {isLastStep ? 'Get Started' : 'Next'}
              </Text>
              {!isLastStep && (
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              )}
              {isLastStep && (
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Skip button in corner */}
        {!isFirstStep && (
          <TouchableOpacity
            style={[styles.cornerSkipButton, { top: insets.top + 10 }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[styles.cornerSkipText, { color: '#FFFFFF' }]}>
              Skip
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  spotlight: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  handWrapper: {
    position: 'absolute',
    zIndex: 100,
  },
  handContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handEmoji: {
    fontSize: 32,
  },
  tooltipCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepCounter: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Raleway_500Medium',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 16,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cornerSkipButton: {
    position: 'absolute',
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  cornerSkipText: {
    fontSize: 14,
    fontFamily: 'Raleway_500Medium',
  },
});

export default TutorialOverlay;
