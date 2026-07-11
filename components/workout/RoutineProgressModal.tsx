// Routine progress dashboard: insights, timeline, consistency stats.

import Chip from '@/components/Chip';
import IconButton from '@/components/IconButton';
import { Text, useInk } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { radius, screenGutter, space, tint, trend } from '@/lib/ui/tokens';
import { calculateAllRoutines } from '@/lib/workout/progressiveOverload';
import { loadExerciseRecords } from '@/lib/workout/exerciseRecordsStore';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { ExerciseRecord, LoggedWorkout, MuscleGroup, Routine } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

interface RoutineProgressModalProps {
  visible: boolean;
  onClose: () => void;
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

// Next-session guidance for a row, or null when there's nothing to show.
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
}: RoutineProgressModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
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
    return calculatedRoutines.map(routine => {
      const exercises: ExerciseProgress[] = [];
      let improving = 0;
      let stable = 0;
      let declining = 0;

      const routineWorkouts = workoutHistory
        .filter(w => w.routineId === routine.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const lastWorkout = routineWorkouts[routineWorkouts.length - 1];
      const lastWorkoutDate = lastWorkout ? new Date(lastWorkout.createdAt) : null;
      const daysSinceLastWorkout = lastWorkoutDate
        ? Math.floor((Date.now() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      for (const exercise of routine.exercises) {
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
        const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : exercise.workingWeight;

        // Status comes from the reactive engine's indicator (record-anchored).
        let status: ExerciseStatus = 'new';
        if (weightHistory.length === 0) {
          status = 'new';
        } else if (exercise.progression === 'decrease') {
          status = 'declining';
          declining++;
        } else if (exercise.progression === 'increase') {
          status = 'improving';
          improving++;
        } else {
          status = 'stable';
          stable++;
        }

        exercises.push({
          exerciseId: exercise.exerciseId,
          name: exercise.exerciseName,
          currentWeight,
          startWeight,
          weightHistory,
          repBonus: 0,
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

  // Working sets per muscle group for the radar; glutes fold into Legs, full-body lifts skipped.
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
        let muscle = getCatalogExercise(ex.id)?.primaryMuscles?.[0] as MuscleGroup | undefined;
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

  const ProgressDots =({ filled, total = 3, color }: { filled: number, total?: number, color: string }) => (
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

  const HistoryChart =({ data, unit }: { data: WeightDataPoint[], unit: string }) => {
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
        <View style={styles.chartHeader}>
          <Text variant="meta" tone="muted">
            Weight History
          </Text>
          {totalChange !== 0 && (
            <Text
              variant="meta"
              weight="semiBold"
              style={{ color: totalChange > 0 ? trend.up : trend.down }}
            >
              {totalChange > 0 ? '+' : ''}{totalChange} {unit}
            </Text>
          )}
        </View>

        <View style={{ width: chartWidth, height: chartHeight }}>
          {/* Y-axis fontSize is chart geometry (fits the fixed 100pt plot). */}
          <Text style={[styles.yLabel, { top: paddingTop - 6, color: ink.faint }]}>
            {max}
          </Text>
          <Text style={[styles.yLabel, { top: paddingTop + graphHeight - 6, color: ink.faint }]}>
            {min}
          </Text>

          <View style={[styles.gridLine, { top: paddingTop, backgroundColor: colors.border }]} />
          <View style={[styles.gridLine, { top: paddingTop + graphHeight / 2, backgroundColor: colors.border }]} />
          <View style={[styles.gridLine, { top: paddingTop + graphHeight, backgroundColor: colors.border }]} />

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

          <View style={styles.xLabels}>
            {points.length <= 6 ? (
              points.map((point, i) => (
                <Text
                  key={i}
                  style={[styles.xLabel, { left: point.x - 8, color: ink.faint }]}
                >
                  #{point.session}
                </Text>
              ))
            ) : (
              <>
                <Text style={[styles.xLabel, { left: points[0].x - 8, color: ink.faint }]}>
                  #{points[0].session}
                </Text>
                <Text style={[styles.xLabel, { left: points[points.length - 1].x - 8, color: ink.faint }]}>
                  #{points[points.length - 1].session}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.chartSummary}>
          <View style={styles.summaryItem}>
            <Text variant="meta" tone="faint" style={styles.summaryItemLabel}>
              Start
            </Text>
            <Text variant="meta" tone="primary" weight="medium">
              {startWeight} {unit}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text variant="meta" tone="faint" style={styles.summaryItemLabel}>
              Current
            </Text>
            <Text variant="meta" tone="primary" weight="medium">
              {endWeight} {unit}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text variant="meta" tone="faint" style={styles.summaryItemLabel}>
              Sessions
            </Text>
            <Text variant="meta" tone="primary" weight="medium">
              {data.length}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const StatusIndicator =({ status, repBonus }: { status: ExerciseStatus, repBonus: number }) => {
    if (status === 'improving') {
      return (
        <View style={styles.statusIndicator}>
          <ProgressDots filled={repBonus} color={trend.up} />
        </View>
      );
    }
    if (status === 'stable') {
      return (
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDash, { backgroundColor: ink.faint }]} />
        </View>
      );
    }
    if (status === 'declining') {
      return (
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: trend.down }]} />
        </View>
      );
    }
    return (
      <View style={styles.statusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: colors.border }]} />
      </View>
    );
  };

  // Shared by the filtered cross-routine list and each routine's expanded list.
  const renderExerciseRow = (
    exercise: ExerciseProgress & { routineName?: string },
    index: number,
    opts: { showRoutineLabel?: boolean; showNoData?: boolean }
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
                  <Text variant="meta" tone="primary" weight="medium">
                    {exercise.name}
                  </Text>
                  <Text variant="meta" tone="faint" style={styles.routineLabel}>
                    {exercise.routineName}
                  </Text>
                </View>
              ) : (
                <Text variant="meta" tone="primary" weight="medium">
                  {exercise.name}
                </Text>
              )}
            </View>

            {exercise.status !== 'new' && (
              <View style={styles.exerciseDetail}>
                <Text variant="meta" tone="muted">
                  {exercise.currentWeight} {weightUnit}
                  {weightGain > 0 && (
                    <Text variant="meta" style={{ color: trend.up }}> (+{weightGain})</Text>
                  )}
                </Text>
                {statusLabel && (
                  // Engine deloads automatically now — this is just the label, no manual button.
                  <Text
                    variant="meta"
                    weight="medium"
                    style={{ color: exercise.status === 'declining' ? trend.down : colors.primary }}
                  >
                    {statusLabel}
                  </Text>
                )}
              </View>
            )}

            {opts.showNoData && exercise.status === 'new' && (
              <Text variant="meta" tone="faint" style={styles.noDataText}>
                No data yet
              </Text>
            )}
          </View>

          {exercise.weightHistory.length > 0 && (
            <Ionicons
              name={isExerciseExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={ink.faint}
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
    const grid = ink.ghost;
    const green = trend.up;

    return (
      <Svg width={size} height={size}>
        {ringFracs.map((f, idx) => (
          <Polygon key={`ring-${idx}`} points={ringPoly(f)} fill="none" stroke={grid} strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const p = at(i, 1);
          return <Line key={`spoke-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={grid} strokeWidth={1} />;
        })}
        <Polygon points={dataPoly} fill={tint(green)} stroke={green} strokeWidth={2} />
        {values.map((v, i) => { const p = at(i, max > 0 ? v / max : 0); return <Circle key={`v-${i}`} cx={p.x} cy={p.y} r={2.5} fill={green} />; })}
        {/* SVG fontSize is chart geometry (sized to the 230pt radar). */}
        {axes.map((a, i) => {
          const lp = at(i, 1);
          const lx = cx + (lp.x - cx) * 1.18;
          const ly = cy + (lp.y - cy) * 1.18;
          return (
            <SvgText
              key={`label-${i}`}
              x={lx}
              y={ly + 3}
              fill={ink.secondary}
              fontSize={11}
              fontWeight="500"
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
              art={require('@/assets/images/sl/flex.png')}
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
              <View style={[styles.radarCard, { borderColor: ink.ghost }]}>
                <Text variant="body" tone="primary" weight="semiBold">
                  Muscle Balance
                </Text>
                <Text variant="meta" tone="muted" style={styles.radarCaption}>
                  Working sets by muscle group · all time
                </Text>
                <View style={styles.radarWrap}>
                  <MuscleRadar axes={muscleBalance.axes} values={muscleBalance.values} max={muscleBalance.max} />
                </View>
              </View>
            )}

            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderColor: ink.ghost }]}>
                <Text variant="title" tone="primary" weight="semiBold">
                  {overallStats.totalSessions}
                </Text>
                <Text variant="meta" tone="muted" style={styles.summaryLabel}>
                  sessions
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: statusFilter === 'improving' ? tint(trend.up) : 'transparent',
                    borderColor: statusFilter === 'improving' ? trend.up : ink.ghost,
                  },
                ]}
                onPress={() => toggleFilter('improving')}
                activeOpacity={0.7}
              >
                <Text variant="title" weight="semiBold" style={{ color: trend.up }}>
                  {overallStats.totalImproving}
                </Text>
                <Text variant="meta" tone="muted" style={styles.summaryLabel}>
                  improving
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: statusFilter === 'stable' ? ink.hairline : 'transparent',
                    borderColor: statusFilter === 'stable' ? ink.faint : ink.ghost,
                  },
                ]}
                onPress={() => toggleFilter('stable')}
                activeOpacity={0.7}
              >
                <Text variant="title" tone="muted" weight="semiBold">
                  {overallStats.totalStable}
                </Text>
                <Text variant="meta" tone="muted" style={styles.summaryLabel}>
                  stable
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: statusFilter === 'declining' ? tint(trend.down) : 'transparent',
                    borderColor: statusFilter === 'declining' ? trend.down : ink.ghost,
                  },
                ]}
                onPress={() => toggleFilter('declining')}
                activeOpacity={0.7}
              >
                <Text variant="title" weight="semiBold" style={{ color: trend.down }}>
                  {overallStats.totalDeclining}
                </Text>
                <Text variant="meta" tone="muted" style={styles.summaryLabel}>
                  declining
                </Text>
              </TouchableOpacity>
            </View>

            {statusFilter && (
              <>
              {/* Explicit way back to the full view; summary cards only deselect on exact re-tap. */}
              <View style={styles.filterBar}>
                <Text variant="meta" tone="secondary" weight="medium" style={styles.filterBarLabel}>
                  Showing {statusFilter}
                </Text>
                <Chip
                  label="Show all"
                  size="small"
                  onPress={() => setStatusFilter(null)}
                />
              </View>
              <View style={[styles.exerciseList, styles.filteredList, { borderColor: ink.ghost }]}>
                {routineProgressList.flatMap(routine =>
                  routine.exercises
                    .filter(e => e.status === statusFilter)
                    .map(exercise => ({ ...exercise, routineName: routine.name, routineId: routine.id }))
                ).map((exercise, index) =>
                  renderExerciseRow(exercise, index, {
                    showRoutineLabel: true,
                  })
                )}
              </View>
              </>
            )}

            {!statusFilter && routineProgressList.map((routine) => {
              const isExpanded = expandedRoutineId === routine.id;

              return (
                <View key={routine.id} style={styles.routineSection}>
                  <TouchableOpacity
                    style={styles.routineHeader}
                    onPress={() => toggleRoutine(routine.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.routineHeaderTop}>
                      <Text variant="body" tone="primary" weight="semiBold" style={styles.routineName}>
                        {routine.name}
                      </Text>
                      <View style={styles.headerBadges}>
                        {routine.improving > 0 && (
                          <View style={[styles.miniBadge, { backgroundColor: tint(trend.up) }]}>
                            <Text variant="meta" weight="medium" style={{ color: trend.up }}>
                              {routine.improving} improving
                            </Text>
                          </View>
                        )}
                        {routine.declining > 0 && (
                          <View style={[styles.miniBadge, { backgroundColor: tint(trend.down) }]}>
                            <Text variant="meta" weight="medium" style={{ color: trend.down }}>
                              {routine.declining} declining
                            </Text>
                          </View>
                        )}
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={ink.faint}
                        />
                      </View>
                    </View>

                    <View style={styles.routineMeta}>
                      <Text variant="meta" tone="faint">
                        {routine.completions} sessions · Last: {formatLastWorkout(routine.daysSinceLastWorkout)}
                      </Text>
                    </View>

                    {/* One segment per lift, colored by trend (matches the routines-screen momentum bar). */}
                    {routine.exercises.length > 0 && (
                      <View style={styles.distBar}>
                        {routine.exercises.map((ex, i) => {
                          const c = ex.status === 'improving' ? trend.up
                            : ex.status === 'declining' ? trend.down
                            : ex.status === 'stable' ? ink.faint
                            : ink.ghost;
                          return <View key={`${ex.exerciseId}-${i}`} style={[styles.distSeg, { backgroundColor: c }]} />;
                        })}
                      </View>
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.exerciseList, { borderWidth: 1, borderColor: ink.ghost }]}>
                      {routine.exercises.map((exercise, index) =>
                        renderExerciseRow(exercise, index, {
                          showNoData: true,
                        })
                      )}
                    </View>
                  )}
                </View>
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

  summaryRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.xl,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    marginTop: space.xs,
  },

  radarCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.lg,
  },
  radarCaption: {
    marginTop: space.xs,
  },
  radarWrap: {
    alignItems: 'center',
    marginTop: space.sm,
  },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  filterBarLabel: {
    textTransform: 'capitalize',
  },
  filteredList: {
    borderWidth: 1,
    marginBottom: space.md,
  },

  distBar: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.md,
  },
  distSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },

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

  routineSection: {
    marginBottom: space.md,
  },
  routineHeader: {
    padding: space.lg,
    borderRadius: radius.card,
  },
  routineHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineName: {
    flex: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
    gap: space.xs,
  },
  routineMeta: {
    marginTop: space.sm,
  },

  exerciseList: {
    marginTop: space.xs,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  exerciseLeft: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  routineLabel: {
    marginTop: space.xs,
  },
  exerciseDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xs,
    marginLeft: 28,
  },
  noDataText: {
    marginTop: space.xs,
    marginLeft: 28,
  },

  chartWrapper: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  chartContainer: {
    borderRadius: radius.card,
    padding: space.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  // Axis labels keep 10pt: chart geometry against the fixed 280×100 plot.
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
    marginTop: space.md,
    paddingTop: space.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryItemLabel: {
    marginBottom: space.xs,
  },
  summaryDivider: {
    width: 1,
    height: 24,
  },
  bottomSpacer: {
    height: 40,
  },
});
