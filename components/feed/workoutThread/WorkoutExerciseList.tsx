import { FeedWorkout } from '@/components/feed/FeedCard';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier } from '@/lib/data/strengthStandards';
import { formatSet } from '@/lib/utils/utils';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface WorkoutExerciseListProps {
  exercises: FeedWorkout['exercises'];
  expandedExercises: Set<number>;
  onToggleExercise: (index: number) => void;
}

export default function WorkoutExerciseList({
  exercises,
  expandedExercises,
  onToggleExercise,
}: WorkoutExerciseListProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={styles.exerciseList}>
      {exercises.map((ex, i) => {
        const isExpanded = expandedExercises.has(i);
        const hasDetailedSets = ex.allSets && ex.allSets.length > 0;

        return (
          <View key={i}>
            <TouchableOpacity
              activeOpacity={hasDetailedSets ? 0.7 : 1}
              onPress={() => hasDetailedSets && onToggleExercise(i)}
              style={[
                styles.exerciseRow,
                !isExpanded && i < exercises.length - 1 && { borderBottomColor: currentTheme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }
              ]}
            >
              <View style={styles.exerciseNameContainer}>
                {hasDetailedSets && (
                  <Ionicons
                    name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                    size={16}
                    color={currentTheme.colors.text + '50'}
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontWeight: '500' }]}>
                  {ex.name}
                </Text>
                {ex.percentile && ex.percentile > 0 && (
                  <TierBadge tier={getStrengthTier(ex.percentile)} size="tiny" showTooltip={false} />
                )}
              </View>
              <View style={styles.exerciseRight}>
                <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '70', fontWeight: '400' }]}>
                  {ex.bestSet}
                </Text>
                {hasDetailedSets && (
                  <Text style={[styles.setCount, { color: currentTheme.colors.text + '40', fontWeight: '400' }]}>
                    {ex.sets} sets
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {isExpanded && hasDetailedSets && (
              <View style={[styles.setsExpanded, { backgroundColor: currentTheme.colors.surface + '50' }]}>
                {ex.allSets!.map((set, setIndex) => (
                  <View
                    key={setIndex}
                    style={[
                      styles.setRow,
                      setIndex < ex.allSets!.length - 1 && { borderBottomColor: currentTheme.colors.border + '30', borderBottomWidth: StyleSheet.hairlineWidth }
                    ]}
                  >
                    <Text style={[styles.setNumber, { color: currentTheme.colors.text + '50', fontWeight: '500' }]}>
                      Set {set.setNumber}
                    </Text>
                    <View style={styles.setDetails}>
                      <Text style={[styles.setWeight, { color: currentTheme.colors.text, fontWeight: '600' }]}>
                        {formatSet(set, { trackingType: ex.trackingType, showUnit: true })}
                      </Text>
                      {set.isPersonalRecord && (
                        <View style={[styles.prBadge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                          <Text style={[styles.prBadgeText, { color: currentTheme.colors.primary, fontWeight: '600' }]}>
                            Best
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {isExpanded && i < exercises.length - 1 && (
              <View style={{ borderBottomColor: currentTheme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  exerciseNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
  },
  exerciseSets: {
    fontSize: 14,
  },
  exerciseRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  setCount: {
    fontSize: 11,
  },
  setsExpanded: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: -4,
    borderRadius: 8,
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  setNumber: {
    fontSize: 13,
    width: 50,
  },
  setDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  setWeight: {
    fontSize: 14,
  },
  prBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  prBadgeText: {
    fontSize: 10,
  },
});
