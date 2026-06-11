import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage/storage';
import { getStreakState, StreakState } from '@/lib/workout/retentionSignals';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StreakBanner() {
  const { currentTheme } = useTheme();
  const [streak, setStreak] = useState<StreakState>({ current: 0, trainedToday: false });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      storageService.getWorkoutHistory().then(history => {
        if (active) setStreak(getStreakState(history));
      });
      return () => {
        active = false;
      };
    }, [])
  );

  // Nothing to celebrate or protect yet — stay out of the way.
  if (streak.current === 0) return null;

  const flameColor = streak.trainedToday ? currentTheme.colors.primary : currentTheme.colors.text + '80';
  const message = streak.trainedToday
    ? `${streak.current}-day streak — locked in for today`
    : `${streak.current}-day streak — train today to keep it`;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border },
      ]}
    >
      <Ionicons name="flame" size={20} color={flameColor} />
      <Text style={[styles.text, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
    flex: 1,
  },
});
