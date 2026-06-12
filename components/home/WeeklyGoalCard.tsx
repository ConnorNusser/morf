import { useTheme } from '@/contexts/ThemeContext';
import { MUSCLE_TO_PPL, PPL_COLORS, PPLCategory } from '@/lib/data/pplCategories';
import { storageService } from '@/lib/storage/storage';
import { getWorkoutById } from '@/lib/workout/workouts';
import {
  DEFAULT_WEEKLY_GOAL,
  getWeekProgress,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
} from '@/lib/workout/weeklyGoal';
import { GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Monday-start

// Dominant Push/Pull/Legs category for a day's workouts, by majority of each
// exercise's primary muscle. Null when nothing categorizable was logged.
function dominantPPL(workouts: GeneratedWorkout[]): PPLCategory | null {
  const counts: Record<PPLCategory, number> = { push: 0, pull: 0, legs: 0 };
  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      const muscle = getWorkoutById(exercise.id)?.primaryMuscles?.[0];
      const category = muscle ? MUSCLE_TO_PPL[muscle] : undefined;
      if (category) counts[category]++;
    }
  }
  if (counts.push + counts.pull + counts.legs === 0) return null;
  return (['push', 'pull', 'legs'] as PPLCategory[]).reduce((best, c) =>
    counts[c] > counts[best] ? c : best
  );
}

// Accent once the weekly goal is met — the same gold as a "legendary" Career
// badge, so hitting a goal reads as the same kind of win across both surfaces.
const GOAL_MET_COLOR = '#F59E0B';

// Selectable goal values (1..7).
const GOAL_OPTIONS = Array.from(
  { length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 },
  (_, i) => WEEKLY_GOAL_MIN + i
);

export default function WeeklyGoalCard() {
  const { currentTheme } = useTheme();
  const [history, setHistory] = useState<GeneratedWorkout[] | null>(null);
  const [goal, setGoal] = useState(DEFAULT_WEEKLY_GOAL);
  const [picking, setPicking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([storageService.getWorkoutHistory(), storageService.getWeeklyGoal()]).then(
        ([h, g]) => {
          if (!active) return;
          setHistory(h);
          setGoal(g);
        }
      );
      return () => {
        active = false;
      };
    }, [])
  );

  const progress = useMemo(
    () => (history ? getWeekProgress(history, goal) : null),
    [history, goal]
  );

  const selectGoal = useCallback((next: number) => {
    setGoal(next);
    storageService.saveWeeklyGoal(next);
    setPicking(false);
  }, []);

  if (!progress) return null;

  const { daysTrained, metGoal, trainedDays, workoutsByDay } = progress;

  // Celebrate once the goal is reached: the count takes the accent color.
  const achieved = daysTrained >= goal;
  const accent = achieved ? GOAL_MET_COLOR : currentTheme.colors.primary;

  // Each trained dot is colored by that day's Push/Pull/Legs category.
  const dayColors = workoutsByDay.map(day => {
    const category = dominantPPL(day);
    return category ? PPL_COLORS[category] : currentTheme.colors.primary;
  });

  return (
    <>
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border },
      ]}
      activeOpacity={0.85}
      onPress={() => setPicking(true)}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>
          This week
        </Text>

        <View style={styles.goalButton}>
          {metGoal && <Ionicons name="checkmark" size={15} color={accent} />}
          <Text style={[styles.count, { color: achieved ? accent : currentTheme.colors.text + '99' }]}>
            {daysTrained}/{goal}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '70'} />
        </View>
      </View>

      <View style={styles.dotRow}>
        {trainedDays.map((trained, i) => (
          <View key={i} style={styles.dayColumn}>
            <View
              style={[
                styles.dot,
                trained
                  ? { backgroundColor: dayColors[i], borderColor: dayColors[i] }
                  : { backgroundColor: 'transparent', borderColor: currentTheme.colors.border },
              ]}
            />
            <Text style={[styles.dayLabel, { color: currentTheme.colors.text }]}>{DAY_LABELS[i]}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>

      <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPicking(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: currentTheme.colors.background }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                Weekly goal
              </Text>
              <TouchableOpacity onPress={() => setPicking(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={currentTheme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sheetSubtitle, { color: currentTheme.colors.text }]}>
              How many days a week do you want to train?
            </Text>

            <View style={styles.optionsRow}>
              {GOAL_OPTIONS.map(value => {
                const selected = value === goal;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => selectGoal(value)}
                    activeOpacity={0.8}
                    style={[
                      styles.option,
                      selected
                        ? { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.primary }
                        : { backgroundColor: 'transparent', borderColor: currentTheme.colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: selected ? currentTheme.colors.surface : currentTheme.colors.text,
                          fontFamily: currentTheme.fonts.semiBold,
                        },
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  goalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  count: {
    fontSize: 15,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  dayLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 20,
  },
  sheetSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
    marginBottom: 18,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  option: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 16,
  },
});
