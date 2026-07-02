import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { calculateRecapStats, MuscleDistribution } from '@/lib/workout/recapStats';

interface MuscleFocusWidgetProps {
  onPress?: () => void;
}

export default function MuscleFocusWidget({ onPress }: MuscleFocusWidgetProps) {
  const { currentTheme } = useTheme();
  const [muscles, setMuscles] = useState<MuscleDistribution[]>([]);

  const loadMuscleData = useCallback(async () => {
    try {
      const stats = await calculateRecapStats('week', new Date());
      setMuscles(stats.muscleGroupDistribution.slice(0, 4));
    } catch (error) {
      console.error('Error loading muscle data:', error);
    }
  }, []);

  // Refresh whenever History regains focus (e.g. after logging a workout), matching
  // the parent screen's useFocusEffect — otherwise this week's focus stays stale while
  // the workout list and quick stats update around it.
  useFocusEffect(
    useCallback(() => {
      loadMuscleData();
    }, [loadMuscleData])
  );

  if (muscles.length === 0) {
    return null;
  }

  const topMuscle = muscles[0];

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
      onPress={onPress}
      // Without an onPress handler this widget is purely informational — disable
      // the press so it doesn't show a misleading tap affordance.
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <RNView style={styles.header}>
        <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
          {"This Week's Focus"}
        </Text>
        <Text style={[styles.topMuscle, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.medium }]}>
          {topMuscle.group}
        </Text>
      </RNView>

      <RNView style={styles.barsContainer}>
        {muscles.map((muscle, index) => (
          <RNView key={index} style={styles.barRow}>
            <Text style={[styles.muscleName, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.medium }]}>
              {muscle.group}
            </Text>
            <RNView style={[styles.barBackground, { backgroundColor: currentTheme.colors.border }]}>
              <RNView
                style={[
                  styles.barFill,
                  {
                    width: `${muscle.percentage}%`,
                    backgroundColor: index === 0 ? currentTheme.colors.primary : currentTheme.colors.primary + '60',
                  },
                ]}
              />
            </RNView>
            <Text style={[styles.percentage, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.medium }]}>
              {muscle.percentage}%
            </Text>
          </RNView>
        ))}
      </RNView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 14,
  },
  topMuscle: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  barsContainer: {
    gap: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  muscleName: {
    fontSize: 12,
    width: 70,
    textTransform: 'capitalize',
  },
  barBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 12,
    width: 35,
    textAlign: 'right',
  },
});
