import { AuroraSurface } from '@/components/history/AuroraSurface';
import IconButton from '@/components/IconButton';
import { Text, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { MUSCLE_TO_PPL, PPL_COLORS, PPL_LABELS, PPLCategory } from '@/lib/data/pplCategories';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { storageService } from '@/lib/storage/storage';
import { radius } from '@/lib/ui/tokens';
import { type as typeScale } from '@/lib/ui/typography';
import {
  calculateWorkoutStats,
  combineWorkoutStats,
  formatCompact,
  formatDistance,
  formatDuration,
  formatHoursCompact,
  formatMinutes as formatTime,
  getWorkoutCategory,
} from '@/lib/utils/utils';
import {
  DEFAULT_WEEKLY_GOAL,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
} from '@/lib/workout/weeklyGoal';
import { getExercise } from '@/lib/workout/workouts';
import { GeneratedWorkout, TrackingType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface WeeklyOverviewModalProps {
  visible: boolean;
  onClose: () => void;
  invocationType: 'day' | 'week' | 'volume' | 'time';
  workouts: GeneratedWorkout[];
  selectedDate?: Date;
  weekStartDate?: Date;
  weekEndDate?: Date;
  /** Full workout history — enables this-week Personal Records detection. */
  allWorkouts?: GeneratedWorkout[];
  onWeeklyGoalChange?: (goal: number) => void;
}

// Push/Pull/Legs share the app-wide PPL palette; upper/full keep distinct accents.
const CATEGORY_COLORS: Record<string, string> = {
  push: PPL_COLORS.push,
  pull: PPL_COLORS.pull,
  legs: PPL_COLORS.legs,
  upper: '#FFA726',
  full: '#AB47BC',
};

const GOAL_OPTIONS = Array.from(
  { length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 },
  (_, i) => WEEKLY_GOAL_MIN + i
);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const cleanName = (id: string) =>
  id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
const fmtDay = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function WeeklyOverviewModal({
  visible,
  onClose,
  invocationType,
  workouts,
  selectedDate,
  weekStartDate,
  weekEndDate,
  allWorkouts,
  onWeeklyGoalChange,
}: WeeklyOverviewModalProps) {
  const { currentTheme } = useTheme();
  const { customExercises } = useCustomExercises();
  const insets = useSafeAreaInsets();
  const ink = useInk();
  const c = currentTheme.colors;

  const [goal, setGoal] = useState<number>(DEFAULT_WEEKLY_GOAL);

  useEffect(() => {
    if (!visible || invocationType !== 'week') return;
    let active = true;
    storageService.getWeeklyGoal().then(g => {
      if (active && typeof g === 'number') setGoal(g);
    });
    return () => {
      active = false;
    };
  }, [visible, invocationType]);

  const changeGoal = (next: number) => {
    setGoal(next);
    storageService.saveWeeklyGoal(next);
    onWeeklyGoalChange?.(next);
  };

  const getTrackingType = (exerciseId: string): TrackingType | undefined =>
    getExercise(exerciseId)?.trackingType;

  const categoryColor = (category: string): string =>
    CATEGORY_COLORS[category] || c.accent;

  const pplForExercise = (exerciseId: string): PPLCategory | null => {
    const muscle = getExercise(exerciseId)?.primaryMuscles?.[0];
    return muscle ? MUSCLE_TO_PPL[muscle] ?? null : null;
  };

  const exerciseColor = (exerciseId: string): string => {
    const ppl = pplForExercise(exerciseId);
    return ppl ? PPL_COLORS[ppl] : c.primary;
  };

  const analyticsData = useMemo(() => {
    const combinedStats = combineWorkoutStats(
      workouts.map(w => calculateWorkoutStats(w.exercises, getTrackingType))
    );

    const totalVolume = combinedStats.totalVolumeLbs;
    const totalTime = workouts.reduce((s, w) => s + w.estimatedDuration, 0);
    const totalSets = combinedStats.totalSets;
    const totalReps = workouts.reduce(
      (s, w) =>
        s +
        w.exercises.reduce(
          (es, ex) => es + ex.completedSets.reduce((ss, set) => ss + (set.reps || 0), 0),
          0
        ),
      0
    );

    const categoryBreakdown = workouts.reduce((acc, workout) => {
      const category = getWorkoutCategory(workout);
      if (!acc[category]) {
        acc[category] = { count: 0, volume: 0, time: 0, sets: 0, avgVolume: 0, avgTime: 0 };
      }
      acc[category].count += 1;
      acc[category].time += workout.estimatedDuration;
      acc[category].sets += workout.exercises.reduce((s, ex) => s + ex.completedSets.length, 0);
      acc[category].volume += workout.exercises.reduce(
        (s, ex) => s + ex.completedSets.reduce((ss, set) => ss + set.weight * set.reps, 0),
        0
      );
      return acc;
    }, {} as Record<string, { count: number; volume: number; time: number; sets: number; avgVolume: number; avgTime: number }>);
    Object.values(categoryBreakdown).forEach(d => {
      d.avgVolume = d.volume / d.count;
      d.avgTime = d.time / d.count;
    });

    const exerciseMap = workouts.reduce((acc, workout) => {
      workout.exercises.forEach(exercise => {
        if (!acc[exercise.id]) {
          acc[exercise.id] = { name: exercise.id, totalVolume: 0, totalSets: 0, sessions: 0, maxWeight: 0, totalReps: 0 };
        }
        acc[exercise.id].sessions += 1;
        acc[exercise.id].totalSets += exercise.completedSets.length;
        exercise.completedSets.forEach(set => {
          acc[exercise.id].totalVolume += set.weight * set.reps;
          acc[exercise.id].totalReps += set.reps;
          acc[exercise.id].maxWeight = Math.max(acc[exercise.id].maxWeight, set.weight);
        });
      });
      return acc;
    }, {} as Record<string, { name: string; totalVolume: number; totalSets: number; sessions: number; maxWeight: number; totalReps: number }>);
    const topExercises = Object.values(exerciseMap).sort((a, b) => b.totalVolume - a.totalVolume);

    const dailyBreakdown = workouts.reduce((acc, workout) => {
      const day = new Date(workout.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
      if (!acc[day]) acc[day] = { workouts: 0, volume: 0, time: 0 };
      acc[day].workouts += 1;
      acc[day].time += workout.estimatedDuration;
      acc[day].volume += workout.exercises.reduce(
        (s, ex) => s + ex.completedSets.reduce((ss, set) => ss + set.weight * set.reps, 0),
        0
      );
      return acc;
    }, {} as Record<string, { workouts: number; volume: number; time: number }>);

    const workoutSummaries = [...workouts]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(workout => {
        const stats = calculateWorkoutStats(workout.exercises, getTrackingType);
        const date = new Date(workout.createdAt);
        return {
          id: workout.id,
          title: workout.title,
          category: getWorkoutCategory(workout),
          weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: date.getDate(),
          duration: workout.estimatedDuration,
          exercises: workout.exercises.length,
          sets: stats.totalSets,
          volume: stats.totalVolumeLbs,
        };
      });

    const daysTrained = new Set(workouts.map(w => new Date(w.createdAt).toDateString())).size;

    const pplBreakdown: Record<PPLCategory, { sets: number; volume: number }> = {
      push: { sets: 0, volume: 0 },
      pull: { sets: 0, volume: 0 },
      legs: { sets: 0, volume: 0 },
    };
    workouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        const ppl = pplForExercise(exercise.id);
        if (!ppl) return;
        pplBreakdown[ppl].sets += exercise.completedSets.length;
        pplBreakdown[ppl].volume += exercise.completedSets.reduce(
          (s, set) => s + set.weight * set.reps,
          0
        );
      });
    });

    return {
      totalVolume,
      totalTime,
      totalSets,
      totalReps,
      categoryBreakdown,
      topExercises,
      dailyBreakdown,
      workoutSummaries,
      daysTrained,
      pplBreakdown,
      avgWorkoutDuration: workouts.length ? totalTime / workouts.length : 0,
      avgVolumePerWorkout: workouts.length ? totalVolume / workouts.length : 0,
      hasCardio: combinedStats.hasCardioExercises,
      totalDistanceMeters: combinedStats.totalDistanceMeters,
      totalCardioDurationSeconds: combinedStats.totalCardioDurationSeconds,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getTrackingType is stable
  }, [workouts, customExercises]);

  const a = analyticsData;
  const fmtVol = (v: number) => formatCompact(v, { suffix: ' lbs' });

  // PRs set THIS week: best estimated 1RM this week beats its best from all prior history.
  const weeklyPRs = useMemo(() => {
    if (invocationType !== 'week' || !allWorkouts?.length || !weekStartDate) return [];
    const startMs = weekStartDate.getTime();

    const bestBefore = new Map<string, number>();
    const bestThisWeek = new Map<string, { e1rm: number; weight: number; reps: number }>();

    for (const workout of allWorkouts) {
      const isThisWeek = new Date(workout.createdAt).getTime() >= startMs;
      for (const exercise of workout.exercises || []) {
        for (const set of exercise.completedSets || []) {
          if (!set.completed || set.weight <= 0) continue;
          const e1rm = OneRMCalculator.estimate(set.weight, set.reps);
          if (isThisWeek) {
            const prev = bestThisWeek.get(exercise.id);
            if (!prev || e1rm > prev.e1rm) {
              bestThisWeek.set(exercise.id, { e1rm, weight: set.weight, reps: set.reps });
            }
          } else {
            bestBefore.set(exercise.id, Math.max(bestBefore.get(exercise.id) ?? 0, e1rm));
          }
        }
      }
    }

    const prs: {
      exerciseId: string;
      name: string;
      e1rm: number;
      weight: number;
      reps: number;
      improvement: number;
      ppl: PPLCategory | null;
    }[] = [];
    for (const [id, week] of bestThisWeek) {
      const prior = bestBefore.get(id) ?? 0;
      if (prior > 0 && week.e1rm > prior) {
        prs.push({
          exerciseId: id,
          name: getExercise(id)?.name ?? cleanName(id),
          e1rm: Math.round(week.e1rm),
          weight: Math.round(week.weight),
          reps: week.reps,
          improvement: Math.round(week.e1rm - prior),
          ppl: pplForExercise(id),
        });
      }
    }
    return prs.sort((x, y) => y.improvement - x.improvement);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers are stable
  }, [invocationType, allWorkouts, weekStartDate, customExercises]);

  const weekRange = useMemo(() => {
    if (weekStartDate) {
      const end = weekEndDate ?? new Date(weekStartDate.getTime() + 6 * 86400000);
      return `${fmtDay(weekStartDate)} – ${fmtDay(end)}`;
    }
    if (workouts.length) {
      const dates = workouts.map(w => new Date(w.createdAt).getTime());
      return `${fmtDay(new Date(Math.min(...dates)))} – ${fmtDay(new Date(Math.max(...dates)))}`;
    }
    return undefined;
  }, [weekStartDate, weekEndDate, workouts]);

  const headerTitle = (() => {
    switch (invocationType) {
      case 'day':
        return (
          selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) ||
          'Day'
        );
      case 'week':
        return 'Weekly Overview';
      case 'volume':
        return 'Volume';
      case 'time':
        return 'Time';
      default:
        return 'Overview';
    }
  })();

  const headerSubtitle = invocationType === 'week' ? weekRange : undefined;

  const Stat = ({ value, label, color }: { value: string | number; label: string; color?: string }) => (
    <View style={styles.stat}>
      <Text
        tone="primary"
        weight="bold"
        style={[styles.statValue, color ? { color } : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text tone="faint" style={styles.statLabel}>{label}</Text>
    </View>
  );

  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <View style={[styles.barTrack, { backgroundColor: c.border }]}>
      <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, pct))}%`, backgroundColor: color }]} />
    </View>
  );

  const Empty = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <View style={styles.empty}>
      <Ionicons name="barbell-outline" size={34} color={ink.muted} />
      <Text tone="secondary" weight="semiBold" style={styles.emptyText}>{title}</Text>
      <Text tone="muted" style={styles.emptySub}>{subtitle}</Text>
    </View>
  );

  const cardStyle = [styles.card, { backgroundColor: c.surface, borderColor: c.border }];

  const renderCategoryBars = (metric: 'count' | 'volume' | 'time') => {
    const entries = Object.entries(a.categoryBreakdown);
    if (!entries.length) return null;
    const max = Math.max(...entries.map(([, d]) => d[metric])) || 1;
    const fmt = (v: number) =>
      metric === 'count' ? `${v}` : metric === 'volume' ? fmtVol(v) : formatTime(v);
    return (
      <View style={cardStyle}>
        {entries
          .sort((x, y) => y[1][metric] - x[1][metric])
          .map(([cat, d]) => (
            <View key={cat} style={styles.barRow}>
              <View style={[styles.legendDot, { backgroundColor: categoryColor(cat) }]} />
              <Text tone="primary" style={styles.barLabel}>{cap(cat)}</Text>
              <Bar pct={(d[metric] / max) * 100} color={categoryColor(cat)} />
              <Text tone="primary" weight="semiBold" style={styles.barValue}>{fmt(d[metric])}</Text>
            </View>
          ))}
      </View>
    );
  };

  const renderExerciseList = (limit: number) => {
    const list = a.topExercises.slice(0, limit);
    if (!list.length) return null;
    const max = list[0].totalVolume || 1;
    return (
      <View style={cardStyle}>
        {list.map((ex, i) => (
          <View key={ex.name} style={styles.exRow}>
            <Text tone="faint" weight="bold" style={styles.exRank}>{i + 1}</Text>
            <View style={styles.exMain}>
              <Text tone="primary" weight="medium" style={styles.exName} numberOfLines={1}>
                {cleanName(ex.name)}
              </Text>
              <Bar pct={(ex.totalVolume / max) * 100} color={exerciseColor(ex.name)} />
            </View>
            <View style={styles.exMeta}>
              <Text tone="primary" weight="semiBold" style={styles.exVal}>{fmtVol(ex.totalVolume)}</Text>
              <Text tone="muted" style={styles.exSub}>
                {ex.totalSets} sets · {ex.sessions}×
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderPPLSplit = () => {
    const entries = (['push', 'pull', 'legs'] as PPLCategory[])
      .map(k => ({ k, ...a.pplBreakdown[k] }))
      .filter(e => e.sets > 0)
      .sort((x, y) => y.sets - x.sets);
    if (!entries.length) return null;
    const max = entries[0].sets || 1;
    return (
      <View style={cardStyle}>
        {entries.map(e => (
          <View key={e.k} style={styles.barRow}>
            <View style={[styles.legendDot, { backgroundColor: PPL_COLORS[e.k] }]} />
            <Text tone="primary" style={styles.barLabel}>{PPL_LABELS[e.k]}</Text>
            <Bar pct={(e.sets / max) * 100} color={PPL_COLORS[e.k]} />
            <Text tone="primary" weight="semiBold" style={styles.barValue}>{e.sets} sets</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderPRs = () => {
    if (!weeklyPRs.length) return null;
    return (
      <View style={cardStyle}>
        {weeklyPRs.map((pr, i) => (
          <View
            key={pr.exerciseId}
            style={[
              styles.prRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
            ]}
          >
            <View style={[styles.prAccent, { backgroundColor: pr.ppl ? PPL_COLORS[pr.ppl] : c.accent }]} />
            <View style={styles.prMain}>
              <Text tone="primary" weight="semiBold" style={styles.prName} numberOfLines={1}>
                {pr.name}
              </Text>
              <Text tone="faint" style={styles.prContext}>
                {pr.weight} lbs × {pr.reps}
              </Text>
            </View>
            <View style={styles.prMeta}>
              <Text tone="primary" weight="semiBold" style={styles.prVal}>{pr.e1rm} lbs</Text>
              <Text tone="faint" style={styles.prContext}>est. 1RM · +{pr.improvement}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderCardioStrip = () => {
    if (!a.hasCardio || (a.totalDistanceMeters <= 0 && a.totalCardioDurationSeconds <= 0)) return null;
    return (
      <View style={[styles.secondaryRow, { borderTopColor: c.border }]}>
        {a.totalDistanceMeters > 0 && (
          <Text tone="secondary" style={styles.secondaryText}>
            {formatDistance(a.totalDistanceMeters)} distance
          </Text>
        )}
        {a.totalCardioDurationSeconds > 0 && (
          <Text tone="secondary" style={styles.secondaryText}>
            {formatDuration(a.totalCardioDurationSeconds)} cardio
          </Text>
        )}
      </View>
    );
  };

  const renderGoalCard = () => {
    const pct = goal ? (a.daysTrained / goal) * 100 : 0;
    const met = a.daysTrained >= goal && goal > 0;
    const accent = met ? '#F59E0B' : c.primary;
    return (
      <View style={[cardStyle, { marginTop: 4 }]}>
        <View style={styles.goalHeader}>
          <Text tone="primary" weight="bold" style={styles.goalTitle}>Weekly Goal</Text>
          <View style={styles.goalCount}>
            {met && <Ionicons name="checkmark-circle" size={16} color={accent} />}
            <Text weight="semiBold" style={[styles.goalCountText, { color: accent }]}>
              {a.daysTrained}/{goal} days
            </Text>
          </View>
        </View>
        <Bar pct={pct} color={accent} />
        <Text tone="muted" style={styles.goalPrompt}>Days you want to train each week</Text>
        <View style={styles.pillRow}>
          {GOAL_OPTIONS.map(v => {
            const selected = v === goal;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => changeGoal(v)}
                activeOpacity={0.8}
                style={[
                  styles.pill,
                  selected
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: 'transparent', borderColor: c.border },
                ]}
              >
                <Text
                  weight="semiBold"
                  tone={selected ? undefined : 'primary'}
                  style={[styles.pillText, selected && { color: c.surface }]}
                >
                  {v}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderWeek = () => {
    if (workouts.length === 0) {
      return (
        <View style={styles.content}>
          <Empty title="No workouts this week" subtitle="Complete a workout and it’ll show up here" />
          <SectionLabel style={styles.sectionLabel}>Weekly Goal</SectionLabel>
          {renderGoalCard()}
        </View>
      );
    }
    return (
      <View style={styles.content}>
        <AuroraSurface style={styles.auroraSummary} contentStyle={styles.auroraSummaryContent}>
          <View style={styles.statStrip}>
            <Stat value={workouts.length} label="Workouts" />
            <Stat value={a.daysTrained} label="Days" />
            <Stat value={formatHoursCompact(a.totalTime)} label="Time" />
            <Stat value={fmtVol(a.totalVolume)} label="Volume" />
          </View>
          {renderCardioStrip()}
        </AuroraSurface>

        {weeklyPRs.length > 0 && (
          <>
            <SectionLabel style={styles.sectionLabel}>Personal Records</SectionLabel>
            {renderPRs()}
          </>
        )}

        <SectionLabel style={styles.sectionLabel}>Workouts</SectionLabel>
        {a.workoutSummaries.map(w => (
          <View key={w.id} style={[styles.workoutRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.dayCol, { borderRightColor: c.border }]}>
              <Text tone="muted" style={styles.weekday}>{w.weekday}</Text>
              <Text weight="bold" style={[styles.dayNum, { color: c.accent }]}>{w.dayNum}</Text>
            </View>
            <View style={styles.workoutInfo}>
              <View style={styles.workoutTitleRow}>
                <View style={[styles.legendDot, { backgroundColor: categoryColor(w.category) }]} />
                <Text tone="primary" weight="semiBold" style={styles.workoutTitle} numberOfLines={1}>
                  {w.title}
                </Text>
              </View>
              <Text tone="secondary" style={styles.workoutMeta}>
                {formatTime(w.duration)} · {w.exercises} ex · {w.sets} sets
                {w.volume > 0 ? ` · ${fmtVol(w.volume)}` : ''}
              </Text>
            </View>
          </View>
        ))}

        {(a.pplBreakdown.push.sets + a.pplBreakdown.pull.sets + a.pplBreakdown.legs.sets) > 0 && (
          <>
            <SectionLabel style={styles.sectionLabel}>Training Split</SectionLabel>
            {renderPPLSplit()}
          </>
        )}

        {a.topExercises.length > 0 && (
          <>
            <SectionLabel style={styles.sectionLabel}>Top Exercises</SectionLabel>
            {renderExerciseList(5)}
          </>
        )}

        <SectionLabel style={styles.sectionLabel}>Weekly Goal</SectionLabel>
        {renderGoalCard()}
      </View>
    );
  };

  const renderDay = () => {
    if (workouts.length === 0) {
      return (
        <View style={styles.content}>
          <Empty title="No workouts on this day" subtitle="Consider planning a workout for this day" />
        </View>
      );
    }
    return (
      <View style={styles.content}>
        <View style={cardStyle}>
          <View style={styles.statStrip}>
            <Stat value={workouts.length} label="Workouts" />
            <Stat value={formatTime(a.totalTime)} label="Time" />
            <Stat value={a.totalSets} label="Sets" />
            <Stat value={fmtVol(a.totalVolume)} label="Volume" />
          </View>
          {renderCardioStrip()}
        </View>

        <SectionLabel style={styles.sectionLabel}>Sessions</SectionLabel>
        {workouts.map((workout, index) => (
          <View key={index} style={[cardStyle]}>
            <View style={styles.workoutTitleRow}>
              <View style={[styles.legendDot, { backgroundColor: categoryColor(getWorkoutCategory(workout)) }]} />
              <Text tone="primary" weight="semiBold" style={styles.workoutTitle}>{workout.title}</Text>
            </View>
            <Text tone="secondary" style={[styles.workoutMeta, { marginBottom: 8 }]}>
              {formatTime(workout.estimatedDuration)} · {workout.exercises.length} exercises ·{' '}
              {workout.exercises.reduce((s, ex) => s + ex.completedSets.length, 0)} sets
            </Text>
            {workout.exercises.slice(0, 4).map((exercise, exIndex) => {
              const vol = exercise.completedSets.reduce((s, set) => s + set.weight * set.reps, 0);
              return (
                <View key={exIndex} style={styles.exerciseLine}>
                  <Text tone="primary" style={styles.exerciseLineName} numberOfLines={1}>
                    {cleanName(exercise.id)}
                  </Text>
                  <Text tone="secondary" style={styles.exerciseLineVal}>
                    {exercise.completedSets.length} sets{vol > 0 ? ` · ${fmtVol(vol)}` : ''}
                  </Text>
                </View>
              );
            })}
            {workout.exercises.length > 4 && (
              <Text tone="muted" style={styles.moreText}>
                +{workout.exercises.length - 4} more
              </Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderVolume = () => {
    if (workouts.length === 0) {
      return (
        <View style={styles.content}>
          <Empty title="No volume this week" subtitle="Log some sets to see volume analytics" />
        </View>
      );
    }
    return (
      <View style={styles.content}>
        <View style={cardStyle}>
          <View style={styles.statStrip}>
            <Stat value={fmtVol(a.totalVolume)} label="Volume" />
            <Stat value={fmtVol(a.avgVolumePerWorkout)} label="Avg / Workout" />
            <Stat value={a.totalSets} label="Sets" />
            <Stat value={a.totalReps} label="Reps" />
          </View>
        </View>

        {Object.keys(a.categoryBreakdown).length > 0 && (
          <>
            <SectionLabel style={styles.sectionLabel}>Volume by Type</SectionLabel>
            {renderCategoryBars('volume')}
          </>
        )}

        {a.topExercises.length > 0 && (
          <>
            <SectionLabel style={styles.sectionLabel}>Highest Volume</SectionLabel>
            {renderExerciseList(8)}
          </>
        )}
      </View>
    );
  };

  const renderTime = () => {
    if (workouts.length === 0) {
      return (
        <View style={styles.content}>
          <Empty title="No training time this week" subtitle="Finish a workout to see time analytics" />
        </View>
      );
    }
    const dailyEntries = Object.entries(a.dailyBreakdown);
    return (
      <View style={styles.content}>
        <View style={cardStyle}>
          <View style={styles.statStrip}>
            <Stat value={formatTime(a.totalTime)} label="Total" />
            <Stat value={formatTime(Math.round(a.avgWorkoutDuration))} label="Avg" />
            <Stat
              value={a.totalTime > 0 ? `${Math.round((a.totalVolume / a.totalTime) * 10) / 10}` : '0'}
              label="Vol / Min"
            />
          </View>
        </View>

        {Object.keys(a.categoryBreakdown).length > 0 && (
          <>
            <SectionLabel style={styles.sectionLabel}>Time by Type</SectionLabel>
            {renderCategoryBars('time')}
          </>
        )}

        {dailyEntries.length > 0 && (
          <>
            <SectionLabel style={styles.sectionLabel}>Daily Breakdown</SectionLabel>
            <View style={cardStyle}>
              {dailyEntries.map(([day, d]) => (
                <View key={day} style={styles.dailyRow}>
                  <Text tone="primary" style={styles.dailyDay}>{day}</Text>
                  <Text tone="secondary" style={styles.dailyVal}>
                    {formatTime(d.time)} · {d.workouts} session{d.workouts !== 1 ? 's' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderContent = () => {
    switch (invocationType) {
      case 'day':
        return renderDay();
      case 'week':
        return renderWeek();
      case 'volume':
        return renderVolume();
      case 'time':
        return renderTime();
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.header, { borderBottomColor: c.border, paddingTop: insets.top + 14 }]}>
          <View style={styles.headerTitleWrap}>
            <Text variant="title" tone="primary" weight="semiBold" numberOfLines={1}>
              {headerTitle}
            </Text>
            {headerSubtitle && (
              <Text tone="muted" style={styles.headerSubtitle}>{headerSubtitle}</Text>
            )}
          </View>
          {/* The app's one modal-close grammar: an ✕ IconButton top-right. */}
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        >
          {renderContent()}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: { flex: 1, marginRight: 12 },
  headerSubtitle: { fontSize: typeScale.meta, marginTop: 2 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  content: { paddingHorizontal: 16, paddingTop: 14 },

  card: {
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 8,
  },
  auroraSummary: { marginBottom: 8 },
  auroraSummaryContent: { padding: 16 },

  statStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statValue: { fontSize: typeScale.statHero, letterSpacing: -0.3 },
  statLabel: {
    fontSize: typeScale.meta,
    marginTop: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryText: { fontSize: typeScale.meta },

  sectionLabel: {
    marginTop: 22,
    marginLeft: 2,
  },

  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 8,
  },
  dayCol: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  weekday: { fontSize: typeScale.meta, textTransform: 'uppercase' },
  dayNum: { fontSize: typeScale.emphasis },
  workoutInfo: { flex: 1 },
  workoutTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5, marginRight: 7 },
  workoutTitle: { fontSize: typeScale.body, flex: 1 },
  workoutMeta: { fontSize: typeScale.meta },

  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  barLabel: { width: 58, fontSize: typeScale.meta },
  barTrack: { flex: 1, height: 8, borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { width: 78, textAlign: 'right', fontSize: typeScale.meta },

  exRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  exRank: { width: 21, fontSize: typeScale.meta },
  exMain: { flex: 1, marginRight: 10 },
  exName: { fontSize: typeScale.body, marginBottom: 5 },
  exMeta: { alignItems: 'flex-end' },
  exVal: { fontSize: typeScale.meta },
  exSub: { fontSize: typeScale.meta, marginTop: 1 },

  exerciseLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseLineName: { fontSize: typeScale.body, flex: 1, marginRight: 10 },
  exerciseLineVal: { fontSize: typeScale.meta },
  moreText: { fontSize: typeScale.meta, marginTop: 4 },

  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dailyDay: { fontSize: typeScale.body },
  dailyVal: { fontSize: typeScale.meta },

  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalTitle: { fontSize: typeScale.body },
  goalCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goalCountText: { fontSize: typeScale.meta },
  goalPrompt: { fontSize: typeScale.meta, marginTop: 12, marginBottom: 10 },
  pillRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: typeScale.body },

  prRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  prAccent: { width: 3, height: 30, borderRadius: 1.5, marginRight: 13 },
  prMain: { flex: 1, marginRight: 10 },
  prName: { fontSize: typeScale.body },
  prContext: { fontSize: typeScale.meta, marginTop: 2 },
  prMeta: { alignItems: 'flex-end' },
  prVal: { fontSize: typeScale.emphasis },

  empty: { alignItems: 'center', paddingVertical: 44 },
  emptyText: { fontSize: typeScale.body, marginTop: 12 },
  emptySub: { fontSize: typeScale.meta, marginTop: 6, textAlign: 'center' },
});
