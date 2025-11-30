import { storageService } from './storage';
import { userService } from './userService';
import { CustomExercise, GeneratedWorkout, MuscleGroup, UserLift, WeightUnit, convertWeight } from '@/types';
import { getWorkoutByIdWithCustom } from './workouts';

// ===== TYPES =====

export type RecapPeriod = 'week' | 'month' | 'year';

export interface StreakInfo {
  days: number;
  startDate: Date;
  endDate: Date;
}

export interface TopExercise {
  id: string;
  name: string;
  count: number;
  bestWeight: number;
  unit: WeightUnit;
}

export interface TopPR {
  exercise: string;
  exerciseId: string;
  improvement: number;
  newMax: number;
  unit: WeightUnit;
}

export interface StrengthProgress {
  exercise: string;
  exerciseId: string;
  startMax: number;
  endMax: number;
  improvement: number;
  unit: WeightUnit;
}

export interface MuscleDistribution {
  group: MuscleGroup;
  percentage: number;
  count: number;
}

export interface BestDay {
  date: Date;
  dayName: string;
  workouts: number;
  volume: number;
}

export interface RecapStats {
  period: RecapPeriod;
  periodLabel: string;
  periodSubtitle: string;
  startDate: Date;
  endDate: Date;
  totalWorkouts: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  longestStreak: StreakInfo;
  currentStreak: number;
  topExercises: TopExercise[];
  prsAchieved: number;
  topPR: TopPR | null;
  strengthProgress: StrengthProgress[];
  muscleGroupDistribution: MuscleDistribution[];
  bestDay: BestDay | null;
  averageWorkoutsPerPeriod: number;
  daysActive: number;
  totalDaysInPeriod: number;
  unit: WeightUnit;
}

// ===== HELPER FUNCTIONS =====

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function getMonthName(monthIndex: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months[monthIndex] || '';
}

function getWeekRange(date: Date): { start: Date; end: Date; label: string; subtitle: string } {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  let label = 'This Week';
  if (start.getTime() < thisWeekStart.getTime()) {
    const weeksAgo = Math.floor((thisWeekStart.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksAgo === 1) label = 'Last Week';
    else label = `${weeksAgo} Weeks Ago`;
  }

  const subtitle = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return { start, end, label, subtitle };
}

function getMonthRange(date: Date): { start: Date; end: Date; label: string; subtitle: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  const now = new Date();
  let label = getMonthName(date.getMonth());
  if (date.getFullYear() !== now.getFullYear()) {
    label = `${getMonthName(date.getMonth())} ${date.getFullYear()}`;
  } else if (date.getMonth() === now.getMonth()) {
    label = 'This Month';
  }

  const subtitle = `${date.getFullYear()}`;

  return { start, end, label, subtitle };
}

function getYearRange(year: number): { start: Date; end: Date; label: string; subtitle: string } {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);

  const now = new Date();
  const label = year === now.getFullYear() ? 'This Year' : `${year}`;
  const subtitle = 'Year in Review';

  return { start, end, label, subtitle };
}

// ===== MAIN CALCULATION FUNCTION =====

