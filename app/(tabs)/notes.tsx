import { useAlert } from '@/components/CustomAlert';
import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial/TutorialTarget';
import RoutineEditorModal from '@/components/workout/RoutineEditorModal';
import RoutineGeneratorModal from '@/components/workout/RoutineGeneratorModal';
import { generateRoutineText } from '@/components/workout/RoutineImportModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { setPendingRoutine } from '@/lib/workout/pendingRoutine';
import { calculateAllRoutines } from '@/lib/workout/progressiveOverload';
import { getWorkoutById } from '@/lib/workout/workouts';
import { layout } from '@/lib/ui/styles';
import { CalculatedRoutine, GeneratedWorkout, Routine, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';

// Get muscle groups from routine exercises - simplified, no colors
const getMuscleGroups = (routine: CalculatedRoutine): string[] => {
  const muscleCounts: Record<string, number> = {};

  for (const exercise of routine.exercises || []) {
    const workoutInfo = getWorkoutById(exercise.exerciseId);
    if (workoutInfo?.primaryMuscles) {
      for (const muscle of workoutInfo.primaryMuscles) {
        const normalized = muscle.toLowerCase();
        muscleCounts[normalized] = (muscleCounts[normalized] || 0) + 1;
      }
    }
  }

  // Sort by count and return top 3 muscle names
  return Object.entries(muscleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([muscle]) => muscle.charAt(0).toUpperCase() + muscle.slice(1));
};

export default function NotesScreen() {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const { userProfile } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Routines state
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<GeneratedWorkout[]>([]);
  const [showRoutineEditor, setShowRoutineEditor] = useState(false);
  const [showRoutineGenerator, setShowRoutineGenerator] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // User's weight unit preference
  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';

  // Load routines and workout history
  const loadData = useCallback(async () => {
    try {
      const [loadedRoutines, history] = await Promise.all([
        storageService.getRoutines(),
        storageService.getWorkoutHistory(),
      ]);
      // Sort by most recently used, then by created date
      const sorted = loadedRoutines.sort((a, b) => {
        if (a.lastUsed && b.lastUsed) {
          return b.lastUsed.getTime() - a.lastUsed.getTime();
        }
        if (a.lastUsed) return -1;
        if (b.lastUsed) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      setRoutines(sorted);
      setWorkoutHistory(history);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  // Load data on mount and focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Calculate routines with progressive overload
  const calculatedRoutines = useMemo(() => {
    return calculateAllRoutines(routines, workoutHistory, weightUnit);
  }, [routines, workoutHistory, weightUnit]);

  // Separate active and inactive routines
  const { activeRoutines, inactiveRoutines } = useMemo(() => {
    const active: CalculatedRoutine[] = [];
    const inactive: CalculatedRoutine[] = [];

    for (const routine of calculatedRoutines) {
      // Default to active if isActive is undefined
      if (routine.isActive === false) {
        inactive.push(routine);
      } else {
        active.push(routine);
      }
    }

    return { activeRoutines: active, inactiveRoutines: inactive };
  }, [calculatedRoutines]);

  // Get "Up Next" routine - the least recently used active routine
  const upNextRoutine = useMemo(() => {
    if (activeRoutines.length === 0) return null;

    // Sort active routines by lastUsed (oldest first) or never used
    const sorted = [...activeRoutines].sort((a, b) => {
      // Never used routines come first
      if (!a.lastUsed && !b.lastUsed) return 0;
      if (!a.lastUsed) return -1;
      if (!b.lastUsed) return 1;
      return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
    });

    return sorted[0];
  }, [activeRoutines]);

  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const d = new Date(date);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDeleteRoutine = useCallback((routineId: string, routineName: string) => {
    showAlert({
      title: 'Delete Routine',
      message: `Are you sure you want to delete "${routineName}"?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storageService.deleteRoutine(routineId);
            await loadData();
          },
        },
      ],
    });
  }, [loadData, showAlert]);

  const handleToggleActive = useCallback(async (routine: Routine) => {
    const isCurrentlyActive = routine.isActive !== false;
    const updated: Routine = {
      ...routine,
      isActive: !isCurrentlyActive,
    };
    await storageService.saveRoutine(updated);
    await loadData();
  }, [loadData]);

  const handleCreateRoutine = useCallback(() => {
    setEditingRoutine(null);
    setShowRoutineEditor(true);
  }, []);

  const handleEditRoutine = useCallback((routine: Routine) => {
    setEditingRoutine(routine);
    setShowRoutineEditor(true);
  }, []);

  const handleRoutineEditorClose = useCallback(() => {
    setShowRoutineEditor(false);
    setEditingRoutine(null);
  }, []);

  const handleRoutineEditorSave = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const handleStartWorkout = useCallback(async (routine: CalculatedRoutine) => {
    const text = generateRoutineText(routine);
    await storageService.updateRoutineLastUsed(routine.id);
    setPendingRoutine(text);
    router.push('/workout');
  }, [router]);

  const toggleRoutineExpanded = useCallback((routineId: string) => {
    setExpandedRoutineId(prev => prev === routineId ? null : routineId);
  }, []);

  // Filter routines based on search query
  const filteredActiveRoutines = useMemo(() => {
    if (!searchQuery.trim()) return activeRoutines;
    const query = searchQuery.toLowerCase();
    return activeRoutines.filter(r =>
      r.name.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query) ||
      r.exercises.some(e => e.exerciseName.toLowerCase().includes(query))
    );
  }, [activeRoutines, searchQuery]);

  const filteredInactiveRoutines = useMemo(() => {
    if (!searchQuery.trim()) return inactiveRoutines;
    const query = searchQuery.toLowerCase();
    return inactiveRoutines.filter(r =>
      r.name.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query) ||
      r.exercises.some(e => e.exerciseName.toLowerCase().includes(query))
    );
  }, [inactiveRoutines, searchQuery]);

  // Get progression color
  const getProgressionColor = (progression: 'increase' | 'maintain' | 'decrease') => {
    switch (progression) {
      case 'increase': return '#34C759';
      case 'decrease': return '#FF3B30';
      default: return currentTheme.colors.text + '60';
    }
  };

  // Get progression icon
  const getProgressionIcon = (progression: 'increase' | 'maintain' | 'decrease') => {
    switch (progression) {
      case 'increase': return 'trending-up';
      case 'decrease': return 'trending-down';
      default: return 'remove';
    }
  };

  const renderRoutineCard = (routine: CalculatedRoutine, isUpNext = false) => {
    const isExpanded = expandedRoutineId === routine.id;
    const isActive = routine.isActive !== false;
    const muscleGroups = getMuscleGroups(routine);
    const exerciseCount = routine.exercises?.length || 0;

    return (
      <TouchableOpacity
        key={routine.id}
        style={[
          styles.routineCard,
          { backgroundColor: currentTheme.colors.surface },
          isUpNext && styles.upNextCard,
        ]}
        onPress={() => toggleRoutineExpanded(routine.id)}
        activeOpacity={0.7}
      >
        {/* Card Content */}
        <RNView style={styles.cardContent}>
          {/* Left: Info */}
          <RNView style={styles.cardInfo}>
            <RNView style={styles.routineNameRow}>
              <Text
                style={[
                  styles.routineName,
                  { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold },
                  !isActive && { opacity: 0.5 }
                ]}
                numberOfLines={1}
              >
                {routine.name}
              </Text>
              {!isActive && (
                <RNView style={[styles.pausedBadge, { backgroundColor: currentTheme.colors.text + '15' }]}>
                  <Ionicons name="pause" size={10} color={currentTheme.colors.text + '50'} />
                </RNView>
              )}
            </RNView>
            <Text style={[styles.routineSubtitle, { color: currentTheme.colors.text + '70', fontFamily: currentTheme.fonts.regular }]}>
              {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
              {muscleGroups.length > 0 && ` · ${muscleGroups.join(', ')}`}
            </Text>
            <Text style={[styles.routineDate, { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.regular }]}>
              {routine.lastUsed ? formatRelativeDate(routine.lastUsed) : `Created ${formatRelativeDate(routine.createdAt)}`}
            </Text>
          </RNView>

          {/* Right: Start button */}
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: isActive ? currentTheme.colors.primary : currentTheme.colors.text + '30' }
            ]}
            onPress={(e) => {
              e.stopPropagation();
              handleStartWorkout(routine);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.startButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>Start</Text>
          </TouchableOpacity>
        </RNView>

        {/* Expand hint - only when collapsed */}
        {!isExpanded && (
          <RNView style={styles.expandHint}>
            <Text style={[styles.expandHintText, { color: currentTheme.colors.text + 'B3', fontFamily: currentTheme.fonts.medium }]}>
              See details
            </Text>
            <Ionicons name="chevron-down" size={12} color={currentTheme.colors.text + 'B3'} />
          </RNView>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <RNView style={styles.expandedContent}>
            {/* Exercise List */}
            {routine.exercises?.length > 0 && (
              <RNView style={[styles.exerciseList, { borderTopColor: currentTheme.colors.border }]}>
                {routine.exercises.map((exercise, index) => (
                  <RNView
                    key={`${exercise.exerciseId}-${index}`}
                    style={styles.exerciseRow}
                  >
                    <RNView style={styles.exerciseInfo}>
                      <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                        {exercise.exerciseName}
                      </Text>
                      <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                        {exercise.sets?.length || 0} sets × {exercise.sets?.[0]?.reps || 0} reps
                      </Text>
                    </RNView>

                    <RNView style={styles.weightInfo}>
                      {exercise.workingWeight > 0 ? (
                        <RNView style={styles.weightRow}>
                          <Text style={[styles.weightValue, { color: currentTheme.colors.text + '90', fontFamily: currentTheme.fonts.medium }]}>
                            {exercise.workingWeight} {exercise.unit}
                          </Text>
                          <Ionicons
                            name={getProgressionIcon(exercise.progression)}
                            size={12}
                            color={getProgressionColor(exercise.progression)}
                            style={{ marginLeft: 4 }}
                          />
                        </RNView>
                      ) : (
                        <Text style={[styles.noDataText, { color: currentTheme.colors.text + '30', fontFamily: currentTheme.fonts.regular }]}>
                          —
                        </Text>
                      )}
                    </RNView>
                  </RNView>
                ))}
              </RNView>
            )}

            {/* Action Row */}
            <RNView style={[styles.actionRow, { borderTopColor: currentTheme.colors.border }]}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={(e) => {
                  e.stopPropagation();
                  handleEditRoutine(routine);
                }}
              >
                <Ionicons name="pencil-outline" size={18} color={currentTheme.colors.text + '60'} />
                <Text style={[styles.actionText, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                  Edit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={(e) => {
                  e.stopPropagation();
                  handleToggleActive(routine);
                }}
              >
                <Ionicons
                  name={isActive ? 'pause-circle' : 'play-circle'}
                  size={18}
                  color={isActive ? '#FF9500' : '#34C759'}
                />
                <Text style={[styles.actionText, { color: isActive ? '#FF9500' : '#34C759', fontFamily: currentTheme.fonts.regular }]}>
                  {isActive ? 'Pause' : 'Resume'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteRoutine(routine.id, routine.name);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#FF453A" />
                <Text style={[styles.actionText, { color: '#FF453A', fontFamily: currentTheme.fonts.regular }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </RNView>
          </RNView>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <RNView style={styles.header}>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
          Routines
        </Text>
        <RNView style={styles.headerActions}>
          <TutorialTarget id="notes-ai-button">
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: currentTheme.colors.surface }]}
              onPress={() => setShowRoutineGenerator(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={18} color={currentTheme.colors.primary} />
            </TouchableOpacity>
          </TutorialTarget>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: currentTheme.colors.surface }]}
            onPress={handleCreateRoutine}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={currentTheme.colors.text} />
          </TouchableOpacity>
        </RNView>
      </RNView>

      {/* Content */}
      <ScrollView
        style={layout.flex1}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={currentTheme.colors.primary} />}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {routines.length > 0 ? (
          <>
            {/* Search Bar */}
            <RNView style={[styles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
              <Ionicons name="search" size={16} color={currentTheme.colors.text + '40'} />
              <TextInput
                style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}
                placeholder="Search routines"
                placeholderTextColor={currentTheme.colors.text + '30'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={16} color={currentTheme.colors.text + '30'} />
                </TouchableOpacity>
              )}
            </RNView>

            {/* Up Next Section */}
            {upNextRoutine && !searchQuery && (
              <RNView style={styles.section}>
                <Text style={[styles.sectionLabel, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                  UP NEXT
                </Text>
                <TutorialTarget id="notes-routine-card">
                  {renderRoutineCard(upNextRoutine, true)}
                </TutorialTarget>
              </RNView>
            )}

            {/* Active Routines Section */}
            {filteredActiveRoutines.filter(r => searchQuery || r.id !== upNextRoutine?.id).length > 0 && (
              <RNView style={styles.section}>
                {!searchQuery && (
                  <RNView style={styles.sectionHeader}>
                    <Text style={[styles.sectionLabel, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.semiBold, marginBottom: 0 }]}>
                      YOUR ROUTINES
                    </Text>
                    <RNView style={styles.activeCountBadge}>
                      <RNView style={styles.activeCountDot} />
                      <Text style={[styles.activeCountText, { fontFamily: currentTheme.fonts.semiBold }]}>
                        {activeRoutines.length} active
                      </Text>
                    </RNView>
                  </RNView>
                )}
                {filteredActiveRoutines
                  .filter(r => searchQuery || r.id !== upNextRoutine?.id)
                  .map((routine) => renderRoutineCard(routine))}
              </RNView>
            )}

            {/* No search results */}
            {searchQuery && filteredActiveRoutines.length === 0 && filteredInactiveRoutines.length === 0 && (
              <RNView style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.medium }]}>
                  No routines match "{searchQuery}"
                </Text>
              </RNView>
            )}

            {/* Paused Routines Section */}
            {inactiveRoutines.length > 0 && (
              <RNView style={styles.section}>
                <TouchableOpacity
                  style={styles.archivedHeader}
                  onPress={() => setShowInactive(!showInactive)}
                  activeOpacity={0.7}
                >
                  <RNView style={styles.pausedHeaderContent}>
                    <Ionicons name="pause-circle" size={14} color={currentTheme.colors.text + '60'} />
                    <Text style={[styles.sectionLabel, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.semiBold, marginBottom: 0 }]}>
                      PAUSED ({inactiveRoutines.length})
                    </Text>
                  </RNView>
                  <Ionicons
                    name={showInactive ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={currentTheme.colors.text + '60'}
                  />
                </TouchableOpacity>

                {showInactive && filteredInactiveRoutines.map((routine) => renderRoutineCard(routine))}
              </RNView>
            )}
          </>
        ) : (
          <RNView style={styles.emptyState}>
            <RNView style={[styles.emptyIcon, { backgroundColor: currentTheme.colors.surface }]}>
              <Ionicons name="sparkles" size={32} color={currentTheme.colors.primary} />
            </RNView>
            <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              No routines yet
            </Text>
            <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
              Generate a personalized program{'\n'}based on your goals
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => setShowRoutineGenerator(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={[styles.emptyButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>
                Generate with AI
              </Text>
            </TouchableOpacity>
          </RNView>
        )}
      </ScrollView>

      {/* Routine Editor Modal */}
      <RoutineEditorModal
        visible={showRoutineEditor}
        routine={editingRoutine}
        onClose={handleRoutineEditorClose}
        onSave={handleRoutineEditorSave}
      />

      {/* AI Routine Generator Modal */}
      <RoutineGeneratorModal
        visible={showRoutineGenerator}
        onClose={() => setShowRoutineGenerator(false)}
        onRoutinesCreated={() => loadData()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 120,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 8,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  activeCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
    marginTop: 3,
  },
  activeCountText: {
    fontSize: 13,
    color: '#34C759',
  },
  archivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pausedHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // Routine card
  routineCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  upNextCard: {
    // No special styling - cleaner
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  expandHintText: {
    fontSize: 11,
  },
  routineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pausedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineName: {
    fontSize: 16,
    flexShrink: 1,
  },
  routineSubtitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  routineDate: {
    fontSize: 12,
  },
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 14,
    color: '#fff',
  },

  // Expanded content
  expandedContent: {
    marginTop: 16,
  },
  exerciseList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    marginBottom: 2,
  },
  exerciseSets: {
    fontSize: 12,
  },
  weightInfo: {
    alignItems: 'flex-end',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightValue: {
    fontSize: 14,
  },
  noDataText: {
    fontSize: 13,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  actionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 15,
    color: '#fff',
  },
});
