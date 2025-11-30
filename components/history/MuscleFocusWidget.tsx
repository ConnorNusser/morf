import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { calculateRecapStats, MuscleDistribution } from '@/lib/recapStats';

interface MuscleFocusWidgetProps {
  onPress?: () => void;
}

export default function MuscleFocusWidget({ onPress }: MuscleFocusWidgetProps) {
  const { currentTheme } = useTheme();
  const [muscles, setMuscles] = useState<MuscleDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMuscleData();
  }, []);

  const loadMuscleData = async () => {
    try {
      const stats = await calculateRecapStats('week', new Date());
      setMuscles(stats.muscleGroupDistribution.slice(0, 4));
    } catch (error) {
      console.error('Error loading muscle data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || muscles.length === 0) {
    return null;
  }

  const topMuscle = muscles[0];

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <RNView style={styles.header}>
        <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
          This Week's Focus
        </Text>
        <Text style={[styles.topMuscle, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
          {topMuscle.group}
        </Text>
      </RNView>

      <RNView style={styles.barsContainer}>
        {muscles.map((muscle, index) => (
          <RNView key={index} style={styles.barRow}>
            <Text style={[styles.muscleName, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_500Medium' }]}>
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
            <Text style={[styles.percentage, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
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
