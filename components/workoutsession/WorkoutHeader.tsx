import { Text, View } from '@/components/Themed';
import { Theme } from '@/lib/theme';
import React from 'react';
import { StyleSheet } from 'react-native';

interface WorkoutHeaderProps {
  title: string;
  workoutTime: string;
  themeColors: Theme['colors'];
}

export default function WorkoutHeader({ title, workoutTime, themeColors }: WorkoutHeaderProps) {
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Text style={[styles.title, { color: themeColors.text }]}>
        {title}
      </Text>
      <View style={[styles.meta, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.date, { color: themeColors.text, opacity: 0.7 }]}>
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        <Text style={[styles.timer, { color: themeColors.primary }]}>
          {workoutTime}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  date: {
    fontSize: 14,
  },
  timer: {
    fontSize: 14,
    fontWeight: 'bold',
  },
}); 