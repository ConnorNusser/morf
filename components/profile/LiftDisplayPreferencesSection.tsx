import Button from '@/components/Button';
import { useExpandToggle } from '@/hooks/useExpandToggle';
import Card from '@/components/Card';
import { useAlert } from '@/components/CustomAlert';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space, tint } from '@/lib/ui/tokens';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/utils/haptic';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { LiftDisplayFilters, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

interface LiftDisplayPreferencesSectionProps {
  onPreferencesUpdate?: () => Promise<void>;
}

export default function LiftDisplayPreferencesSection({ onPreferencesUpdate }: LiftDisplayPreferencesSectionProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { showAlert } = useAlert();
  const { play: playSound } = useSound('pop');
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

  const [isExpanded, toggleExpanded] = useExpandToggle();

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
    <Card style={styles.card}>
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderContent}>
          <Text variant="title" weight="bold" tone="primary">
            Lift Display Preferences
          </Text>
          {!isExpanded && (
            <Text variant="meta" style={styles.subtitle}>
              {getPreferencesSummary()}
            </Text>
          )}
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={ink.primary}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <Text variant="meta" tone="secondary" style={styles.description}>
            {"Choose which lifts to display in your \"Your Lifts\" section on the main dashboard."}
          </Text>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: tint(currentTheme.colors.primary) }]}
              onPress={showAllLifts}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={16} color={currentTheme.colors.primary} />
              <Text variant="meta">
                Show All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: ink.hairline }]}
              onPress={hideAllLifts}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-off-outline" size={16} color={ink.secondary} />
              <Text variant="meta" tone="secondary">
                Hide All
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.liftsList} showsVerticalScrollIndicator={false}>
            {availableLifts.map((lift) => {
              const workout = getCatalogExercise(lift.workoutId);
              const isHidden = filters.hiddenLiftIds.includes(lift.workoutId);
              
              return (
                <TouchableOpacity
                  key={lift.workoutId}
                  style={[
                    styles.liftItem,
                    {
                      // Shown = faint primary tint, hidden = plain surface; both keep a full-alpha border to read as tappable on the flat page.
                      backgroundColor: isHidden
                        ? currentTheme.colors.surface
                        : tint(currentTheme.colors.primary),
                      borderColor: isHidden
                        ? currentTheme.colors.border
                        : currentTheme.colors.primary,
                    }
                  ]}
                  onPress={() => toggleLiftVisibility(lift.workoutId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.liftInfo}>
                    <Text
                      variant="body"
                      tone={isHidden ? 'faint' : 'primary'}
                      style={styles.liftName}
                    >
                      {workout?.name || lift.workoutId}
                    </Text>
                    <Text variant="meta" tone={isHidden ? 'faint' : 'secondary'}>
                      {lift.strengthLevel} • {lift.percentileRanking}th percentile
                    </Text>
                  </View>

                  <Ionicons
                    name={isHidden ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={isHidden ? ink.faint : currentTheme.colors.primary}
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
    gap: space.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  subtitle: {
    opacity: 0.8,
    marginTop: space.xs,
  },
  expandedContent: {
    paddingTop: space.md,
    gap: space.lg,
  },
  description: {
    lineHeight: 18,
  },
  quickActions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    gap: space.xs,
  },
  liftsList: {
    maxHeight: 280,
  },
  liftItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space.md,
    marginBottom: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  liftInfo: {
    flex: 1,
  },
  liftName: {
    marginBottom: space.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: space.md,
  },
  resetButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
});