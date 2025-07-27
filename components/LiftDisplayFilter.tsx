import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { storageService } from '@/lib/storage';
import { getWorkoutById } from '@/lib/workouts';
import { LiftDisplayFilters, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LiftDisplayFilterProps {
  availableLifts: UserProgress[];
  onFiltersChanged: (filters: LiftDisplayFilters) => void;
}

export default function LiftDisplayFilter({ availableLifts, onFiltersChanged }: LiftDisplayFilterProps) {
  const { currentTheme } = useTheme();
  const { play: playSound } = useSound('pop');
  const [isExpanded, setIsExpanded] = useState(false);
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

  const toggleExpanded = () => {
    playHapticFeedback('selection', false);
    setIsExpanded(!isExpanded);
  };

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
        style={[
          styles.header, 
          { 
            borderBottomColor: currentTheme.colors.border + '30',
          }
        ]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <Ionicons 
            name="options-outline" 
            size={16} 
            color={currentTheme.colors.text + '70'} 
            style={styles.icon}
          />
          <Text style={[
            styles.filterSummary, 
            { 
              color: currentTheme.colors.text + '70',
              fontFamily: 'Raleway_500Medium',
            }
          ]}>
            {getFilterSummary()}
          </Text>
        </View>
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={16} 
          color={currentTheme.colors.text + '70'} 
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
            const workout = getWorkoutById(lift.workoutId);
            const isHidden = filters.hiddenLiftIds.includes(lift.workoutId);
            
            return (
              <TouchableOpacity
                key={lift.workoutId}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isHidden 
                      ? currentTheme.colors.background
                      : currentTheme.colors.primary + '20',
                    borderColor: isHidden 
                      ? currentTheme.colors.border
                      : currentTheme.colors.primary,
                  }
                ]}
                onPress={() => toggleLiftVisibility(lift.workoutId)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterChipText,
                  {
                    color: isHidden 
                      ? currentTheme.colors.text + '60'
                      : currentTheme.colors.primary,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}>
                  {workout?.name || lift.workoutId}
                </Text>
                {isHidden && (
                  <Ionicons 
                    name="eye-off-outline" 
                    size={14} 
                    color={currentTheme.colors.text + '60'}
                    style={styles.chipIcon}
                  />
                )}
              </TouchableOpacity>
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
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 6,
  },
  filterSummary: {
    fontSize: 13,
  },
  filterList: {
    paddingTop: 8,
  },
  filterListContent: {
    paddingHorizontal: 12,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  chipIcon: {
    marginLeft: 3,
  },
}); 