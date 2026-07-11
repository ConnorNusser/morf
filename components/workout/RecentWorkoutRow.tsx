import { Text, useInk } from '@/components/Themed';
import { radius, space, track } from '@/lib/ui/tokens';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { LoggedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface RecentWorkoutRowProps {
  workout: LoggedWorkout;
  onPress: () => void;
  /** Draw a hairline above the row (for all but the first in a list). */
  separator?: boolean;
  /** Cap the exercise list (Home's compact card); omit for the full list. */
  maxExercises?: number;
}

function dateLabel(value: Date | string): string {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// "Repeat a past session" row, shared by the Workout tab's recent list and Home's Today card.
function RecentWorkoutRow({ workout, onPress, separator = false, maxExercises }: RecentWorkoutRowProps) {
  const ink = useInk();
  const names = (workout.exercises || []).map(e => getExercise(e.id)?.name || e.id);
  const shown = maxExercises ? names.slice(0, maxExercises) : names;
  const hidden = names.length - shown.length;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        separator && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: ink.hairline,
        },
      ]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <View style={styles.text}>
        <Text variant="meta" tone="secondary" style={styles.date}>
          {dateLabel(workout.createdAt)}
        </Text>
        {shown.map((name, i) => (
          <Text key={i} variant="body" tone="primary" numberOfLines={1}>
            {name}
          </Text>
        ))}
        {shown.length === 0 && (
          <Text variant="body" tone="primary">Workout</Text>
        )}
        {hidden > 0 && (
          <Text variant="meta" tone="muted">
            +{hidden} more
          </Text>
        )}
      </View>
      <View style={styles.action}>
        <Text variant="meta" tone="secondary" weight="semiBold">
          Repeat
        </Text>
        <View style={[styles.arrowChip, { backgroundColor: ink.hairline }]}>
          <Ionicons name="arrow-forward" size={16} color={ink.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(RecentWorkoutRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.lg,
  },
  text: {
    flex: 1,
    gap: space.xs,
  },
  date: {
    textTransform: 'uppercase',
    letterSpacing: track.caps,
    marginBottom: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  arrowChip: {
    width: 30,
    height: 30,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
