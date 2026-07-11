import Chip from '@/components/Chip';
import { Text, useInk } from '@/components/Themed';
import { useExpandToggle } from '@/hooks/useExpandToggle';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/utils/haptic';
import { storageService } from '@/lib/storage/storage';
import { space } from '@/lib/ui/tokens';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { LiftDisplayFilters, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface LiftDisplayFilterProps {
  availableLifts: UserProgress[];
  onFiltersChanged: (filters: LiftDisplayFilters) => void;
}

export default function LiftDisplayFilter({ availableLifts, onFiltersChanged }: LiftDisplayFilterProps) {
  const ink = useInk();
  const { play: playSound } = useSound('pop');
  const [filters, setFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      const savedFilters = await storageService.getLiftDisplayFilters();
      setFilters(savedFilters);
    } catch (error) {
      console.error('Error loading lift display filters:', error);
    }
  };

  const [isExpanded, toggleExpanded] = useExpandToggle();

  const toggleLiftVisibility = async (liftId: string) => {
    try {
      playHapticFeedback('selection', false);
      playSound();

      const newHiddenIds = filters.hiddenLiftIds.includes(liftId)
        ? filters.hiddenLiftIds.filter(id => id !== liftId)
        : [...filters.hiddenLiftIds, liftId];

      const newFilters = { ...filters, hiddenLiftIds: newHiddenIds };
      setFilters(newFilters);

      await storageService.saveLiftDisplayFilters(newFilters);
      onFiltersChanged(newFilters);
    } catch (error) {
      console.error('Error updating lift visibility:', error);
    }
  };

  const getVisibleCount = () => {
    return availableLifts.length - filters.hiddenLiftIds.length;
  };

  const getFilterSummary = () => {
    const visibleCount = getVisibleCount();
    const totalCount = availableLifts.length;

    if (visibleCount === totalCount) {
      return `Showing all ${totalCount} lifts`;
    }
    return `Showing ${visibleCount} of ${totalCount} lifts`;
  };

  if (availableLifts.length === 0) {
    return null;
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
        // The row itself is only ~23pt tall; hitSlop brings the effective target ≥44pt.
        hitSlop={12}
      >
        <View style={styles.headerContent}>
          <Ionicons
            name="options-outline"
            size={16}
            color={ink.muted}
            style={styles.icon}
          />
          <Text variant="meta" tone="muted">
            {getFilterSummary()}
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={ink.muted}
        />
      </TouchableOpacity>

      {isExpanded && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterList}
          contentContainerStyle={styles.filterListContent}
        >
          {availableLifts.map((lift) => {
            const workout = getCatalogExercise(lift.workoutId);
            const isHidden = filters.hiddenLiftIds.includes(lift.workoutId);

            return (
              <Chip
                key={lift.workoutId}
                label={workout?.name || lift.workoutId}
                selected={!isHidden}
                onPress={() => toggleLiftVisibility(lift.workoutId)}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.xs
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: space.sm,
  },
  filterList: {
    paddingTop: space.sm,
  },
  filterListContent: {
    paddingHorizontal: space.md,
    gap: space.sm,
  },
});