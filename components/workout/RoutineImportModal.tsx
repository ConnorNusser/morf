import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { calculateAllRoutines } from '@/lib/workout/progressiveOverload';
import { CalculatedRoutine, GeneratedWorkout, Routine, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';

interface RoutineImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (text: string, routineId: string) => void;
}

/**
 * Generate workout note text from a calculated routine
 * Format:
 * Exercise Name
 * Target: 135 x 10, 185 x 10, 185 x 10
 * Expected:
 */
export function generateRoutineText(routine: CalculatedRoutine, includeTitle: boolean = true): string {
  if (!routine?.exercises?.length) return '';

  const lines: string[] = [];

  // Add title as first line with # prefix (can be extracted by parser)
  if (includeTitle && routine.name) {
    lines.push(`# ${routine.name}`);
    lines.push('');
  }

  for (const exercise of routine.exercises) {
    lines.push(exercise.exerciseName);

    const sets = exercise.sets || [];
    if (sets.length > 0) {
      // Format each set as "weight x reps" (0 if no weight data)
      const setStrings = sets.map(set => `${set.targetWeight || 0}x${set.reps}`);
      lines.push(`Target: ${setStrings.join(', ')}`);
      lines.push('Expected:');
    }

    lines.push(''); // Empty line between exercises
  }

  return lines.join('\n').trim();
}

const RoutineImportModal: React.FC<RoutineImportModalProps> = ({
  visible,
  onClose,
  onImport,
}) => {
  const { currentTheme } = useTheme();
  const { userProfile } = useUser();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<GeneratedWorkout[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);

  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    try {
      const [loadedRoutines, history] = await Promise.all([
        storageService.getRoutines(),
        storageService.getWorkoutHistory(),
      ]);
      // Sort by most recently used
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
      console.error('Error loading routines:', error);
    }
  };

  // Calculate routines with progressive overload
  const calculatedRoutines = useMemo(() => {
    return calculateAllRoutines(routines, workoutHistory, weightUnit);
  }, [routines, workoutHistory, weightUnit]);

  // Filter routines
  const filteredRoutines = useMemo(() => {
    if (!searchQuery.trim()) return calculatedRoutines;
    const query = searchQuery.toLowerCase();
    return calculatedRoutines.filter(r =>
      r.name.toLowerCase().includes(query) ||
      r.exercises?.some(e => e.exerciseName.toLowerCase().includes(query))
    );
  }, [calculatedRoutines, searchQuery]);

  const handleImport = useCallback(async (routine: CalculatedRoutine) => {
    const text = generateRoutineText(routine);
    await storageService.updateRoutineLastUsed(routine.id);
    onImport(text, routine.id);
    onClose();
  }, [onImport, onClose]);

  const toggleExpanded = useCallback((routineId: string) => {
    setExpandedRoutineId(prev => prev === routineId ? null : routineId);
  }, []);

  const getProgressionColor = (progression: 'increase' | 'maintain' | 'decrease') => {
    switch (progression) {
      case 'increase': return '#34C759';
      case 'decrease': return '#FF3B30';
      default: return currentTheme.colors.text + '60';
    }
  };

  const getProgressionIcon = (progression: 'increase' | 'maintain' | 'decrease') => {
    switch (progression) {
      case 'increase': return 'trending-up';
      case 'decrease': return 'trending-down';
      default: return 'remove';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <RNView style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
            Start Routine
          </Text>
          <RNView style={{ width: 28 }} />
        </RNView>

        {/* Search */}
        {routines.length > 0 && (
          <RNView style={[styles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <Ionicons name="search" size={18} color={currentTheme.colors.text + '50'} />
            <TextInput
              style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}
              placeholder="Search routines..."
              placeholderTextColor={currentTheme.colors.text + '40'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={currentTheme.colors.text + '40'} />
              </TouchableOpacity>
            )}
          </RNView>
        )}

        {/* Routine List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {filteredRoutines.length > 0 ? (
            filteredRoutines.map((routine) => {
              const isExpanded = expandedRoutineId === routine.id;
              return (
                <RNView key={routine.id} style={[styles.routineCard, { backgroundColor: currentTheme.colors.surface }]}>
                  <TouchableOpacity
                    style={styles.routineHeader}
                    onPress={() => toggleExpanded(routine.id)}
                    activeOpacity={0.7}
                  >
                    <RNView style={styles.routineHeaderLeft}>
                      <Ionicons name="barbell-outline" size={18} color={currentTheme.colors.primary} />
                      <Text style={[styles.routineName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                        {routine.name}
                      </Text>
                    </RNView>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={currentTheme.colors.text + '60'}
                    />
                  </TouchableOpacity>

                  {/* Exercise Summary */}
                  <Text style={[styles.exerciseSummary, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                    {routine.exercises?.length || 0} exercise{(routine.exercises?.length || 0) !== 1 ? 's' : ''}
                  </Text>

                  {/* Expanded Exercise List */}
                  {isExpanded && routine.exercises?.length > 0 && (
                    <RNView style={styles.exerciseList}>
                      {routine.exercises.map((exercise, index) => (
                        <RNView
                          key={`${exercise.exerciseId}-${index}`}
                          style={[styles.exerciseRow, { borderTopColor: currentTheme.colors.border }]}
                        >
                          <RNView style={styles.exerciseInfo}>
                            <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                              {exercise.exerciseName}
                            </Text>
                            <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                              {exercise.sets?.length || 0} sets • {exercise.sets?.[0]?.reps || 0} reps
                              {exercise.sets?.some(s => s.isWarmup) && ' (incl. warmup)'}
                            </Text>
                          </RNView>

                          <RNView style={styles.weightInfo}>
                            {exercise.workingWeight > 0 ? (
                              <RNView style={styles.weightRow}>
                                <Text style={[styles.weightValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                                  {exercise.workingWeight} {exercise.unit}
                                </Text>
                                <Ionicons
                                  name={getProgressionIcon(exercise.progression)}
                                  size={14}
                                  color={getProgressionColor(exercise.progression)}
                                  style={{ marginLeft: 4 }}
                                />
                              </RNView>
                            ) : (
                              <Text style={[styles.noDataText, { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.regular }]}>
                                No data
                              </Text>
                            )}
                          </RNView>
                        </RNView>
                      ))}
                    </RNView>
                  )}

                  {/* Start Button */}
                  <TouchableOpacity
                    style={[styles.importButton, { backgroundColor: currentTheme.colors.primary }]}
                    onPress={() => handleImport(routine)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={[styles.importButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>
                      Start
                    </Text>
                  </TouchableOpacity>
                </RNView>
              );
            })
          ) : (
            <RNView style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color={currentTheme.colors.text + '20'} />
              <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.medium }]}>
                {routines.length === 0 ? 'No routines yet' : 'No matching routines'}
              </Text>
              <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontFamily: currentTheme.fonts.regular }]}>
                Create routines in the Routines tab
              </Text>
            </RNView>
          )}

          <RNView style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  routineCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  routineName: {
    fontSize: 16,
    flex: 1,
  },
  exerciseSummary: {
    fontSize: 13,
    marginTop: 4,
  },
  exerciseList: {
    marginTop: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    fontSize: 12,
    fontStyle: 'italic',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  importButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default RoutineImportModal;
