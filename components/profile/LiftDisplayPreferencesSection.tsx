import Button from '@/components/Button';
import Card from '@/components/Card';
import { useAlert } from '@/components/CustomAlert';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/utils/haptic';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { getWorkoutById } from '@/lib/workout/workouts';
import { LiftDisplayFilters, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

interface LiftDisplayPreferencesSectionProps {
  onPreferencesUpdate?: () => Promise<void>;
}

export default function LiftDisplayPreferencesSection({ onPreferencesUpdate }: LiftDisplayPreferencesSectionProps) {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const { play: playSound } = useSound('pop');
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });
  const [availableLifts, setAvailableLifts] = useState<UserProgress[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [savedFilters, liftsData] = await Promise.all([
        storageService.getLiftDisplayFilters(),
        userService.getAllFeaturedLifts()
      ]);
      setFilters(savedFilters);
      setAvailableLifts(liftsData);
    } catch (error) {
      console.error('Error loading lift display preferences:', error);
    }
  };

  const toggleExpanded = () => {
    playHapticFeedback('selection', false);
    setIsExpanded(!isExpanded);
  };

  const getPreferencesSummary = () => {
    const hiddenCount = filters.hiddenLiftIds.length;
    const totalCount = availableLifts.length;
    const visibleCount = totalCount - hiddenCount;
    
    if (hiddenCount === 0) {
      return `Showing all ${totalCount} lifts`;
    }
    return `${hiddenCount} lifts hidden • ${visibleCount} visible`;
  };

  const toggleLiftVisibility = (liftId: string) => {
    playHapticFeedback('selection', false);
    playSound();

    const newHiddenIds = filters.hiddenLiftIds.includes(liftId)
      ? filters.hiddenLiftIds.filter(id => id !== liftId)
      : [...filters.hiddenLiftIds, liftId];

    setFilters({ ...filters, hiddenLiftIds: newHiddenIds });
    setHasUnsavedChanges(true);
  };

  const showAllLifts = () => {
    playHapticFeedback('selection', false);
    playSound();
    setFilters({ hiddenLiftIds: [] });
    setHasUnsavedChanges(true);
  };

  const hideAllLifts = () => {
    playHapticFeedback('selection', false);
    playSound();
    const allLiftIds = availableLifts.map(lift => lift.workoutId);
    setFilters({ hiddenLiftIds: allLiftIds });
    setHasUnsavedChanges(true);
  };

  const savePreferences = async () => {
    try {
      await storageService.saveLiftDisplayFilters(filters);
      setHasUnsavedChanges(false);
      if (onPreferencesUpdate) {
        await onPreferencesUpdate();
      }
      showAlert({
        title: 'Preferences Saved',
        message: 'Your lift display preferences have been updated',
        type: 'success',
      });
    } catch (error) {
      console.error('Error saving lift display preferences:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to save preferences',
        type: 'error',
      });
    }
  };

  const resetToDefaults = () => {
    showAlert({
      title: 'Reset Preferences',
      message: 'This will show all lifts. Are you sure?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setFilters({ hiddenLiftIds: [] });
            setHasUnsavedChanges(true);
          }
        },
      ],
    });
  };

  return (
    <Card style={styles.card} variant="clean">
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionHeaderContent, { backgroundColor: 'transparent' }]}>
          <Text style={[
            styles.sectionTitle, 
            { 
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
            }
          ]}>
            Lift Display Preferences
          </Text>
          {!isExpanded && (
            <Text style={[
              styles.subtitle, 
              { 
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              {getPreferencesSummary()}
            </Text>
          )}
        </View>
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={currentTheme.colors.text} 
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <Text style={[
            styles.description,
            {
              color: currentTheme.colors.text + '70',
              fontFamily: 'Raleway_400Regular',
            }
          ]}>
            {"Choose which lifts to display in your \"Your Lifts\" section on the main dashboard."}
          </Text>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
              onPress={showAllLifts}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={16} color={currentTheme.colors.primary} />
              <Text style={[styles.quickActionText, { color: currentTheme.colors.primary }]}>
                Show All
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: currentTheme.colors.text + '10' }]}
              onPress={hideAllLifts}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-off-outline" size={16} color={currentTheme.colors.text + '70'} />
              <Text style={[styles.quickActionText, { color: currentTheme.colors.text + '70' }]}>
                Hide All
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.liftsList} showsVerticalScrollIndicator={false}>
            {availableLifts.map((lift) => {
              const workout = getWorkoutById(lift.workoutId);
              const isHidden = filters.hiddenLiftIds.includes(lift.workoutId);
              
              return (
                <TouchableOpacity
                  key={lift.workoutId}
                  style={[
                    styles.liftItem,
                    {
                      backgroundColor: isHidden 
                        ? currentTheme.colors.background
                        : currentTheme.colors.primary + '08',
                      borderColor: currentTheme.colors.border + '30',
                    }
                  ]}
                  onPress={() => toggleLiftVisibility(lift.workoutId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.liftInfo}>
                    <Text style={[
                      styles.liftName,
                      {
                        color: isHidden 
                          ? currentTheme.colors.text + '50'
                          : currentTheme.colors.text,
                        fontFamily: 'Raleway_600SemiBold',
                      }
                    ]}>
                      {workout?.name || lift.workoutId}
                    </Text>
                    <Text style={[
                      styles.liftStats,
                      {
                        color: isHidden 
                          ? currentTheme.colors.text + '40'
                          : currentTheme.colors.text + '70',
                        fontFamily: 'Raleway_400Regular',
                      }
                    ]}>
                      {lift.strengthLevel} • {lift.percentileRanking}th percentile
                    </Text>
                  </View>
                  
                  <Ionicons 
                    name={isHidden ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color={isHidden 
                      ? currentTheme.colors.text + '40'
                      : currentTheme.colors.primary
                    }
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.actionButtons}>
            <Button
              title="Reset to Default"
              onPress={resetToDefaults}
              variant="secondary"
              size="small"
              hapticType="medium"
              soundName="pop"
              style={styles.resetButton}
            />
            
            <Button
              title={hasUnsavedChanges ? "Save Changes" : "Saved"}
              onPress={savePreferences}
              variant="primary"
              size="small"
              hapticType="heavy"
              soundName="notification"
              disabled={!hasUnsavedChanges}
              style={styles.saveButton}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  expandedContent: {
    paddingTop: 12,
    gap: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 18,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  quickActionText: {
    fontSize: 13,
    fontFamily: 'Raleway_500Medium',
  },
  liftsList: {
    maxHeight: 280,
  },
  liftItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  liftInfo: {
    flex: 1,
  },
  liftName: {
    fontSize: 15,
    marginBottom: 2,
  },
  liftStats: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  resetButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
}); 