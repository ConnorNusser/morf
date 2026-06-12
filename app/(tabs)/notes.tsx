import { useAlert } from '@/components/CustomAlert';
import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial/TutorialTarget';
import RoutineEditorModal from '@/components/workout/RoutineEditorModal';
import RoutineGeneratorModal from '@/components/workout/RoutineGeneratorModal';
import RoutineProgressModal from '@/components/workout/RoutineProgressModal';
import { generateRoutineText } from '@/components/workout/RoutineImportModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { setPendingRoutine } from '@/lib/workout/pendingRoutine';
import { calculateAllRoutines } from '@/lib/workout/progressiveOverload';
import { getWorkoutById } from '@/lib/workout/workouts';
import { layout } from '@/lib/ui/styles';
import { CalculatedRoutine, GeneratedWorkout, Program, Routine, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
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
  const [showRoutineProgress, setShowRoutineProgress] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [renamingProgram, setRenamingProgram] = useState<Program | null>(null);
  const [renameText, setRenameText] = useState('');

  // User's weight unit preference
  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';

  // Load routines and workout history
  const loadData = useCallback(async () => {
    try {
      const [loadedRoutines, history, loadedPrograms] = await Promise.all([
        storageService.getRoutines(),
        storageService.getWorkoutHistory(),
        storageService.getPrograms(),
      ]);
      setPrograms(loadedPrograms);
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

  const activeProgramGroup = useMemo(
    () => programGroups.find(g => g.program.status === 'active') ?? null,
    [programGroups]
  );

  // "Up Next" = the least-recently-trained active day of the active program.
  const upNextRoutine = useMemo(() => {
    const days = (activeProgramGroup?.days ?? []).filter(r => r.isActive !== false);
    if (days.length === 0) return null;
    return [...days].sort((a, b) => {
      if (!a.lastUsed && !b.lastUsed) return 0;
      if (!a.lastUsed) return -1;
      if (!b.lastUsed) return 1;
      return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
    })[0];
  }, [activeProgramGroup]);

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
    setPendingRoutine(text, routine.id);
    router.push('/workout');
  }, [router]);

  const toggleRoutineExpanded = useCallback((routineId: string) => {
    setExpandedRoutineId(prev => prev === routineId ? null : routineId);
  }, []);

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
      case 'increase': return 'caret-up';
      case 'decrease': return 'caret-down';
      default: return 'remove-outline';
    }
  };

  const renderRoutineCard = (routine: CalculatedRoutine, isUpNext = false) => {
    const isExpanded = expandedRoutineId === routine.id;
    const isActive = routine.isActive !== false;
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
                  <Ionicons name="moon" size={10} color={currentTheme.colors.text + '50'} />
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

            {/* Deload Warning Banner - shown when collapsed and exercises need deload */}
            {!isExpanded && hasExercisesNeedingDeload && (
              <RNView style={[styles.deloadBanner, { backgroundColor: '#FF3B30' + '15' }]}>
                <Ionicons name="warning" size={12} color="#FF3B30" />
                <Text style={[styles.deloadBannerText, { color: '#FF3B30', fontFamily: currentTheme.fonts.medium }]}>
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
                  <Text style={[styles.deloadBannerButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>
                    Deload
                  </Text>
                </TouchableOpacity>
              </RNView>
            )}
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
                        <>
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
                          {(routine.progressionState?.[exercise.exerciseId]?.consecutiveFailures ?? 0) >= 2 && (
                            <TouchableOpacity
                              onPress={() => handleDeloadExercise(routine, exercise.exerciseId)}
                              style={styles.deloadButton}
                            >
                              <Text style={[styles.deloadWarning, { color: '#FF3B30', fontFamily: currentTheme.fonts.medium }]}>
                                Tap to deload
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
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
                <Ionicons name="options-outline" size={18} color={currentTheme.colors.text + '60'} />
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
                  name={isActive ? 'moon-outline' : 'sunny-outline'}
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
                <Ionicons name="close-circle-outline" size={18} color="#FF453A" />
                <Text style={[styles.actionText, { color: '#FF453A', fontFamily: currentTheme.fonts.regular }]}>
                  Remove
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
            {/* View Progress Button */}
            <TutorialTarget id="notes-progress-button">
              <TouchableOpacity
                style={[styles.progressButton, { backgroundColor: currentTheme.colors.surface }]}
                onPress={() => setShowRoutineProgress(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="stats-chart" size={18} color={currentTheme.colors.primary} />
                <Text style={[styles.progressButtonText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                  View Progress
                </Text>
                <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '30'} />
              </TouchableOpacity>
            </TutorialTarget>

            {/* Programs — grouped day-routines; exactly one is active at a time */}
            {programGroups.map(({ program, days }) => {
              const isActiveProgram = program.status === 'active';
              const isExpanded = isActiveProgram || expandedProgramId === program.id;
              const statusColor = isActiveProgram
                ? currentTheme.colors.primary
                : currentTheme.colors.text + (program.status === 'paused' ? '80' : '50');
              const statusLabel = isActiveProgram ? 'Active' : program.status === 'paused' ? 'Paused' : 'Archived';
              const orderedDays = isActiveProgram && upNextRoutine
                ? [upNextRoutine, ...days.filter(d => d.id !== upNextRoutine.id)]
                : days;
              return (
                <RNView key={program.id} style={styles.section}>
                  <TouchableOpacity
                    style={styles.programHeader}
                    activeOpacity={isActiveProgram ? 1 : 0.7}
                    onPress={() => { if (!isActiveProgram) toggleProgramExpanded(program.id); }}
                  >
                    <RNView style={layout.flex1}>
                      <RNView style={styles.programTitleRow}>
                        <Text style={[styles.programName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]} numberOfLines={1}>
                          {program.name}
                        </Text>
                        <RNView style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.statusPillText, { color: statusColor, fontFamily: currentTheme.fonts.semiBold }]}>{statusLabel}</Text>
                        </RNView>
                      </RNView>
                      <Text style={[styles.programMeta, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                        {program.days} day{program.days === 1 ? '' : 's'}{program.source ? ` · ${program.source.program}` : ''}
                      </Text>
                    </RNView>
                    {!isActiveProgram && (
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={currentTheme.colors.text + '50'} />
                    )}
                  </TouchableOpacity>

                  {/* Program controls */}
                  <RNView style={styles.programActions}>
                    {isActiveProgram ? (
                      <>
                        <TouchableOpacity style={[styles.programChip, { backgroundColor: currentTheme.colors.surface }]} onPress={() => handlePauseProgram(program.id)} activeOpacity={0.7}>
                          <Ionicons name="pause" size={16} color={currentTheme.colors.text + '99'} />
                          <Text style={[styles.programChipText, { color: currentTheme.colors.text }]}>Pause</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.programChip, { backgroundColor: currentTheme.colors.surface }]} onPress={() => handleArchiveProgram(program.id)} activeOpacity={0.7}>
                          <Ionicons name="file-tray-full-outline" size={16} color={currentTheme.colors.text + '99'} />
                          <Text style={[styles.programChipText, { color: currentTheme.colors.text }]}>Archive</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={[styles.programChip, { backgroundColor: currentTheme.colors.primary }]} onPress={() => handleStartProgram(program.id)} activeOpacity={0.85}>
                        <Ionicons name="play" size={16} color="#fff" />
                        <Text style={[styles.programChipText, { color: '#fff' }]}>{program.status === 'archived' ? 'Restart' : 'Start'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.programChip, { backgroundColor: currentTheme.colors.surface }]} onPress={() => openRenameProgram(program)} activeOpacity={0.7}>
                      <Ionicons name="pencil" size={15} color={currentTheme.colors.text + '99'} />
                      <Text style={[styles.programChipText, { color: currentTheme.colors.text }]}>Rename</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.programChip, { backgroundColor: '#E5484D14' }]} onPress={() => handleDeleteProgram(program)} activeOpacity={0.7}>
                      <Ionicons name="trash-outline" size={16} color="#E5484D" />
                      <Text style={[styles.programChipText, { color: '#E5484D' }]}>Delete</Text>
                    </TouchableOpacity>
                  </RNView>

                  {/* Days */}
                  {isExpanded && orderedDays.map((routine) => {
                    const isUpNext = isActiveProgram && upNextRoutine?.id === routine.id;
                    return (
                      <RNView key={routine.id}>
                        {isUpNext && (
                          <Text style={[styles.upNextLabel, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>UP NEXT</Text>
                        )}
                        {isUpNext ? (
                          <TutorialTarget id="notes-routine-card">{renderRoutineCard(routine, true)}</TutorialTarget>
                        ) : (
                          renderRoutineCard(routine)
                        )}
                      </RNView>
                    );
                  })}
                </RNView>
              );
            })}

            {/* My Routines — loose routines not tied to a program */}
            {standaloneRoutines.length > 0 && (
              <RNView style={styles.section}>
                <Text style={[styles.sectionLabel, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.semiBold }]}>
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
            <Text style={[styles.renameTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
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
                <Text style={[styles.renameCancelText, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.medium }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.renameSave, { backgroundColor: currentTheme.colors.primary }]} onPress={handleRenameSave} activeOpacity={0.85}>
                <Text style={[styles.renameSaveText, { fontFamily: currentTheme.fonts.semiBold }]}>Save</Text>
              </TouchableOpacity>
            </RNView>
          </RNView>
        </RNView>
      </Modal>
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
  programChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  programChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  programTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  programName: {
    fontSize: 17,
    flexShrink: 1,
  },
  programMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  programActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  upNextLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  renameCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    padding: 20,
  },
  renameTitle: {
    fontSize: 17,
    marginBottom: 14,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  renameButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  renameCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  renameCancelText: {
    fontSize: 15,
  },
  renameSave: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
  },
  renameSaveText: {
    fontSize: 15,
    color: '#fff',
  },

  // Generating banner
  // Scroll content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 120,
  },

  // Progress Button
  progressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  progressButtonText: {
    flex: 1,
    fontSize: 14,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
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
  deloadWarning: {
    fontSize: 10,
  },
  deloadButton: {
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#FF3B3015',
  },
  deloadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  deloadBannerText: {
    fontSize: 12,
    flex: 1,
  },
  deloadBannerButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  deloadBannerButtonText: {
    fontSize: 11,
    color: '#FFFFFF',
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
