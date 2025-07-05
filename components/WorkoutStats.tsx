import Card from '@/components/Card';
import { Text } from '@/components/Themed';
import { ActiveWorkoutSession } from '@/types';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface WorkoutStatsProps {
  session: ActiveWorkoutSession;
  themeColors: any;
  isExpanded: boolean;
  onToggle: () => void;
}

export const WorkoutStats: React.FC<WorkoutStatsProps> = ({
  session,
  themeColors,
  isExpanded,
  onToggle
}) => {
  const duration = Math.round((Date.now() - session.startTime.getTime()) / (1000 * 60));
  const totalSets = session.exercises.reduce((total, ex) => total + ex.completedSets.length, 0);
  const totalVolume = Math.round(session.exercises.reduce((total, ex) => {
    return total + ex.completedSets.reduce((setTotal, set) => {
      return setTotal + (set.weight * set.reps);
    }, 0);
  }, 0) / 1000);

  return (
    <Card style={styles.statsCard} variant="subtle">
      <Pressable onPress={onToggle} style={[styles.statsHeader, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.statsTitle, { color: themeColors.text }]}>
          Workout Stats
        </Text>
        <Text style={[styles.expandIcon, { color: themeColors.text }]}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </Pressable>
      
      {isExpanded && (
        <View style={[styles.statsContent, { backgroundColor: 'transparent' }]}>
          <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.statValue, { color: themeColors.primary }]}>{duration}m</Text>
            <Text style={[styles.statLabel, { color: themeColors.text }]}>Duration</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.statValue, { color: themeColors.accent }]}>{totalSets}</Text>
            <Text style={[styles.statLabel, { color: themeColors.text }]}>Sets</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.statValue, { color: themeColors.text }]}>{totalVolume}k</Text>
            <Text style={[styles.statLabel, { color: themeColors.text }]}>Volume</Text>
          </View>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  statsCard: {
    marginBottom: 12,
    padding: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  expandIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 