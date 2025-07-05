import { calculateStrengthPercentile } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { convertWeightToLbs } from '@/lib/utils';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TrendingArrowProps {
  color?: string;
}

interface TrendData {
  direction: 'up' | 'down' | 'stable';
  percentileChange: number;
  label: string;
  timespan: string;
}

export default function TrendingArrow({ color = '#10B981' }: TrendingArrowProps) {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const mainLifts = ['deadlift', 'overhead-press', 'squat', 'bench-press'];

  useEffect(() => {
    calculateTrend();
  }, []);

  const calculateTrend = async () => {
    try {
      const userProgress = await userService.calculateRealUserProgress();
      const userProfile = await userService.getRealUserProfile();
      
      if (userProgress.length === 0 || !userProfile) {
        setTrendData(null);
        return;
      }

      const mainLiftProgress = userProgress.filter(p => mainLifts.includes(p.workoutId));
      
      if (mainLiftProgress.length === 0) {
        setTrendData(null);
        return;
      }

      const bodyWeightInLbs = convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit);

      let currentPercentiles: number[] = [];
      let historical90DayPercentiles: number[] = [];

      mainLiftProgress.forEach(progress => {
        const currentPercentile = progress.percentileRanking;
        currentPercentiles.push(currentPercentile);

        const currentWeight = progress.personalRecord;
        const estimated90DayAgoWeight = Math.max(currentWeight * 0.85, currentWeight - 20);

        const exerciseKey = progress.workoutId;

        const historical90DayPercentile = calculateStrengthPercentile(
          estimated90DayAgoWeight,
          bodyWeightInLbs,
          userProfile.gender,
          exerciseKey as any,
          userProfile.age
        );

        historical90DayPercentiles.push(historical90DayPercentile);
      });

      const currentAverage = currentPercentiles.reduce((sum, p) => sum + p, 0) / currentPercentiles.length;
      const historicalAverage = historical90DayPercentiles.reduce((sum, p) => sum + p, 0) / historical90DayPercentiles.length;
      
      const percentileChange = Math.round(currentAverage - historicalAverage);

      if (percentileChange > 0) {
        setTrendData({ 
          direction: 'up', 
          percentileChange,
          label: `+${percentileChange}`,
          timespan: 'past 90 days'
        });
      } else if (percentileChange < 0) {
        setTrendData({ 
          direction: 'down', 
          percentileChange: Math.abs(percentileChange),
          label: `${percentileChange}`,
          timespan: 'past 90 days'
        });
      } else {
        setTrendData(null);
      }
    } catch (error) {
      console.error('Error calculating trend:', error);
      setTrendData(null);
    }
  };

  const getArrowIcon = () => {
    if (!trendData) return '';
    switch (trendData.direction) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '→';
    }
  };

  const getTrendColor = () => {
    if (!trendData) return color;
    switch (trendData.direction) {
      case 'up': return '#00C85C';
      case 'down': return '#FF6B6B';
      default: return '#8E8E93';
    }
  };

  const handlePress = () => {
    if (!trendData) return;
    
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  if (!trendData) {
    return null;
  }

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.content, { transform: [{ scale: bounceAnim }] }]}>
        <View style={styles.mainRow}>
          <Text style={[styles.arrow, { color: getTrendColor() }]}>
            {getArrowIcon()}
          </Text>
          <Text style={[styles.percentage, { color: getTrendColor() }]}>
            {trendData.label}
          </Text>
        </View>
        <Text style={styles.timespan}>
          {trendData.timespan}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrow: {
    fontSize: 14,
    fontWeight: '600',
  },
  percentage: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
  },
  timespan: {
    fontSize: 10,
    color: '#8E8E93',
    fontFamily: 'Raleway_400Regular',
    marginTop: 2,
    opacity: 0.8,
  },
}); 