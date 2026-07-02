import { useAlert } from '@/components/CustomAlert';
import { getProgressionColor } from '@/lib/utils/utils';
import { Text, View } from '@/components/Themed';
import { formatRelativeDate } from '@/lib/ui/formatters';
import RoutineEditorModal from '@/components/workout/RoutineEditorModal';
import RoutineGeneratorModal from '@/components/workout/RoutineGeneratorModal';
import RoutineProgressModal from '@/components/workout/RoutineProgressModal';
import { generateRoutineText } from '@/components/workout/RoutineImportModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { setPendingRoutine } from '@/lib/workout/pendingRoutine';
import { getUpNextRoutine, isDayCompletedThisCycle } from '@/lib/workout/activeRoutine';
import { calculateAllRoutines, getExerciseAdherenceStatus, type AdherenceStatus } from '@/lib/workout/progressiveOverload';
import { getWorkoutById } from '@/lib/workout/workouts';
import { layout } from '@/lib/ui/styles';
import { styles } from '@/lib/ui/notesScreenStyles';
import { CalculatedRoutine, GeneratedWorkout, Program, Routine, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
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
  const [showRoutineProgress, setShowRoutineProgress] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  // Program a new day is being added to (null = editing a loose/standalone routine).
  const [addDayProgramId, setAddDayProgramId] = useState<string | null>(null);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [renamingProgram, setRenamingProgram] = useState<Program | null>(null);
  const [renameText, setRenameText] = useState('');
  // Program whose days are being reordered (null = none). In this mode the
  // up-next hoist is suspended so the manual order is what the user sees.
  const [reorderingProgramId, setReorderingProgramId] = useState<string | null>(null);
  // Which day the up-next ring points at (set by flipping on the home dashboard
  // or advanced on workout completion); resolves the highlighted up-next day.
  const [upNextPointerId, setUpNextPointerId] = useState<string | null>(null);
  // When the current rotation began — a day's checkmark derives from whether it
  // was trained at or after this (see isDayCompletedThisCycle). Flipping the
  // pointer doesn't change it; only finishing a real workout does.
  const [cycleStartedAt, setCycleStartedAt] = useState<number>(0);

  // User's weight unit preference
  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';

  // Load routines and workout history
  const loadData = useCallback(async () => {
    try {
      const [loadedRoutines, history, loadedPrograms, pointerId, cycleStart] = await Promise.all([
        storageService.getRoutines(),
        storageService.getWorkoutHistory(),
        storageService.getPrograms(),
        storageService.getUpNextPointerId(),
        storageService.getCycleStartedAt(),
      ]);
      setPrograms(loadedPrograms);
      setUpNextPointerId(pointerId);
      setCycleStartedAt(cycleStart);
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

  // Precompute muscle groups per routine once, instead of recomputing
  // getMuscleGroups (iterates exercises + getWorkoutById lookups) for every
  // routine card on every render (e.g. each expand/collapse toggle).
  const muscleGroupsByRoutine = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const routine of calculatedRoutines) {
      map.set(routine.id, getMuscleGroups(routine));
    }
    return map;
  }, [calculatedRoutines]);

  // Group day-routines under their program; routines without a programId are loose.
  const { programGroups, standaloneRoutines } = useMemo(() => {
    const byProgram = new Map<string, CalculatedRoutine[]>();
    const standalone: CalculatedRoutine[] = [];
    for (const r of calculatedRoutines) {
      if (r.programId) {
        const arr = byProgram.get(r.programId);
        if (arr) arr.push(r); else byProgram.set(r.programId, [r]);
      } else {
        standalone.push(r);
      }
    }
    // Days sort by the user-chosen order; routines without one fall back to
    // creation order so legacy programs keep a stable sequence.
    for (const arr of byProgram.values()) {
      arr.sort((a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt.getTime() - b.createdAt.getTime()
      );
    }
    const rank: Record<Program['status'], number> = { active: 0, paused: 1, archived: 2 };
    const groups = programs
      .map(p => ({ program: p, days: byProgram.get(p.id) ?? [] }))
      .filter(g => g.days.length > 0)
      .sort((a, b) =>
        rank[a.program.status] - rank[b.program.status] ||
        b.program.createdAt.getTime() - a.program.createdAt.getTime()
      );
    return { programGroups: groups, standaloneRoutines: standalone };
  }, [calculatedRoutines, programs]);

  // "Up Next" = the same routine the home dashboard surfaces, computed by the
  // shared resolver so the two screens always agree.
  const upNextRoutine = useMemo(
    () => getUpNextRoutine(calculatedRoutines, programs, upNextPointerId),
    [calculatedRoutines, programs, upNextPointerId]
  );


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

  // Program-level controls. Starting a program auto-pauses whatever was active.
  const handleStartProgram = useCallback(async (programId: string) => {
    await storageService.setActiveProgram(programId);
    await loadData();
  }, [loadData]);

  const handlePauseProgram = useCallback(async (programId: string) => {
    await storageService.setProgramStatus(programId, 'paused');
    await loadData();
  }, [loadData]);

  const handleArchiveProgram = useCallback(async (programId: string) => {
    await storageService.setProgramStatus(programId, 'archived');
    await loadData();
  }, [loadData]);

  const handleDeleteProgram = useCallback((program: Program) => {
    showAlert({
      title: `Delete ${program.name}?`,
      message: `This permanently deletes the program and all ${program.days} of its day${program.days === 1 ? '' : 's'}. This can't be undone.`,
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storageService.deleteProgram(program.id);
            await loadData();
          },
        },
      ],
    });
  }, [loadData, showAlert]);

  // Move a day up/down within its program and persist the new order.
  const handleMoveDay = useCallback(async (programId: string, dayIds: string[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= dayIds.length) return;
    const next = [...dayIds];
    [next[index], next[target]] = [next[target], next[index]];
    await storageService.reorderProgramDays(programId, next);
    await loadData();
  }, [loadData]);

  const toggleProgramExpanded = useCallback((programId: string) => {
    setExpandedProgramId(prev => (prev === programId ? null : programId));
  }, []);

  const openRenameProgram = useCallback((program: Program) => {
    setRenamingProgram(program);
    setRenameText(program.name);
  }, []);

  const handleRenameSave = useCallback(async () => {
    const name = renameText.trim();
    if (renamingProgram && name && name !== renamingProgram.name) {
      await storageService.saveProgram({ ...renamingProgram, name });
      await loadData();
    }
    setRenamingProgram(null);
  }, [renamingProgram, renameText, loadData]);

  // Handle manual deload for a specific exercise
  const handleDeloadExercise = useCallback(async (routine: Routine, exerciseId: string) => {
    const progressionState = routine.progressionState?.[exerciseId];
    if (!progressionState) return;

    // Calculate deloaded weight (10% reduction, rounded to nearest plate)
    const deloadPercent = 0.9;
    const increment = weightUnit === 'kg' ? 2.5 : 5;
    const newWeight = Math.round((progressionState.currentWeight * deloadPercent) / increment) * increment;

    // Update progression state for this exercise only
    const updatedProgressionState = {
      ...routine.progressionState,
      [exerciseId]: {
        ...progressionState,
        currentWeight: newWeight,
        currentRepBonus: 0,
        consecutiveFailures: 0,
      },
    };

    const updated: Routine = {
      ...routine,
      progressionState: updatedProgressionState,
    };

    await storageService.saveRoutine(updated);
    await loadData();
  }, [loadData, weightUnit]);

  const handleCreateRoutine = useCallback(() => {
    setEditingRoutine(null);
    setAddDayProgramId(null);
    setShowRoutineEditor(true);
  }, []);

  const handleEditRoutine = useCallback((routine: Routine) => {
    setEditingRoutine(routine);
    setAddDayProgramId(null);
    setShowRoutineEditor(true);
  }, []);

  // Open the editor to create a brand-new day inside an existing program.
  const handleAddDay = useCallback((programId: string) => {
    setEditingRoutine(null);
    setAddDayProgramId(programId);
    setShowRoutineEditor(true);
  }, []);

  const handleRoutineEditorClose = useCallback(() => {
    setShowRoutineEditor(false);
    setEditingRoutine(null);
    setAddDayProgramId(null);
  }, []);

  const handleRoutineEditorSave = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const handleStartWorkout = useCallback(async (routine: CalculatedRoutine) => {
    const text = generateRoutineText(routine);
    setPendingRoutine(text, routine.id);
    router.push('/workout');
  }, [router]);

  const toggleRoutineExpanded = useCallback((routineId: string) => {
    setExpandedRoutineId(prev => prev === routineId ? null : routineId);
  }, []);

  // Get progression color

  // Get progression icon
  const getProgressionIcon = (progression: 'increase' | 'maintain' | 'decrease') => {
    switch (progression) {
      case 'increase': return 'caret-up';
      case 'decrease': return 'caret-down';
      default: return 'remove-outline';
    }
  };

  // How an exercise reads against the program's own prescription (not est 1RM).
  const adherenceMeta = (status: AdherenceStatus): { label: string; color: string } => {
    switch (status) {
      case 'improving': return { label: 'Improving', color: '#34C759' };
      case 'easing': return { label: 'Easing back', color: '#FF3B30' };
      case 'holding': return { label: 'On track', color: currentTheme.colors.text + '70' };
      default: return { label: 'Not started', color: currentTheme.colors.text + '40' };
    }
  };

  const renderRoutineCard = (routine: CalculatedRoutine, isUpNext = false) => {
    const isExpanded = expandedRoutineId === routine.id;
    const isActive = routine.isActive !== false;
    // Only an active up-next day earns the highlighted treatment.
    const highlight = isUpNext && isActive;
    const muscleGroups = muscleGroupsByRoutine.get(routine.id) ?? getMuscleGroups(routine);
    const exerciseCount = routine.exercises?.length || 0;

    // Find exercises that need deloading (consecutiveFailures >= 2)
    const exercisesNeedingDeload = routine.exercises?.filter(
      ex => (routine.progressionState?.[ex.exerciseId]?.consecutiveFailures ?? 0) >= 2
    ) || [];
    const hasExercisesNeedingDeload = exercisesNeedingDeload.length > 0;

    return (
      <TouchableOpacity
        key={routine.id}
        style={[
          styles.routineCard,
          // Transparent on the background with a hairline outline, matching the
          // ghost control chips, so the cards read as outlined not filled.
          { backgroundColor: 'transparent', borderWidth: 1, borderColor: currentTheme.colors.text + '1A' },
          highlight && {
            backgroundColor: currentTheme.colors.primary + '12',
            borderColor: currentTheme.colors.primary + '40',
          },
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
                weight="semiBold"
                style={[
                  styles.routineName,
                  { color: currentTheme.colors.text },
                  !isActive && { opacity: 0.5 }
                ]}
                numberOfLines={1}
              >
                {routine.name}
              </Text>
              {isUpNext && (
                <RNView style={[styles.upNextInline, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                  <Text weight="semiBold" style={[styles.upNextInlineText, { color: currentTheme.colors.primary }]}>UP NEXT</Text>
                </RNView>
              )}
              {!isActive && (
                <RNView style={[styles.pausedBadge, { backgroundColor: currentTheme.colors.text + '15' }]}>
                  <Ionicons name="moon" size={10} color={currentTheme.colors.text + '50'} />
                </RNView>
              )}
            </RNView>
            <Text weight="regular" style={[styles.routineSubtitle, { color: currentTheme.colors.text + '70' }]}>
              {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
              {muscleGroups.length > 0 && ` · ${muscleGroups.join(', ')}`}
            </Text>
            {routine.lastUsed && (
              <Text weight="regular" style={[styles.routineDate, { color: currentTheme.colors.text + '40' }]}>
                {formatRelativeDate(routine.lastUsed)}
              </Text>
            )}

            {/* Deload Warning Banner - shown when collapsed and exercises need deload */}
            {!isExpanded && hasExercisesNeedingDeload && (
              <RNView style={[styles.deloadBanner, { backgroundColor: '#FF3B30' + '15' }]}>
                <Ionicons name="warning" size={12} color="#FF3B30" />
                <Text weight="medium" style={[styles.deloadBannerText, { color: '#FF3B30' }]}>
                  {exercisesNeedingDeload.length} exercise{exercisesNeedingDeload.length > 1 ? 's' : ''} stalling
                </Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    // Deload all stalling exercises
                    exercisesNeedingDeload.forEach(ex => {
                      handleDeloadExercise(routine, ex.exerciseId);
                    });
                  }}
                  style={[styles.deloadBannerButton, { backgroundColor: '#FF3B30' }]}
                >
                  <Text weight="semiBold" style={[styles.deloadBannerButtonText]}>
                    Deload
                  </Text>
                </TouchableOpacity>
              </RNView>
            )}
          </RNView>

          {/* Right: Start button — prominent on the up-next day, quiet elsewhere
              so the day you should train stands out. */}
          <TouchableOpacity
            style={[
              styles.startButton,
              highlight
                ? { backgroundColor: currentTheme.colors.primary }
                : isActive
                  ? { backgroundColor: currentTheme.colors.primary + '15' }
                  : { backgroundColor: currentTheme.colors.text + '15' },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              handleStartWorkout(routine);
            }}
            activeOpacity={0.8}
          >
            <Text
              weight="semiBold"
              style={[
                styles.startButtonText,
                !highlight && { color: isActive ? currentTheme.colors.primary : currentTheme.colors.text + '60' },
              ]}
            >
              Start
            </Text>
          </TouchableOpacity>
        </RNView>

        {/* Expand affordance — a single quiet chevron, no repeated label. */}
        {!isExpanded && (
          <RNView style={styles.expandHint}>
            <Ionicons name="chevron-down" size={14} color={currentTheme.colors.text + '35'} />
          </RNView>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <RNView style={styles.expandedContent}>
            {/* Exercise List */}
            {routine.exercises?.length > 0 && (
              <RNView style={[styles.exerciseList, { borderTopColor: currentTheme.colors.border }]}>
                {routine.exercises.map((exercise, index) => {
                  // Improving/holding is judged against the program's own
                  // prescription (rep bonuses, working weight), not est 1RM —
                  // the routine rarely asks for a true max, so e1RM would
                  // contradict a lifter who's hitting every prescribed mark.
                  const adherence = adherenceMeta(getExerciseAdherenceStatus(exercise));
                  return (
                  <RNView
                    key={`${exercise.exerciseId}-${index}`}
                    style={styles.exerciseRow}
                  >
                    <RNView style={styles.exerciseInfo}>
                      <Text weight="medium" style={[styles.exerciseName, { color: currentTheme.colors.text }]}>
                        {exercise.exerciseName}
                      </Text>
                      <Text weight="regular" style={[styles.exerciseSets, { color: currentTheme.colors.text + '50' }]}>
                        {exercise.sets?.length || 0} sets × {exercise.sets?.[0]?.reps || 0} reps
                      </Text>
                      <Text weight="semiBold" style={[styles.adherenceText, { color: adherence.color }]}>
                        {adherence.label}
                      </Text>
                    </RNView>

                    <RNView style={styles.weightInfo}>
                      {exercise.workingWeight > 0 ? (
                        <>
                          <RNView style={styles.weightRow}>
                            <Text weight="medium" style={[styles.weightValue, { color: currentTheme.colors.text + '90' }]}>
                              {exercise.workingWeight} {exercise.unit}
                            </Text>
                            <Ionicons
                              name={getProgressionIcon(exercise.progression)}
                              size={12}
                              color={getProgressionColor(exercise.progression, currentTheme.colors.text + '60')}
                              style={{ marginLeft: 4 }}
                            />
                          </RNView>
                          {(routine.progressionState?.[exercise.exerciseId]?.consecutiveFailures ?? 0) >= 2 && (
                            <TouchableOpacity
                              onPress={() => handleDeloadExercise(routine, exercise.exerciseId)}
                              style={styles.deloadButton}
                            >
                              <Text weight="medium" style={[styles.deloadWarning, { color: '#FF3B30' }]}>
                                Tap to deload
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        <Text weight="regular" style={[styles.noDataText, { color: currentTheme.colors.text + '30' }]}>
                          —
                        </Text>
                      )}
                    </RNView>
                  </RNView>
                  );
                })}
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
                <Ionicons name="options-outline" size={18} color={currentTheme.colors.text + '60'} />
                <Text weight="regular" style={[styles.actionText, { color: currentTheme.colors.text + '60' }]}>
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
                  name={isActive ? 'moon-outline' : 'sunny-outline'}
                  size={18}
                  color={isActive ? '#FF9500' : '#34C759'}
                />
                <Text weight="regular" style={[styles.actionText, { color: isActive ? '#FF9500' : '#34C759' }]}>
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
                <Ionicons name="close-circle-outline" size={18} color="#FF453A" />
                <Text weight="regular" style={[styles.actionText, { color: '#FF453A' }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </RNView>
          </RNView>
        )}
      </TouchableOpacity>
    );
  };

  // Shared ghost treatment for the quiet program-utility chips (Pause/Archive/
  // Rename) — a hairline outline on transparent so they read as secondary next
  // to the filled primary actions.
  const ghostChip = { backgroundColor: 'transparent', borderColor: currentTheme.colors.text + '1A' };

  return (
    <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <RNView style={styles.header}>
        <Text weight="bold" style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
          Routines
        </Text>
        <RNView style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: currentTheme.colors.surface }]}
            onPress={() => setShowRoutineGenerator(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={18} color={currentTheme.colors.primary} />
          </TouchableOpacity>
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
            {/* View Progress Button */}
            <TouchableOpacity
              style={[styles.progressButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: currentTheme.colors.text + '1A' }]}
              onPress={() => setShowRoutineProgress(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="stats-chart" size={18} color={currentTheme.colors.primary} />
              <Text weight="medium" style={[styles.progressButtonText, { color: currentTheme.colors.text }]}>
                View Progress
              </Text>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '30'} />
            </TouchableOpacity>

            {/* Programs — grouped day-routines; exactly one is active at a time */}
            {programGroups.map(({ program, days }) => {
              const isActiveProgram = program.status === 'active';
              const isReordering = reorderingProgramId === program.id;
              const isExpanded = isActiveProgram || expandedProgramId === program.id || isReordering;
              const dayIds = days.map(d => d.id);
              const statusColor = isActiveProgram
                ? '#34C759'
                : currentTheme.colors.text + (program.status === 'paused' ? '80' : '50');
              const statusLabel = isActiveProgram ? 'Active' : program.status === 'paused' ? 'Paused' : 'Archived';
              // Always show days in their manual program order so Reorder is
              // authoritative; the up-next day is flagged in place via the
              // per-row isUpNext badge rather than hoisted to the top.
              // Cycle progress reflects days actually trained this cycle (not
              // merely flipped past). The up-next day itself stays "up next"
              // even if trained earlier, so it's excluded from the done count.
              const completedThisCycle = isActiveProgram
                ? days.filter(d => d.id !== upNextRoutine?.id && isDayCompletedThisCycle(d, cycleStartedAt)).length
                : 0;
              // Program-level lift momentum: how each distinct exercise is
              // tracking against the program's prescription (rep bonuses /
              // working weight), summarized once above the day list. Adherence —
              // not est 1RM — so the bar agrees with each exercise row.
              const programExercises = new Map<string, typeof days[number]['exercises'][number]>();
              for (const d of days) {
                for (const e of d.exercises ?? []) {
                  const existing = programExercises.get(e.exerciseId);
                  // Keep the instance that has been logged, so a lift trained on
                  // one day isn't shown as "new" because another day hasn't run.
                  if (!existing || (!existing.lastPerformed && e.lastPerformed)) {
                    programExercises.set(e.exerciseId, e);
                  }
                }
              }
              const programStatuses = Array.from(programExercises.values()).map(getExerciseAdherenceStatus);
              const programImproving = programStatuses.filter(s => s === 'improving').length;
              const programHasTrend = programStatuses.some(s => s !== 'new');
              return (
                <RNView key={program.id} style={styles.section}>
                  <TouchableOpacity
                    style={styles.programHeader}
                    activeOpacity={isActiveProgram ? 1 : 0.7}
                    onPress={() => { if (!isActiveProgram) toggleProgramExpanded(program.id); }}
                  >
                    <RNView style={layout.flex1}>
                      <RNView style={styles.programTitleRow}>
                        <Text weight="semiBold" style={[styles.programName, { color: currentTheme.colors.text }]} numberOfLines={1}>
                          {program.name}
                        </Text>
                        <Text weight="semiBold" style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                      </RNView>
                      <Text weight="regular" style={[styles.programMeta, { color: currentTheme.colors.text + '60' }]}>
                        {program.days} day{program.days === 1 ? '' : 's'}{program.source ? ` · ${program.source.program}` : ''}
                      </Text>
                      {isActiveProgram && days.length > 0 && (
                        <RNView style={styles.cycleRow}>
                          <RNView style={styles.cycleBar}>
                            {days.map((d, i) => (
                              <RNView
                                key={d.id}
                                style={[styles.cycleSegment, { backgroundColor: i < completedThisCycle ? '#34C759' : currentTheme.colors.text + '15' }]}
                              />
                            ))}
                          </RNView>
                          <Text weight="medium" style={[styles.cycleCount, { color: currentTheme.colors.text + '66' }]}>
                            {completedThisCycle}/{days.length}
                          </Text>
                        </RNView>
                      )}
                    </RNView>
                    {!isActiveProgram && (
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={currentTheme.colors.text + '50'} />
                    )}
                  </TouchableOpacity>

                  {/* Lift momentum — one adherence summary for the whole program,
                      above the days (kept off the cards to avoid clutter). */}
                  {isExpanded && programHasTrend && (
                    <RNView style={styles.programMomentum}>
                      <RNView style={styles.momentumBar}>
                        {programStatuses.map((s, i) => {
                          const segColor = s === 'improving' ? '#34C759'
                            : s === 'easing' ? '#FF3B30'
                            : s === 'holding' ? currentTheme.colors.text + '40'  // on track, no recent gain
                            : currentTheme.colors.text + '15';                   // not started yet
                          return <RNView key={i} style={[styles.momentumSeg, { backgroundColor: segColor }]} />;
                        })}
                      </RNView>
                      <Text weight="medium" style={[styles.momentumLabel, { color: currentTheme.colors.text + '66' }]}>
                        {programImproving} of {programStatuses.length} lifts improving
                      </Text>
                    </RNView>
                  )}

                  {/* Reorder mode — compact rows with up/down controls */}
                  {isExpanded && isReordering && (
                    <RNView style={styles.timeline}>
                      {days.map((routine, idx) => (
                        <RNView key={routine.id} style={[styles.reorderRow, { borderColor: currentTheme.colors.text + '1A' }]}>
                          <Text weight="medium" style={[styles.reorderName, { color: currentTheme.colors.text }]} numberOfLines={1}>
                            {routine.name}
                          </Text>
                          <RNView style={styles.reorderControls}>
                            <TouchableOpacity
                              onPress={() => handleMoveDay(program.id, dayIds, idx, -1)}
                              disabled={idx === 0}
                              hitSlop={8}
                              style={[styles.reorderBtn, idx === 0 && styles.reorderBtnDisabled]}
                            >
                              <Ionicons name="chevron-up" size={20} color={currentTheme.colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleMoveDay(program.id, dayIds, idx, 1)}
                              disabled={idx === days.length - 1}
                              hitSlop={8}
                              style={[styles.reorderBtn, idx === days.length - 1 && styles.reorderBtnDisabled]}
                            >
                              <Ionicons name="chevron-down" size={20} color={currentTheme.colors.text} />
                            </TouchableOpacity>
                          </RNView>
                        </RNView>
                      ))}
                    </RNView>
                  )}

                  {/* Days — threaded onto a timeline spine so they read as one program */}
                  {isExpanded && !isReordering && (
                    <RNView style={styles.timeline}>
                      {days.map((routine, idx) => {
                        const isUpNext = isActiveProgram && upNextRoutine?.id === routine.id;
                        // Done only if actually trained this cycle (flipping the
                        // pointer past a day never marks it done). The up-next day
                        // keeps its highlight even if it was trained earlier.
                        const isCompleted = isActiveProgram && !isUpNext && isDayCompletedThisCycle(routine, cycleStartedAt);
                        const isFirst = idx === 0;
                        const isLast = idx === days.length - 1;
                        const dotBorder = isUpNext ? currentTheme.colors.primary : currentTheme.colors.text + '35';
                        const dotFill = isUpNext ? currentTheme.colors.primary : currentTheme.colors.surface;
                        const body = renderRoutineCard(routine, isUpNext);
                        return (
                          <RNView key={routine.id} style={styles.timelineRow}>
                            <RNView style={styles.spine}>
                              {!isFirst && <RNView style={[styles.spineLineTop, { backgroundColor: currentTheme.colors.border }]} />}
                              {!isLast && <RNView style={[styles.spineLineBottom, { backgroundColor: currentTheme.colors.border }]} />}
                              {isCompleted ? (
                                <Ionicons name="checkmark-circle" size={17} color="#34C759" style={styles.spineCheck} />
                              ) : (
                                <RNView style={[styles.spineDot, { backgroundColor: dotFill, borderColor: dotBorder }]} />
                              )}
                            </RNView>
                            <RNView style={layout.flex1}>{body}</RNView>
                          </RNView>
                        );
                      })}
                    </RNView>
                  )}

                  {/* Add a new day to the program */}
                  {isExpanded && !isReordering && (
                    <TouchableOpacity
                      style={[styles.addDayButton, { borderColor: currentTheme.colors.primary + '40' }]}
                      onPress={() => handleAddDay(program.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={currentTheme.colors.primary} />
                      <Text weight="medium" style={[styles.addDayText, { color: currentTheme.colors.primary }]}>
                        Add day
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Program controls — below the day list so the days you train
                      lead and program management reads as a footer. */}
                  <RNView style={styles.programActions}>
                    {isReordering ? (
                      <TouchableOpacity style={[styles.programChip, { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.primary }]} onPress={() => setReorderingProgramId(null)} activeOpacity={0.85}>
                        <Text style={[styles.programChipText, { color: '#fff' }]}>Done</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        {isActiveProgram ? (
                          <>
                            <TouchableOpacity style={[styles.programChip, ghostChip]} onPress={() => handlePauseProgram(program.id)} activeOpacity={0.6}>
                              <Text style={[styles.programChipText, { color: currentTheme.colors.text + 'CC' }]}>Pause</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.programChip, ghostChip]} onPress={() => handleArchiveProgram(program.id)} activeOpacity={0.6}>
                              <Text style={[styles.programChipText, { color: currentTheme.colors.text + 'CC' }]}>Archive</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity style={[styles.programChip, { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.primary }]} onPress={() => handleStartProgram(program.id)} activeOpacity={0.85}>
                            <Text style={[styles.programChipText, { color: '#fff' }]}>{program.status === 'archived' ? 'Restart' : 'Start'}</Text>
                          </TouchableOpacity>
                        )}
                        {days.length > 1 && (
                          <TouchableOpacity style={[styles.programChip, ghostChip]} onPress={() => { setExpandedProgramId(program.id); setReorderingProgramId(program.id); }} activeOpacity={0.6}>
                            <Text style={[styles.programChipText, { color: currentTheme.colors.text + 'CC' }]}>Reorder</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.programChip, ghostChip]} onPress={() => openRenameProgram(program)} activeOpacity={0.6}>
                          <Text style={[styles.programChipText, { color: currentTheme.colors.text + 'CC' }]}>Rename</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.programChip, { backgroundColor: 'transparent', borderColor: '#E5484D33' }]} onPress={() => handleDeleteProgram(program)} activeOpacity={0.6}>
                          <Text style={[styles.programChipText, { color: '#E5484D' }]}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </RNView>

                  {/* Bottom rule — closes the program block so the header, days
                      and controls read as one grouped unit. */}
                  <RNView style={[styles.programDivider, { backgroundColor: currentTheme.colors.border }]} />
                </RNView>
              );
            })}

            {/* My Routines — loose routines not tied to a program */}
            {standaloneRoutines.length > 0 && (
              <RNView style={styles.section}>
                <Text weight="semiBold" style={[styles.sectionLabel, { color: currentTheme.colors.text + '50' }]}>
                  MY ROUTINES
                </Text>
                {standaloneRoutines.map((routine) => renderRoutineCard(routine))}
              </RNView>
            )}
          </>
        ) : (
          <RNView style={styles.emptyState}>
            <RNView style={[styles.emptyIcon, { backgroundColor: currentTheme.colors.surface }]}>
              <Ionicons name="sparkles" size={32} color={currentTheme.colors.primary} />
            </RNView>
            <Text weight="semiBold" style={[styles.emptyTitle, { color: currentTheme.colors.text }]}>
              No routines yet
            </Text>
            <Text weight="regular" style={[styles.emptyText, { color: currentTheme.colors.text + '50' }]}>
              Generate a personalized program{'\n'}based on your goals
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: currentTheme.colors.primary }]}
              onPress={() => setShowRoutineGenerator(true)}
              activeOpacity={0.8}
            >
              <Text weight="semiBold" style={[styles.emptyButtonText]}>
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
        programId={addDayProgramId}
        onClose={handleRoutineEditorClose}
        onSave={handleRoutineEditorSave}
      />

      {/* AI Routine Generator Modal */}
      <RoutineGeneratorModal
        visible={showRoutineGenerator}
        onClose={() => setShowRoutineGenerator(false)}
        onRoutinesCreated={() => {
          loadData();
        }}
      />

      {/* Routine Progress Modal */}
      <RoutineProgressModal
        visible={showRoutineProgress}
        onClose={() => {
          setShowRoutineProgress(false);
          loadData(); // Refresh data in case changes were made
        }}
        onDataChanged={loadData}
      />

      {/* Rename Program Modal */}
      <Modal visible={!!renamingProgram} transparent animationType="fade" onRequestClose={() => setRenamingProgram(null)}>
        <RNView style={styles.renameOverlay}>
          <RNView style={[styles.renameCard, { backgroundColor: currentTheme.colors.surface }]}>
            <Text weight="semiBold" style={[styles.renameTitle, { color: currentTheme.colors.text }]}>
              Rename program
            </Text>
            <TextInput
              style={[styles.renameInput, { color: currentTheme.colors.text, borderColor: currentTheme.colors.border, fontFamily: currentTheme.fonts.regular }]}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Program name"
              placeholderTextColor={currentTheme.colors.text + '50'}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              maxLength={60}
              onSubmitEditing={handleRenameSave}
            />
            <RNView style={styles.renameButtons}>
              <TouchableOpacity style={styles.renameCancel} onPress={() => setRenamingProgram(null)} activeOpacity={0.7}>
                <Text weight="medium" style={[styles.renameCancelText, { color: currentTheme.colors.text + '99' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.renameSave, { backgroundColor: currentTheme.colors.primary }]} onPress={handleRenameSave} activeOpacity={0.85}>
                <Text weight="semiBold" style={[styles.renameSaveText]}>Save</Text>
              </TouchableOpacity>
            </RNView>
          </RNView>
        </RNView>
      </Modal>
    </SafeAreaView>
  );
}
