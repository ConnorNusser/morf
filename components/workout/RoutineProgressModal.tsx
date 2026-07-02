/**
 * Routine Progress Modal
 * Dashboard with actionable insights, timeline, and consistency stats
 */

import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { calculateAllRoutines } from '@/lib/workout/progressiveOverload';
import { getWorkoutById } from '@/lib/workout/workouts';
import { GeneratedWorkout, MuscleGroup, Routine } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

interface RoutineProgressModalProps {
  visible: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

type ExerciseStatus = 'improving' | 'stable' | 'declining' | 'new';

interface WeightDataPoint {
  weight: number;
  date: Date;
  sessionNumber: number;
}

interface ExerciseProgress {
  exerciseId: string;
  name: string;
  currentWeight: number;
  startWeight: number;
  weightHistory: WeightDataPoint[];
  repBonus: number;
  status: ExerciseStatus;
}

// Next-session guidance for an exercise row, or null when there's nothing to show.
function getStatusLabel(exercise: Pick<ExerciseProgress, 'status' | 'repBonus'>): string | null {
  if (exercise.status === 'improving' && exercise.repBonus >= 3) return 'Weight ↑ next session';
  if (exercise.status === 'improving' && exercise.repBonus > 0) {
    return `+${exercise.repBonus} rep${exercise.repBonus > 1 ? 's' : ''} per set`;
  }
  if (exercise.status === 'declining') return 'Consider deload';
  return null;
}

interface RoutineProgress {
  id: string;
  name: string;
  exercises: ExerciseProgress[];
  completions: number;
  daysSinceLastWorkout: number | null;
  improving: number;
  stable: number;
  declining: number;
}

export default function RoutineProgressModal({
  visible,
  onClose,
  onDataChanged,
}: RoutineProgressModalProps) {
  const { currentTheme } = useTheme();
  const { userProfile } = useUser();
  const weightUnit = userProfile?.weightUnitPreference || 'lbs';

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<GeneratedWorkout[]>([]);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExerciseStatus | null>(null);

  const colors = currentTheme.colors;
  const fonts = currentTheme.fonts;

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
      if (activeRoutines.length > 0) {
        setExpandedRoutineId(activeRoutines[0].id);
      }
    } catch (error) {
      console.error('Error loading routines:', error);
    }
  };

  // Handle manual deload for a specific exercise
  const handleDeloadExercise = async (routineId: string, exerciseId: string) => {
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;

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
    onDataChanged?.();
  };

  const calculatedRoutines = useMemo(() => {
    return calculateAllRoutines(routines, workoutHistory, weightUnit);
  }, [routines, workoutHistory, weightUnit]);

  // Calculate progress for all routines
  const routineProgressList = useMemo((): RoutineProgress[] => {
    return calculatedRoutines.map(routine => {
      const exercises: ExerciseProgress[] = [];
      let improving = 0;
      let stable = 0;
      let declining = 0;

      // Get workouts for this routine, sorted by date
      const routineWorkouts = workoutHistory
        .filter(w => w.routineId === routine.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const lastWorkout = routineWorkouts[routineWorkouts.length - 1];
      const lastWorkoutDate = lastWorkout ? new Date(lastWorkout.createdAt) : null;
      const daysSinceLastWorkout = lastWorkoutDate
        ? Math.floor((Date.now() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      for (const exercise of routine.exercises) {
        const progState = routine.progressionState?.[exercise.exerciseId];

        // Get weight history with dates for this exercise
        const weightHistory: WeightDataPoint[] = [];
        let sessionNum = 0;
        for (const workout of routineWorkouts) {
          const ex = workout.exercises.find(e => e.id === exercise.exerciseId);
          if (!ex?.completedSets?.length) continue;
          const completedSets = ex.completedSets.filter(s => s.completed && s.weight > 0);
          if (completedSets.length === 0) continue;
          sessionNum++;
          weightHistory.push({
            weight: Math.max(...completedSets.map(s => s.weight)),
            date: new Date(workout.createdAt),
            sessionNumber: sessionNum,
          });
        }

        const startWeight = weightHistory.length > 0 ? weightHistory[0].weight : 0;
        const currentWeight = progState?.currentWeight || (weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : 0);
        const repBonus = progState?.currentRepBonus || 0;
        const consecutiveFailures = progState?.consecutiveFailures || 0;

        // Determine status: Improving, Stable, Declining
        let status: ExerciseStatus = 'new';
        if (weightHistory.length === 0) {
          status = 'new';
        } else if (consecutiveFailures >= 2) {
          // Two consecutive failures = declining
          status = 'declining';
          declining++;
        } else if (currentWeight > startWeight || repBonus > 0) {
          // Weight increased OR earning rep bonuses = improving
          status = 'improving';
          improving++;
        } else {
          // Has data but no progress = stable
          status = 'stable';
          stable++;
        }

        exercises.push({
          exerciseId: exercise.exerciseId,
          name: exercise.exerciseName,
          currentWeight,
          startWeight,
          weightHistory,
          repBonus,
          status,
        });
      }

      return {
        id: routine.id,
        name: routine.name,
        exercises,
        completions: routineWorkouts.length,
        daysSinceLastWorkout,
        improving,
        stable,
        declining,
      };
    });
  }, [calculatedRoutines, workoutHistory]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalSessions = routineProgressList.reduce((sum, r) => sum + r.completions, 0);
    const totalImproving = routineProgressList.reduce((sum, r) => sum + r.improving, 0);
    const totalStable = routineProgressList.reduce((sum, r) => sum + r.stable, 0);
    const totalDeclining = routineProgressList.reduce((sum, r) => sum + r.declining, 0);

    return {
      totalSessions,
      totalImproving,
      totalStable,
      totalDeclining,
    };
  }, [routineProgressList]);

  // Muscle balance — completed working sets per major muscle group across all
  // history, for the radar. Glutes fold into Legs; full-body lifts are skipped
  // (no single axis). Powers the "are you training in balance" view.
  const muscleBalance = useMemo(() => {
    const axes: { key: MuscleGroup; label: string }[] = [
      { key: 'chest', label: 'Chest' },
      { key: 'shoulders', label: 'Shoulders' },
      { key: 'arms', label: 'Arms' },
      { key: 'legs', label: 'Legs' },
      { key: 'core', label: 'Core' },
      { key: 'back', label: 'Back' },
    ];
    const counts: Record<string, number> = {};
    axes.forEach(a => { counts[a.key] = 0; });
    for (const workout of workoutHistory) {
      for (const ex of workout.exercises) {
        const sets = ex.completedSets?.filter(s => s.completed && s.weight > 0).length ?? 0;
        if (!sets) continue;
        let muscle = getWorkoutById(ex.id)?.primaryMuscles?.[0] as MuscleGroup | undefined;
        if (!muscle || muscle === 'full-body') continue;
        if (muscle === 'glutes') muscle = 'legs';
        if (counts[muscle] !== undefined) counts[muscle] += sets;
      }
    }
    const values = axes.map(a => counts[a.key]);
    const max = Math.max(1, ...values);
    const total = values.reduce((sum, v) => sum + v, 0);
    return { axes, values, max, total };
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

  const formatLastWorkout = (days: number | null) => {
    if (days === null) return 'Never';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  // Progress dots component - shows rep bonus progress (0-3)
  const ProgressDots = ({ filled, total = 3, color }: { filled: number, total?: number, color: string }) => (
    <View style={styles.progressDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i < filled ? color : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );

  // Historical chart component
  const HistoryChart = ({ data, unit }: { data: WeightDataPoint[], unit: string }) => {
    if (data.length < 1) return null;

    const weights = data.map(d => d.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const chartWidth = 280;
    const chartHeight = 100;
    const paddingBottom = 24;
    const paddingTop = 16;
    const graphHeight = chartHeight - paddingBottom - paddingTop;

    // Calculate points
    const points = data.map((d, i) => ({
      x: data.length === 1 ? chartWidth / 2 : (i / (data.length - 1)) * chartWidth,
      y: paddingTop + graphHeight - ((d.weight - min) / range) * graphHeight,
      weight: d.weight,
      session: d.sessionNumber,
    }));

    const startWeight = data[0].weight;
    const endWeight = data[data.length - 1].weight;
    const totalChange = endWeight - startWeight;

    return (
      <View style={[styles.chartContainer, { backgroundColor: colors.background }]}>
        {/* Chart header */}
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: colors.text + '70', fontFamily: fonts.regular }]}>
            Weight History
          </Text>
          {totalChange !== 0 && (
            <Text style={[styles.chartChange, {
              color: totalChange > 0 ? '#22c55e' : '#ef4444',
              fontFamily: fonts.semiBold
            }]}>
              {totalChange > 0 ? '+' : ''}{totalChange} {unit}
            </Text>
          )}
        </View>

        {/* Chart area */}
        <View style={{ width: chartWidth, height: chartHeight }}>
          {/* Y-axis labels */}
          <Text style={[styles.yLabel, { top: paddingTop - 6, color: colors.text + '40', fontFamily: fonts.regular }]}>
            {max}
          </Text>
          <Text style={[styles.yLabel, { top: paddingTop + graphHeight - 6, color: colors.text + '40', fontFamily: fonts.regular }]}>
            {min}
          </Text>

          {/* Grid lines */}
          <View style={[styles.gridLine, { top: paddingTop, backgroundColor: colors.border }]} />
          <View style={[styles.gridLine, { top: paddingTop + graphHeight / 2, backgroundColor: colors.border }]} />
          <View style={[styles.gridLine, { top: paddingTop + graphHeight, backgroundColor: colors.border }]} />

          {/* Line segments */}
          {points.slice(1).map((point, i) => {
            const prev = points[i];
            const length = Math.sqrt(Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2));
            const angle = Math.atan2(point.y - prev.y, point.x - prev.x) * 180 / Math.PI;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: prev.x,
                  top: prev.y,
                  width: length,
                  height: 2,
                  backgroundColor: colors.primary,
                  borderRadius: 1,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: 'left center',
                }}
              />
            );
          })}

          {/* Data points */}
          {points.map((point, i) => (
            <View
              key={i}
              style={[
                styles.dataPoint,
                {
                  left: point.x - 4,
                  top: point.y - 4,
                  backgroundColor: colors.primary,
                  borderColor: colors.background,
                },
              ]}
            />
          ))}

          {/* X-axis labels */}
          <View style={styles.xLabels}>
            {points.length <= 6 ? (
              points.map((point, i) => (
                <Text
                  key={i}
                  style={[
                    styles.xLabel,
                    { left: point.x - 8, color: colors.text + '50', fontFamily: fonts.regular },
                  ]}
                >
                  #{point.session}
                </Text>
              ))
            ) : (
              <>
                <Text style={[styles.xLabel, { left: points[0].x - 8, color: colors.text + '50', fontFamily: fonts.regular }]}>
                  #{points[0].session}
                </Text>
                <Text style={[styles.xLabel, { left: points[points.length - 1].x - 8, color: colors.text + '50', fontFamily: fonts.regular }]}>
                  #{points[points.length - 1].session}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Summary row */}
        <View style={styles.chartSummary}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryItemLabel, { color: colors.text + '50', fontFamily: fonts.regular }]}>
              Start
            </Text>
            <Text style={[styles.summaryItemValue, { color: colors.text, fontFamily: fonts.medium }]}>
              {startWeight} {unit}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryItemLabel, { color: colors.text + '50', fontFamily: fonts.regular }]}>
              Current
            </Text>
            <Text style={[styles.summaryItemValue, { color: colors.text, fontFamily: fonts.medium }]}>
              {endWeight} {unit}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryItemLabel, { color: colors.text + '50', fontFamily: fonts.regular }]}>
              Sessions
            </Text>
            <Text style={[styles.summaryItemValue, { color: colors.text, fontFamily: fonts.medium }]}>
              {data.length}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Status indicator component
  const StatusIndicator = ({ status, repBonus }: { status: ExerciseStatus, repBonus: number }) => {
    if (status === 'improving') {
      return (
        <View style={styles.statusIndicator}>
          <ProgressDots filled={repBonus} color="#22c55e" />
        </View>
      );
    }
    if (status === 'stable') {
      return (
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDash, { backgroundColor: colors.text + '40' }]} />
        </View>
      );
    }
    if (status === 'declining') {
      return (
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
        </View>
      );
    }
    // new - no data
    return (
      <View style={styles.statusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: colors.border }]} />
      </View>
    );
  };

  // One exercise row — shared by the filtered (cross-routine) list and each
  // routine's expanded list. showRoutineLabel adds the routine name under the
  // exercise (filtered view); showNoData renders the "No data yet" line for new
  // exercises (routine view); deloadRoutineId is the routine the deload targets.
  const renderExerciseRow = (
    exercise: ExerciseProgress & { routineName?: string },
    index: number,
    opts: { deloadRoutineId: string; showRoutineLabel?: boolean; showNoData?: boolean }
  ) => {
    const isExerciseExpanded = expandedExerciseId === exercise.exerciseId;
    const weightGain = exercise.currentWeight - exercise.startWeight;
    const statusLabel = getStatusLabel(exercise);

    return (
      <View key={exercise.exerciseId}>
        <TouchableOpacity
          style={[
            styles.exerciseRow,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
          onPress={() => exercise.weightHistory.length > 0 && toggleExercise(exercise.exerciseId)}
          activeOpacity={exercise.weightHistory.length > 0 ? 0.7 : 1}
        >
          <View style={styles.exerciseLeft}>
            <View style={styles.exerciseNameRow}>
              <StatusIndicator status={exercise.status} repBonus={exercise.repBonus} />
              {opts.showRoutineLabel ? (
                <View>
                  <Text style={[styles.exerciseName, { color: colors.text, fontFamily: fonts.medium }]}>
                    {exercise.name}
                  </Text>
                  <Text style={[styles.routineLabel, { color: colors.text + '50', fontFamily: fonts.regular }]}>
                    {exercise.routineName}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.exerciseName, { color: colors.text, fontFamily: fonts.medium }]}>
                  {exercise.name}
                </Text>
              )}
            </View>

            {exercise.status !== 'new' && (
              <View style={styles.exerciseDetail}>
                <Text style={[styles.weightText, { color: colors.text + '70', fontFamily: fonts.regular }]}>
                  {exercise.currentWeight} {weightUnit}
                  {weightGain > 0 && (
                    <Text style={{ color: '#22c55e' }}> (+{weightGain})</Text>
                  )}
                </Text>
                {statusLabel && (
                  exercise.status === 'declining' ? (
                    <TouchableOpacity
                      onPress={() => handleDeloadExercise(opts.deloadRoutineId, exercise.exerciseId)}
                      style={styles.deloadButton}
                    >
                      <Text style={[styles.statusLabel, { color: '#ef4444', fontFamily: fonts.medium }]}>
                        Tap to deload
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[
                      styles.statusLabel,
                      {
                        color: exercise.repBonus >= 3 ? '#f59e0b' : colors.primary,
                        fontFamily: fonts.medium,
                      }
                    ]}>
                      {statusLabel}
                    </Text>
                  )
                )}
              </View>
            )}

            {opts.showNoData && exercise.status === 'new' && (
              <Text style={[styles.noDataText, { color: colors.text + '40', fontFamily: fonts.regular }]}>
                No data yet
              </Text>
            )}
          </View>

          {exercise.weightHistory.length > 0 && (
            <Ionicons
              name={isExerciseExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.text + '30'}
            />
          )}
        </TouchableOpacity>

        {isExerciseExpanded && exercise.weightHistory.length > 0 && (
          <View style={[styles.chartWrapper, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <HistoryChart data={exercise.weightHistory} unit={weightUnit} />
          </View>
        )}
      </View>
    );
  };

  // Muscle-balance radar — drawn with SVG so it matches the app's flat style.
  const MuscleRadar = ({ axes, values, max }: { axes: { key: MuscleGroup; label: string }[]; values: number[]; max: number }) => {
    const size = 230;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 34; // leave room for labels
    const n = axes.length;
    const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2; // start at top
    const at = (i: number, frac: number) => ({
      x: cx + Math.cos(angleFor(i)) * r * frac,
      y: cy + Math.sin(angleFor(i)) * r * frac,
    });
    const ringFracs = [0.34, 0.67, 1];
    const ringPoly = (frac: number) =>
      axes.map((_, i) => { const p = at(i, frac); return `${p.x},${p.y}`; }).join(' ');
    const dataPoly = values.map((v, i) => { const p = at(i, max > 0 ? v / max : 0); return `${p.x},${p.y}`; }).join(' ');
    const grid = colors.text + '18';
    const green = '#34C759';

    return (
      <Svg width={size} height={size}>
        {/* concentric grid rings */}
        {ringFracs.map((f, idx) => (
          <Polygon key={`ring-${idx}`} points={ringPoly(f)} fill="none" stroke={grid} strokeWidth={1} />
        ))}
        {/* spokes */}
        {axes.map((_, i) => {
          const p = at(i, 1);
          return <Line key={`spoke-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={grid} strokeWidth={1} />;
        })}
        {/* data polygon */}
        <Polygon points={dataPoly} fill={green + '33'} stroke={green} strokeWidth={2} />
        {/* vertices */}
        {values.map((v, i) => { const p = at(i, max > 0 ? v / max : 0); return <Circle key={`v-${i}`} cx={p.x} cy={p.y} r={2.5} fill={green} />; })}
        {/* axis labels */}
        {axes.map((a, i) => {
          const lp = at(i, 1);
          const lx = cx + (lp.x - cx) * 1.18;
          const ly = cy + (lp.y - cy) * 1.18;
          return (
            <SvgText
              key={`label-${i}`}
              x={lx}
              y={ly + 3}
              fill={colors.text + '99'}
              fontSize={11}
              fontFamily={fonts.medium}
              textAnchor="middle"
            >
              {a.label}
            </SvgText>
          );
        })}
      </Svg>
    );
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
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
            Progress
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>

        {routineProgressList.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="barbell-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
              No Progress Yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.text + '60', fontFamily: fonts.regular }]}>
              Complete workouts to track your gains
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Muscle balance radar */}
            {muscleBalance.total > 0 && (
              <View style={[styles.radarCard, { borderColor: colors.text + '1A' }]}>
                <Text style={[styles.radarTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  Muscle Balance
                </Text>
                <Text style={[styles.radarCaption, { color: colors.text + '55', fontFamily: fonts.regular }]}>
                  Working sets by muscle group · all time
                </Text>
                <View style={styles.radarWrap}>
                  <MuscleRadar axes={muscleBalance.axes} values={muscleBalance.values} max={muscleBalance.max} />
                </View>
              </View>
            )}

            {/* Summary Cards - Tappable filters */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderColor: colors.text + '1A' }]}>
                <Text style={[styles.summaryValue, { color: colors.text, fontFamily: fonts.semiBold }]}>
                  {overallStats.totalSessions}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text + '60', fontFamily: fonts.regular }]}>
                  sessions
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: statusFilter === 'improving' ? '#22c55e20' : 'transparent',
                    borderColor: statusFilter === 'improving' ? '#22c55e' : colors.text + '1A',
                  },
                ]}
                onPress={() => toggleFilter('improving')}
                activeOpacity={0.7}
              >
                <Text style={[styles.summaryValue, { color: '#22c55e', fontFamily: fonts.semiBold }]}>
                  {overallStats.totalImproving}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text + '60', fontFamily: fonts.regular }]}>
                  improving
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: statusFilter === 'stable' ? colors.text + '10' : 'transparent',
                    borderColor: statusFilter === 'stable' ? colors.text + '40' : colors.text + '1A',
                  },
                ]}
                onPress={() => toggleFilter('stable')}
                activeOpacity={0.7}
              >
                <Text style={[styles.summaryValue, { color: colors.text + '70', fontFamily: fonts.semiBold }]}>
                  {overallStats.totalStable}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text + '60', fontFamily: fonts.regular }]}>
                  stable
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: statusFilter === 'declining' ? '#ef444420' : 'transparent',
                    borderColor: statusFilter === 'declining' ? '#ef4444' : colors.text + '1A',
                  },
                ]}
                onPress={() => toggleFilter('declining')}
                activeOpacity={0.7}
              >
                <Text style={[styles.summaryValue, { color: '#ef4444', fontFamily: fonts.semiBold }]}>
                  {overallStats.totalDeclining}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.text + '60', fontFamily: fonts.regular }]}>
                  declining
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filtered Exercise List - flat view when filter is active */}
            {statusFilter && (
              <>
              {/* Clear-filter bar — explicit way back to the full view, since the
                  summary cards only deselect on an exact re-tap. */}
              <View style={styles.filterBar}>
                <Text style={[styles.filterBarLabel, { color: colors.text + '99', fontFamily: fonts.medium }]}>
                  Showing {statusFilter}
                </Text>
                <TouchableOpacity
                  onPress={() => setStatusFilter(null)}
                  style={[styles.clearChip, { borderColor: colors.text + '1A' }]}
                  activeOpacity={0.6}
                >
                  <Ionicons name="close" size={13} color={colors.text + 'CC'} />
                  <Text style={[styles.clearChipText, { color: colors.text + 'CC', fontFamily: fonts.medium }]}>Show all</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.exerciseList, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.text + '1A', marginBottom: 12 }]}>
                {routineProgressList.flatMap(routine =>
                  routine.exercises
                    .filter(e => e.status === statusFilter)
                    .map(exercise => ({ ...exercise, routineName: routine.name, routineId: routine.id }))
                ).map((exercise, index) =>
                  renderExerciseRow(exercise, index, {
                    deloadRoutineId: exercise.routineId,
                    showRoutineLabel: true,
                  })
                )}
              </View>
              </>
            )}

            {/* Routines - normal view when no filter */}
            {!statusFilter && routineProgressList.map((routine) => {
              const isExpanded = expandedRoutineId === routine.id;

              return (
                <View key={routine.id} style={styles.routineSection}>
                  {/* Routine Header */}
                  <TouchableOpacity
                    style={[styles.routineHeader, { backgroundColor: 'transparent', borderColor: colors.text + '1A' }]}
                    onPress={() => toggleRoutine(routine.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.routineHeaderTop}>
                      <Text style={[styles.routineName, { color: colors.text, fontFamily: fonts.semiBold }]}>
                        {routine.name}
                      </Text>
                      <View style={styles.headerBadges}>
                        {routine.improving > 0 && (
                          <View style={[styles.miniBadge, { backgroundColor: '#22c55e20' }]}>
                            <Text style={[styles.miniBadgeText, { color: '#22c55e', fontFamily: fonts.medium }]}>
                              {routine.improving} improving
                            </Text>
                          </View>
                        )}
                        {routine.declining > 0 && (
                          <View style={[styles.miniBadge, { backgroundColor: '#ef444420' }]}>
                            <Text style={[styles.miniBadgeText, { color: '#ef4444', fontFamily: fonts.medium }]}>
                              {routine.declining} declining
                            </Text>
                          </View>
                        )}
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colors.text + '40'}
                        />
                      </View>
                    </View>

                    <View style={styles.routineMeta}>
                      <Text style={[styles.metaText, { color: colors.text + '50', fontFamily: fonts.regular }]}>
                        {routine.completions} sessions · Last: {formatLastWorkout(routine.daysSinceLastWorkout)}
                      </Text>
                    </View>

                    {/* Per-exercise status strip — one segment per lift, colored
                        by trend (matches the routines-screen momentum bar). */}
                    {routine.exercises.length > 0 && (
                      <View style={styles.distBar}>
                        {routine.exercises.map((ex, i) => {
                          const c = ex.status === 'improving' ? '#34C759'
                            : ex.status === 'declining' ? '#ef4444'
                            : ex.status === 'stable' ? colors.text + '40'
                            : colors.text + '15';
                          return <View key={`${ex.exerciseId}-${i}`} style={[styles.distSeg, { backgroundColor: c }]} />;
                        })}
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <View style={[styles.exerciseList, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.text + '1A' }]}>
                      {routine.exercises.map((exercise, index) =>
                        renderExerciseRow(exercise, index, {
                          deloadRoutineId: routine.id,
                          showNoData: true,
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={{ height: 40 }} />
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
  },

  // Radar
  radarCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  radarTitle: {
    fontSize: 15,
  },
  radarCaption: {
    fontSize: 12,
    marginTop: 3,
  },
  radarWrap: {
    alignItems: 'center',
    marginTop: 8,
  },

  // Clear-filter bar above the filtered list
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterBarLabel: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearChipText: {
    fontSize: 12.5,
  },

  // Per-exercise status strip (routine header)
  distBar: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 10,
  },
  distSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },

  // Progress dots
  progressDots: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Status indicator
  statusIndicator: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDash: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },

  // Routine Section
  routineSection: {
    marginBottom: 12,
  },
  routineHeader: {
    padding: 14,
    borderRadius: 12,
  },
  routineHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineName: {
    fontSize: 15,
    flex: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  miniBadgeText: {
    fontSize: 11,
  },
  routineMeta: {
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
  },

  // Exercise List
  exerciseList: {
    marginTop: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  exerciseLeft: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    fontSize: 14,
  },
  routineLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  exerciseDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginLeft: 28,
  },
  weightText: {
    fontSize: 13,
  },
  statusLabel: {
    fontSize: 11,
  },
  deloadButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#ef444415',
  },
  noDataText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 28,
  },

  // Chart
  chartWrapper: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chartContainer: {
    borderRadius: 10,
    padding: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 12,
  },
  chartChange: {
    fontSize: 13,
  },
  yLabel: {
    position: 'absolute',
    left: -4,
    fontSize: 10,
  },
  gridLine: {
    position: 'absolute',
    left: 20,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  xLabels: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
  },
  xLabel: {
    position: 'absolute',
    bottom: 0,
    fontSize: 10,
  },
  chartSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryItemLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  summaryItemValue: {
    fontSize: 14,
  },
  summaryDivider: {
    width: 1,
    height: 24,
  },
});
