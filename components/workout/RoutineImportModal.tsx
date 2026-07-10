import IconButton from '@/components/IconButton';
import { Text, useInk } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import { getProgressionColor } from '@/lib/utils/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { calculateAllRoutines } from '@/lib/workout/progressiveOverload';
import { loadExerciseRecords } from '@/lib/workout/exerciseRecordsStore';
import { radius, screenGutter, space } from '@/lib/ui/tokens';
import { type } from '@/lib/ui/typography';
import { CalculatedRoutine, ExerciseRecord, GeneratedWorkout, Routine, WeightUnit } from '@/types';
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
  onImport: (routine: CalculatedRoutine) => void;
}


const RoutineImportModal: React.FC<RoutineImportModalProps> = ({
  visible,
  onClose,
  onImport,
}) => {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { userProfile } = useUser();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exerciseRecords, setExerciseRecords] = useState<Record<string, ExerciseRecord>>({});
  const [workoutHistory, setWorkoutHistory] = useState<GeneratedWorkout[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);

  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';

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
      setExerciseRecords(await loadExerciseRecords(history));
    } catch (error) {
      console.error('Error loading routines:', error);
    }
  };

  const calculatedRoutines = useMemo(() => {
    return calculateAllRoutines(routines, exerciseRecords, weightUnit, workoutHistory);
  }, [routines, exerciseRecords, weightUnit, workoutHistory]);

  const filteredRoutines = useMemo(() => {
    if (!searchQuery.trim()) return calculatedRoutines;
    const query = searchQuery.toLowerCase();
    return calculatedRoutines.filter(r =>
      r.name.toLowerCase().includes(query) ||
      r.exercises?.some(e => e.exerciseName.toLowerCase().includes(query))
    );
  }, [calculatedRoutines, searchQuery]);

  const handleImport = useCallback((routine: CalculatedRoutine) => {
    // Don't stamp lastUsed here — recordDayTrained does it on finish; stamping at
    // start would mark the day done before any set was logged.
    // Pass the STRUCTURED routine, not serialized text — re-parsing text re-resolved
    // exercise names to the wrong equipment variant (e.g. OHP Machine → Barbell).
    onImport(routine);
    onClose();
  }, [onImport, onClose]);

  const toggleExpanded = useCallback((routineId: string) => {
    setExpandedRoutineId(prev => prev === routineId ? null : routineId);
  }, []);


  const getProgressionIcon = (progression: 'increase' | 'maintain' | 'decrease') => {
    switch (progression) {
      case 'increase': return 'trending-up';
      case 'decrease': return 'trending-down';
      default: return 'remove';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <RNView style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <RNView style={styles.headerSpacer} />
          <Text variant="title" weight="semiBold" tone="primary">
            Start Routine
          </Text>
          <IconButton icon="close" onPress={onClose} />
        </RNView>

        {routines.length > 0 && (
          <RNView style={[styles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <Ionicons name="search" size={18} color={ink.faint} />
            <TextInput
              style={[styles.searchInput, { color: currentTheme.colors.text }]}
              placeholder="Search routines..."
              placeholderTextColor={ink.faint}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <IconButton
                icon="close-circle"
                onPress={() => setSearchQuery('')}
                iconColor={ink.faint}
              />
            )}
          </RNView>
        )}

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
                      <Text variant="body" weight="semiBold" tone="primary" style={styles.routineName}>
                        {routine.name}
                      </Text>
                    </RNView>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={ink.muted}
                    />
                  </TouchableOpacity>

                  <Text variant="meta" tone="faint" style={styles.exerciseSummary}>
                    {routine.exercises?.length || 0} exercise{(routine.exercises?.length || 0) !== 1 ? 's' : ''}
                  </Text>

                  {isExpanded && routine.exercises?.length > 0 && (
                    <RNView style={styles.exerciseList}>
                      {routine.exercises.map((exercise, index) => (
                        <RNView
                          key={`${exercise.exerciseId}-${index}`}
                          style={[styles.exerciseRow, { borderTopColor: currentTheme.colors.border }]}
                        >
                          <RNView style={styles.exerciseInfo}>
                            <Text variant="meta" weight="medium" tone="primary" style={styles.exerciseName}>
                              {exercise.exerciseName}
                            </Text>
                            <Text variant="meta" tone="muted">
                              {exercise.sets?.length || 0} sets • {exercise.sets?.[0]?.reps || 0} reps
                              {exercise.sets?.some(s => s.isWarmup) && ' (incl. warmup)'}
                            </Text>
                          </RNView>

                          <RNView style={styles.weightInfo}>
                            {exercise.workingWeight > 0 ? (
                              <RNView style={styles.weightRow}>
                                <Text variant="meta" weight="semiBold" tone="primary">
                                  {exercise.workingWeight} {exercise.unit}
                                </Text>
                                <Ionicons
                                  name={getProgressionIcon(exercise.progression)}
                                  size={14}
                                  color={getProgressionColor(exercise.progression, ink.muted)}
                                  style={{ marginLeft: space.xs }}
                                />
                              </RNView>
                            ) : (
                              <Text variant="meta" tone="faint" style={styles.noDataText}>
                                No data
                              </Text>
                            )}
                          </RNView>
                        </RNView>
                      ))}
                    </RNView>
                  )}

                  <TouchableOpacity
                    style={[styles.importButton, { backgroundColor: currentTheme.colors.primary }]}
                    onPress={() => handleImport(routine)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text variant="meta" weight="semiBold" style={styles.importButtonText}>
                      Start
                    </Text>
                  </TouchableOpacity>
                </RNView>
              );
            })
          ) : (
            <EmptyState
              art={require('@/assets/images/sl/scroll.png')}
              title={routines.length === 0 ? 'No routines yet' : 'No matching routines'}
              subtitle="Create routines in the Routines tab"
            />
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
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Balances the 40pt IconButton so the title stays centered.
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    height: 44,
    borderRadius: radius.control,
    marginHorizontal: screenGutter,
    marginVertical: space.md,
  },
  searchInput: {
    flex: 1,
    fontSize: type.body,
    paddingVertical: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: screenGutter,
  },
  routineCard: {
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flex: 1,
  },
  routineName: {
    flex: 1,
  },
  exerciseSummary: {
    marginTop: space.xs,
  },
  exerciseList: {
    marginTop: space.md,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    marginBottom: 2,
  },
  weightInfo: {
    alignItems: 'flex-end',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noDataText: {
    fontStyle: 'italic',
  },
  // C1 primary CTA with an icon+label — hand-pilled per the button canon.
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    marginTop: space.md,
  },
  importButtonText: {
    color: '#fff',
  },
});

export default RoutineImportModal;