export async function calculateRecapStats(
  period: RecapPeriod,
  referenceDate: Date = new Date()
): Promise<RecapStats> {
  const userProfile = await userService.getUserProfileOrDefault();
  const preferredUnit = userProfile.weightUnitPreference || 'lbs';
  const allWorkouts = await storageService.getWorkoutHistory();
  const customExercises = await storageService.getCustomExercises();

  // Get period range
  let periodRange: { start: Date; end: Date; label: string; subtitle: string };

  switch (period) {
    case 'week':
      periodRange = getWeekRange(referenceDate);
      break;
    case 'month':
      periodRange = getMonthRange(referenceDate);
      break;
    case 'year':
      periodRange = getYearRange(referenceDate.getFullYear());
      break;
  }

  // Filter workouts for the period
  const periodWorkouts = allWorkouts.filter(w => {
    const workoutDate = new Date(w.createdAt);
    return workoutDate >= periodRange.start && workoutDate <= periodRange.end;
  });

  // Get lifts for the period
  const allLifts = [...userProfile.lifts, ...userProfile.secondaryLifts].filter(lift => {
    const liftDate = new Date(lift.dateRecorded);
    return liftDate >= periodRange.start && liftDate <= periodRange.end;
  });

  // Calculate basic stats
  const totalWorkouts = periodWorkouts.length;
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;

  const exerciseCounts: Record<string, { count: number; bestWeight: number; unit: WeightUnit }> = {};
  const muscleGroupCounts: Record<string, number> = {};
  const dailyStats: Record<string, { workouts: number; volume: number; date: Date }> = {};

  for (const workout of periodWorkouts) {
    const dateKey = getDateKey(new Date(workout.createdAt));

    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = { workouts: 0, volume: 0, date: new Date(workout.createdAt) };
    }
    dailyStats[dateKey].workouts++;

    for (const exercise of workout.exercises) {
      if (!exerciseCounts[exercise.id]) {
        exerciseCounts[exercise.id] = { count: 0, bestWeight: 0, unit: preferredUnit };
      }
      exerciseCounts[exercise.id].count++;

      const exerciseInfo = getWorkoutByIdWithCustom(exercise.id, customExercises);
      if (exerciseInfo) {
        for (const muscle of exerciseInfo.primaryMuscles) {
          muscleGroupCounts[muscle] = (muscleGroupCounts[muscle] || 0) + 1;
        }
      }

      for (const set of exercise.completedSets) {
        if (set.completed) {
          totalSets++;
          totalReps += set.reps;

          const weightInPreferred = set.unit === preferredUnit
            ? set.weight
            : convertWeight(set.weight, set.unit, preferredUnit);

          const setVolume = weightInPreferred * set.reps;
          totalVolume += setVolume;
          dailyStats[dateKey].volume += setVolume;

          if (weightInPreferred > exerciseCounts[exercise.id].bestWeight) {
            exerciseCounts[exercise.id].bestWeight = weightInPreferred;
          }
        }
      }
    }
  }

  // Calculate streaks
  const longestStreak = calculateLongestStreak(periodWorkouts);
  const currentStreak = calculateCurrentStreak(allWorkouts);

  // Top exercises
  const topExercises: TopExercise[] = Object.entries(exerciseCounts)
    .map(([id, data]) => {
      const exerciseInfo = getWorkoutByIdWithCustom(id, customExercises);
      return {
        id,
        name: exerciseInfo?.name || id,
        count: data.count,
        bestWeight: Math.round(data.bestWeight),
        unit: preferredUnit,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Muscle distribution
  const totalMuscleHits = Object.values(muscleGroupCounts).reduce((a, b) => a + b, 0);
  const muscleGroupDistribution: MuscleDistribution[] = Object.entries(muscleGroupCounts)
    .map(([group, count]) => ({
      group: group as MuscleGroup,
      percentage: totalMuscleHits > 0 ? Math.round((count / totalMuscleHits) * 100) : 0,
      count,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // PRs
  const { prsAchieved, topPR } = calculatePRStats(allLifts, preferredUnit, customExercises);

  // Strength progress
  const strengthProgress = calculateStrengthProgressForPeriod(allLifts, preferredUnit, customExercises);

  // Best day
  let bestDay: BestDay | null = null;
  let maxVolume = 0;
  for (const [, stats] of Object.entries(dailyStats)) {
    if (stats.volume > maxVolume) {
      maxVolume = stats.volume;
      bestDay = {
        date: stats.date,
        dayName: getDayName(stats.date),
        workouts: stats.workouts,
        volume: Math.round(stats.volume),
      };
    }
  }

  // Calculate period-specific averages
  const totalDaysInPeriod = Math.ceil((periodRange.end.getTime() - periodRange.start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const daysActive = Object.keys(dailyStats).length;

  let averageWorkoutsPerPeriod: number;
  switch (period) {
    case 'week':
      averageWorkoutsPerPeriod = Math.round((totalWorkouts / 7) * 10) / 10;
      break;
    case 'month':
      averageWorkoutsPerPeriod = Math.round((totalWorkouts / 4) * 10) / 10; // Per week
      break;
    case 'year':
      averageWorkoutsPerPeriod = Math.round((totalWorkouts / 52) * 10) / 10; // Per week
      break;
  }

  return {
    period,
    periodLabel: periodRange.label,
    periodSubtitle: periodRange.subtitle,
    startDate: periodRange.start,
    endDate: periodRange.end,
    totalWorkouts,
    totalVolume: Math.round(totalVolume),
    totalSets,
    totalReps,
    longestStreak,
    currentStreak,
    topExercises,
    prsAchieved,
    topPR,
    strengthProgress,
    muscleGroupDistribution,
    bestDay,
    averageWorkoutsPerPeriod,
    daysActive,
    totalDaysInPeriod,
    unit: preferredUnit,
  };
}

// ===== STREAK CALCULATIONS =====

function calculateLongestStreak(workouts: GeneratedWorkout[]): StreakInfo {
  if (workouts.length === 0) {
    return { days: 0, startDate: new Date(), endDate: new Date() };
  }

  const uniqueDates = [...new Set(workouts.map(w => getDateKey(new Date(w.createdAt))))];
  uniqueDates.sort();

  if (uniqueDates.length === 0) {
    return { days: 0, startDate: new Date(), endDate: new Date() };
  }

  let longestStreak = 1;
  let currentStreak = 1;
  let longestStart = uniqueDates[0];
  let longestEnd = uniqueDates[0];
  let currentStart = uniqueDates[0];

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
        longestStart = currentStart;
        longestEnd = uniqueDates[i];
      }
    } else {
      currentStreak = 1;
      currentStart = uniqueDates[i];
    }
  }

  return {
    days: longestStreak,
    startDate: new Date(longestStart),
    endDate: new Date(longestEnd),
  };
}

function calculateCurrentStreak(workouts: GeneratedWorkout[]): number {
  if (workouts.length === 0) return 0;

  const uniqueDates = [...new Set(workouts.map(w => getDateKey(new Date(w.createdAt))))];
  uniqueDates.sort((a, b) => b.localeCompare(a)); // Sort descending

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getDateKey(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDateKey(yesterday);

  // Must have worked out today or yesterday to have a current streak
  if (uniqueDates[0] !== todayKey && uniqueDates[0] !== yesterdayKey) {
    return 0;
  }

  let streak = 0;
  let checkDate = uniqueDates[0] === todayKey ? today : yesterday;

  for (const dateKey of uniqueDates) {
    const checkKey = getDateKey(checkDate);
    if (dateKey === checkKey) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (dateKey < checkKey) {
      break;
    }
  }

  return streak;
}

// ===== PR CALCULATION =====

function calculatePRStats(lifts: UserLift[], preferredUnit: WeightUnit, customExercises: CustomExercise[]): { prsAchieved: number; topPR: TopPR | null } {
  if (lifts.length === 0) {
    return { prsAchieved: 0, topPR: null };
  }

  const liftsByExercise: Record<string, UserLift[]> = {};
  for (const lift of lifts) {
    if (!liftsByExercise[lift.id]) {
      liftsByExercise[lift.id] = [];
    }
    liftsByExercise[lift.id].push(lift);
  }

  let prsAchieved = 0;
  let topPR: TopPR | null = null;
  let maxImprovement = 0;

  for (const [exerciseId, exerciseLifts] of Object.entries(liftsByExercise)) {
    exerciseLifts.sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime());

    let currentMax = 0;
    for (const lift of exerciseLifts) {
      const weightInPreferred = lift.unit === preferredUnit
        ? lift.weight
        : convertWeight(lift.weight, lift.unit, preferredUnit);

      if (weightInPreferred > currentMax) {
        if (currentMax > 0) {
          prsAchieved++;
          const improvement = weightInPreferred - currentMax;

          if (improvement > maxImprovement) {
            maxImprovement = improvement;
            const exerciseInfo = getWorkoutByIdWithCustom(exerciseId, customExercises);
            topPR = {
              exercise: exerciseInfo?.name || exerciseId,
              exerciseId,
              improvement: Math.round(improvement),
              newMax: Math.round(weightInPreferred),
              unit: preferredUnit,
            };
          }
        }
        currentMax = weightInPreferred;
      }
    }
  }

  return { prsAchieved, topPR };
}

// ===== STRENGTH PROGRESS =====

function calculateStrengthProgressForPeriod(lifts: UserLift[], preferredUnit: WeightUnit, customExercises: CustomExercise[]): StrengthProgress[] {
  const liftsByExercise: Record<string, UserLift[]> = {};
  for (const lift of lifts) {
    if (!liftsByExercise[lift.id]) {
      liftsByExercise[lift.id] = [];
    }
    liftsByExercise[lift.id].push(lift);
  }

  const progress: StrengthProgress[] = [];

  for (const [exerciseId, exerciseLifts] of Object.entries(liftsByExercise)) {
    if (exerciseLifts.length < 2) continue;

    exerciseLifts.sort((a, b) => new Date(a.dateRecorded).getTime() - new Date(b.dateRecorded).getTime());

    const firstLift = exerciseLifts[0];
    const lastLift = exerciseLifts[exerciseLifts.length - 1];

    const startMax = firstLift.unit === preferredUnit
      ? firstLift.weight
      : convertWeight(firstLift.weight, firstLift.unit, preferredUnit);

    const endMax = lastLift.unit === preferredUnit
      ? lastLift.weight
      : convertWeight(lastLift.weight, lastLift.unit, preferredUnit);

    const improvement = endMax - startMax;

    if (improvement !== 0) {
      const exerciseInfo = getWorkoutByIdWithCustom(exerciseId, customExercises);
      progress.push({
        exercise: exerciseInfo?.name || exerciseId,
        exerciseId,
        startMax: Math.round(startMax),
        endMax: Math.round(endMax),
        improvement: Math.round(improvement),
        unit: preferredUnit,
      });
    }
  }

  return progress.sort((a, b) => Math.abs(b.improvement) - Math.abs(a.improvement)).slice(0, 4);
}

// ===== NAVIGATION HELPERS =====

export function getPreviousPeriod(period: RecapPeriod, currentDate: Date): Date {
  const newDate = new Date(currentDate);
  switch (period) {
    case 'week':
      newDate.setDate(newDate.getDate() - 7);
      break;
    case 'month':
      newDate.setMonth(newDate.getMonth() - 1);
      break;
    case 'year':
      newDate.setFullYear(newDate.getFullYear() - 1);
      break;
  }
  return newDate;
}

export function getNextPeriod(period: RecapPeriod, currentDate: Date): Date {
  const newDate = new Date(currentDate);
  switch (period) {
    case 'week':
      newDate.setDate(newDate.getDate() + 7);
      break;
    case 'month':
      newDate.setMonth(newDate.getMonth() + 1);
      break;
    case 'year':
      newDate.setFullYear(newDate.getFullYear() + 1);
      break;
  }
  return newDate;
}

export function canGoNext(period: RecapPeriod, currentDate: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  switch (period) {
    case 'week':
      // Get current week start (Sunday)
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      // Get the week start of the currentDate being viewed
      const viewingWeekStart = new Date(currentDate);
      viewingWeekStart.setDate(currentDate.getDate() - currentDate.getDay());
      viewingWeekStart.setHours(0, 0, 0, 0);

      // Can go next if we're viewing a week before this week
      return viewingWeekStart.getTime() < thisWeekStart.getTime();

    case 'month':
      // Can go next if we're viewing a month before the current month
      const currentMonth = now.getFullYear() * 12 + now.getMonth();
      const viewingMonth = currentDate.getFullYear() * 12 + currentDate.getMonth();
      return viewingMonth < currentMonth;

    case 'year':
      return currentDate.getFullYear() < now.getFullYear();
  }
}

// Keep backward compatibility
export async function calculateYearlyStats(year: number): Promise<RecapStats> {
  return calculateRecapStats('year', new Date(year, 0, 1));
}

export async function getAvailableYears(): Promise<number[]> {
  const allWorkouts = await storageService.getWorkoutHistory();
  const years = new Set<number>();

  for (const workout of allWorkouts) {
    years.add(new Date(workout.createdAt).getFullYear());
  }

  years.add(new Date().getFullYear());

  return Array.from(years).sort((a, b) => b - a);
}
