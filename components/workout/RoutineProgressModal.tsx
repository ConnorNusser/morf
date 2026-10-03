// Routine progress dashboard: insights, timeline, consistency stats.

import IconButton from '@/components/IconButton';
import { Text } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import FilteredExerciseList from '@/components/workout/routineProgress/FilteredExerciseList';
import MuscleBalanceCard from '@/components/workout/routineProgress/MuscleBalanceCard';
import ProgressSummaryRow from '@/components/workout/routineProgress/ProgressSummaryRow';
import RoutineProgressSection from '@/components/workout/routineProgress/RoutineProgressSection';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import {
  ExerciseStatus,
  RoutineProgress,
  buildRoutineProgressList,
  computeMuscleBalance,
  summarizeRoutineProgress,
} from '@/lib/history/routineProgress';
import { storageService } from '@/lib/storage/storage';
import { screenGutter, space } from '@/lib/ui/tokens';
import { calculateAllRoutines } from '@/lib/workout/progressiveOverload';
import { loadExerciseRecords } from '@/lib/workout/exerciseRecordsStore';
import { ExerciseRecord, LoggedWorkout, Routine } from '@/types';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

interface RoutineProgressModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RoutineProgressModal({
  visible,
  onClose,
}: RoutineProgressModalProps) {
  const { currentTheme } = useTheme();
  const { userProfile } = useUser();
  const weightUnit = userProfile?.weightUnitPreference || 'lbs';

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<LoggedWorkout[]>([]);
  const [exerciseRecords, setExerciseRecords] = useState<Record<string, ExerciseRecord>>({});
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExerciseStatus | null>(null);

  const colors = currentTheme.colors;

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
      const activeRoutines = loadedRoutines.filter(r => r.isActive !== false);
      setRoutines(activeRoutines);
      setWorkoutHistory(history);
      setExerciseRecords(await loadExerciseRecords(history));
      if (activeRoutines.length > 0) {
        setExpandedRoutineId(activeRoutines[0].id);
      }
    } catch (error) {
      console.error('Error loading routines:', error);
    }
  };

  const calculatedRoutines = useMemo(() => {
    return calculateAllRoutines(routines, exerciseRecords, weightUnit, workoutHistory);
  }, [routines, exerciseRecords, weightUnit, workoutHistory]);

  const routineProgressList = useMemo((): RoutineProgress[] => {
    return buildRoutineProgressList(calculatedRoutines, workoutHistory);
  }, [calculatedRoutines, workoutHistory]);

  const overallStats = useMemo(() => {
    return summarizeRoutineProgress(routineProgressList);
  }, [routineProgressList]);

  // Working sets per muscle group for the radar; glutes fold into Legs, full-body lifts skipped.
  const muscleBalance = useMemo(() => {
    return computeMuscleBalance(workoutHistory);
  }, [workoutHistory]);

  const toggleFilter = (filter: ExerciseStatus) => {
    setStatusFilter(prev => prev === filter ? null : filter);
  };

  const toggleRoutine = (routineId: string) => {
    setExpandedRoutineId(prev => prev === routineId ? null : routineId);
    setExpandedExerciseId(null);
  };

  const toggleExercise = (exerciseId: string) => {
    setExpandedExerciseId(prev => prev === exerciseId ? null : exerciseId);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text variant="title" tone="primary" weight="semiBold">
            Progress
          </Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

        {routineProgressList.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              art={require('@/assets/achievements/strength.png')}
              title="No progress yet"
              subtitle="Complete workouts to track your gains"
            />
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {muscleBalance.total > 0 && (
              <MuscleBalanceCard muscleBalance={muscleBalance} />
            )}

            <ProgressSummaryRow
              overallStats={overallStats}
              statusFilter={statusFilter}
              onToggleFilter={toggleFilter}
            />

            {statusFilter && (
              <FilteredExerciseList
                routineProgressList={routineProgressList}
                statusFilter={statusFilter}
                weightUnit={weightUnit}
                expandedExerciseId={expandedExerciseId}
                onToggleExercise={toggleExercise}
                onClearFilter={() => setStatusFilter(null)}
              />
            )}

            {!statusFilter && routineProgressList.map((routine) => {
              const isExpanded = expandedRoutineId === routine.id;

              return (
                <RoutineProgressSection
                  key={routine.id}
                  routine={routine}
                  isExpanded={isExpanded}
                  onToggle={toggleRoutine}
                  weightUnit={weightUnit}
                  expandedExerciseId={expandedExerciseId}
                  onToggleExercise={toggleExercise}
                />
              );
            })}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: 60,
    paddingBottom: space.md,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.xs,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});
