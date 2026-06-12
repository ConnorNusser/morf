// Derived "behavioral" signals for the niche / Strava-style achievements:
// time-of-day, holidays, weekend pairs, comebacks, variety, rep feats, seasons.
// Everything is computed purely from raw workout history (timestamps already
// carry the time-of-day), so no new tracking is required — same philosophy as
// careerStats. Clock-injectable for tests.
import { MUSCLE_TO_PPL, PPLCategory } from '@/lib/data/pplCategories';
import { getWorkoutById } from '@/lib/workout/workouts';
import { GeneratedWorkout } from '@/types';

export interface BehavioralSignals {
  trainedBefore6am: boolean; // any session started before 06:00
  trainedAfter10pm: boolean; // any session started at/after 22:00
  trainedMidnightTo4: boolean; // any session 00:00–03:59 (the "vampire" window)
  maxWorkoutsInDay: number; // most sessions logged in one calendar day
  hasWeekendPair: boolean; // trained both Sat and Sun within one week
  longestComebackGap: number; // largest day-gap the lifter returned from
  distinctExercises: number; // distinct exercises ever logged
  hasFullPPLWeek: boolean; // push+pull+legs all hit within a 7-day window
  maxRepsSingleSet: number; // most reps in one completed set
  maxRepsOneExerciseSession: number; // most reps of one exercise in one session
  hasAllFourSeasons: boolean; // trained in all 4 seasons of one calendar year
  pushSets: number; // completed sets whose primary muscle is a "push"
  pullSets: number; // completed sets whose primary muscle is a "pull"
  trainedNewYearsDay: boolean; // Jan 1
  trainedThanksgiving: boolean; // US Thanksgiving (4th Thursday of November)
  trainedChristmas: boolean; // Dec 25
  trainedLeapDay: boolean; // Feb 29
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Monday-start week key, so "weekend pair" groups Sat+Sun of the same week.
function weekKey(d: Date): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return dateKey(s);
}

// Meteorological season by month (0=winter … via Dec/Jan/Feb).
function seasonOf(month: number): 'winter' | 'spring' | 'summer' | 'fall' {
  if (month <= 1 || month === 11) return 'winter'; // Dec, Jan, Feb
  if (month <= 4) return 'spring'; // Mar–May
  if (month <= 7) return 'summer'; // Jun–Aug
  return 'fall'; // Sep–Nov
}

function isThanksgiving(d: Date): boolean {
  // US Thanksgiving: the 4th Thursday of November → a Thursday dated 22–28.
  return d.getMonth() === 10 && d.getDay() === 4 && d.getDate() >= 22 && d.getDate() <= 28;
}

