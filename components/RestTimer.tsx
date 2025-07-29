import Button from '@/components/Button';
import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface RestTimerProps {
  isResting: boolean;
  formattedTime: string;
  onSkip: () => void;
  currentTime?: number;
  totalTime?: number;
}

const CIRCLE_SIZE = 140;
const STROKE_WIDTH = 6;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RestTimer({ 
  isResting, 
  formattedTime, 
  onSkip, 
  currentTime = 0, 
  totalTime = 60 
}: RestTimerProps) {
  const { currentTheme } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Calculate how much time is remaining (1 = full, 0 = empty)
  const timeRemaining = totalTime > 0 ? Math.max(0, (totalTime - currentTime) / totalTime) : 1;
  
  // Calculate stroke offset for radial progress
  const strokeDashoffset = CIRCUMFERENCE * (1 - timeRemaining);

  useEffect(() => {
    if (isResting) {
      // Scale in animation when timer starts
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      return () => {
        pulse.stop();
      };
    } else {
      // Scale out animation when timer ends
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isResting]);

  if (!isResting) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
        }
      ]}
    >
      <Card 
        style={StyleSheet.flatten([
          styles.restCard,
          { 
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.primary + '30',
          }
        ])} 
        variant="elevated"
      >
        <View style={[styles.restContent, { backgroundColor: 'transparent' }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: 'transparent' }]}>
            <View style={[styles.titleContainer, { backgroundColor: 'transparent' }]}>
              <Ionicons 
                name="timer-outline" 
                size={20} 
                color={currentTheme.colors.primary} 
              />
              <Text style={[styles.restTitle, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Rest Time
              </Text>
            </View>
            
            <Button
              title="Skip"
              onPress={onSkip}
              variant="secondary"
              size="small"
              hapticType="light"
            />
          </View>

          {/* Circular Timer */}
          <View style={[styles.timerContainer, { backgroundColor: 'transparent' }]}>
            <Animated.View 
              style={[
                styles.circleContainer,
                { 
                  transform: [{ scale: pulseAnim }],
                }
              ]}
            >
              <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
                {/* Background circle */}
                <Circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  stroke={currentTheme.colors.border}
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                  opacity={0.2}
                />
                {/* Progress circle - radial countdown */}
                <Circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  stroke={currentTheme.colors.primary}
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
                />
              </Svg>
              
              {/* Timer text overlay */}
              <View style={[styles.timerTextContainer, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.restTimer, { 
                  color: currentTheme.colors.primary,
                  fontFamily: 'Raleway_700Bold',
                }]}>
                  {formattedTime}
                </Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    marginHorizontal: 20,
  },
  restCard: {
    padding: 20,
    borderWidth: 2,
  },
  restContent: {
    alignItems: 'center',
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: CIRCLE_SIZE + 20,
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
  },
  restTimer: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
  },
}); 