export function computeBehavioralSignals(workouts: GeneratedWorkout[]): BehavioralSignals {
  const empty: BehavioralSignals = {
    trainedBefore6am: false,
    trainedAfter10pm: false,
    trainedMidnightTo4: false,
    maxWorkoutsInDay: 0,
    hasWeekendPair: false,
    longestComebackGap: 0,
    distinctExercises: 0,
    hasFullPPLWeek: false,
    maxRepsSingleSet: 0,
    maxRepsOneExerciseSession: 0,
    hasAllFourSeasons: false,
    pushSets: 0,
    pullSets: 0,
    trainedNewYearsDay: false,
    trainedThanksgiving: false,
    trainedChristmas: false,
    trainedLeapDay: false,
  };
  if (workouts.length === 0) return empty;

  let trainedBefore6am = false;
  let trainedAfter10pm = false;
  let trainedMidnightTo4 = false;
  let maxRepsSingleSet = 0;
  let maxRepsOneExerciseSession = 0;
  let pushSets = 0;
  let pullSets = 0;
  let trainedNewYearsDay = false;
  let trainedThanksgiving = false;
  let trainedChristmas = false;
  let trainedLeapDay = false;

  const perDayCount = new Map<string, number>(); // dayKey → sessions that day
  const week = new Map<string, { sat: boolean; sun: boolean }>(); // weekend pairs
  const distinct = new Set<string>(); // distinct exercise ids
  const yearSeasons = new Map<number, Set<string>>(); // year → seasons trained
  const dayPPL = new Map<string, Set<PPLCategory>>(); // dayKey → categories

  for (const workout of workouts) {
    const created = new Date(workout.createdAt);
    const hour = created.getHours();
    const key = dateKey(created);

    if (hour < 6) trainedBefore6am = true;
    if (hour >= 22) trainedAfter10pm = true;
    if (hour < 4) trainedMidnightTo4 = true;

    perDayCount.set(key, (perDayCount.get(key) ?? 0) + 1);

    const day = created.getDay();
    if (day === 0 || day === 6) {
      const wk = week.get(weekKey(created)) ?? { sat: false, sun: false };
      if (day === 6) wk.sat = true;
      else wk.sun = true;
      week.set(weekKey(created), wk);
    }

    const seasons = yearSeasons.get(created.getFullYear()) ?? new Set<string>();
    seasons.add(seasonOf(created.getMonth()));
    yearSeasons.set(created.getFullYear(), seasons);

    const month = created.getMonth();
    const date = created.getDate();
    if (month === 0 && date === 1) trainedNewYearsDay = true;
    if (month === 11 && date === 25) trainedChristmas = true;
    if (month === 1 && date === 29) trainedLeapDay = true;
    if (isThanksgiving(created)) trainedThanksgiving = true;

    const dayCats = dayPPL.get(key) ?? new Set<PPLCategory>();
    for (const exercise of workout.exercises || []) {
      distinct.add(exercise.id);
      const muscle = getWorkoutById(exercise.id)?.primaryMuscles?.[0];
      const cat = muscle ? MUSCLE_TO_PPL[muscle] : undefined;
      if (cat) dayCats.add(cat);

      let exerciseSessionReps = 0;
      let exerciseCompletedSets = 0;
      for (const set of exercise.completedSets || []) {
        if (!set.completed) continue;
        exerciseSessionReps += set.reps;
        exerciseCompletedSets += 1;
        if (set.reps > maxRepsSingleSet) maxRepsSingleSet = set.reps;
      }
      if (cat === 'push') pushSets += exerciseCompletedSets;
      else if (cat === 'pull') pullSets += exerciseCompletedSets;
      if (exerciseSessionReps > maxRepsOneExerciseSession) {
        maxRepsOneExerciseSession = exerciseSessionReps;
      }
    }
    if (dayCats.size) dayPPL.set(key, dayCats);
  }

  // Largest gap the lifter came back from: max gap between consecutive trained
  // days (a later day existing means they returned from it).
  const sortedDays = [...perDayCount.keys()]
    .map(k => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    })
    .sort((a, b) => a - b);
  let longestComebackGap = 0;
  for (let i = 1; i < sortedDays.length; i++) {
    const gap = Math.round((sortedDays[i] - sortedDays[i - 1]) / DAY_MS);
    if (gap > longestComebackGap) longestComebackGap = gap;
  }

  // Full PPL within any rolling 7-day window of trained days.
  let hasFullPPLWeek = false;
  for (let i = 0; i < sortedDays.length && !hasFullPPLWeek; i++) {
    const windowCats = new Set<PPLCategory>();
    for (let j = i; j < sortedDays.length && sortedDays[j] - sortedDays[i] < 7 * DAY_MS; j++) {
      const k = dateKey(new Date(sortedDays[j]));
      dayPPL.get(k)?.forEach(c => windowCats.add(c));
    }
    if (windowCats.size === 3) hasFullPPLWeek = true;
  }

  return {
    trainedBefore6am,
    trainedAfter10pm,
    trainedMidnightTo4,
    maxWorkoutsInDay: Math.max(...perDayCount.values()),
    hasWeekendPair: [...week.values()].some(w => w.sat && w.sun),
    longestComebackGap,
    distinctExercises: distinct.size,
    hasFullPPLWeek,
    maxRepsSingleSet,
    maxRepsOneExerciseSession,
    hasAllFourSeasons: [...yearSeasons.values()].some(s => s.size === 4),
    pushSets,
    pullSets,
    trainedNewYearsDay,
    trainedThanksgiving,
    trainedChristmas,
    trainedLeapDay,
  };
}
