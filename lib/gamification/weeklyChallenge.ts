// A rotating weekly challenge — a fresh, varied goal each week (a recurring
// "come back" hook on top of the lifetime achievements). Deterministic per
// Monday-start week, computed purely from this week's workouts.
import { getWorkoutById } from '@/lib/workout/workouts';
import { GeneratedWorkout, MuscleGroup } from '@/types';

// Success green for a completed weekly challenge (shared by both surfaces).
export const CHALLENGE_DONE_COLOR = '#34C759';

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  progress: number; // 0..1
  completed: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeekMonday(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

function thisWeeksWorkouts(workouts: GeneratedWorkout[], now: Date): GeneratedWorkout[] {
  const start = startOfWeekMonday(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return workouts.filter(w => {
    const c = new Date(w.createdAt);
    return c >= start && c < end;
  });
}

function daysCount(ws: GeneratedWorkout[]): number {
  return new Set(ws.map(w => dateKey(new Date(w.createdAt)))).size;
}

function setsCount(ws: GeneratedWorkout[]): number {
  let n = 0;
  for (const w of ws) for (const ex of w.exercises || []) for (const s of ex.completedSets || []) if (s.completed) n += 1;
  return n;
}

function repsCount(ws: GeneratedWorkout[]): number {
  let n = 0;
  for (const w of ws) for (const ex of w.exercises || []) for (const s of ex.completedSets || []) if (s.completed) n += s.reps;
  return n;
}

function musclesCount(ws: GeneratedWorkout[]): number {
  const set = new Set<MuscleGroup>();
  for (const w of ws)
    for (const ex of w.exercises || []) {
      const m = getWorkoutById(ex.id)?.primaryMuscles?.[0];
      if (m) set.add(m);
    }
  return set.size;
}

interface ChallengeDef {
  id: string;
  title: string;
  description: string;
  target: number;
  metric: (ws: GeneratedWorkout[]) => number;
}

const CHALLENGES: ChallengeDef[] = [
  { id: 'days', title: 'Consistency', description: 'Train 4 days this week', target: 4, metric: daysCount },
  { id: 'sets', title: 'Work Capacity', description: 'Complete 60 sets this week', target: 60, metric: setsCount },
  { id: 'muscles', title: 'Full Body', description: 'Hit 5 muscle groups this week', target: 5, metric: musclesCount },
  { id: 'reps', title: 'The Grind', description: 'Complete 300 reps this week', target: 300, metric: repsCount },
];

export function computeWeeklyChallenge(workouts: GeneratedWorkout[], now: Date = new Date()): WeeklyChallenge {
  const start = startOfWeekMonday(now);
  const weekIndex = Math.floor(start.getTime() / WEEK_MS);
  const def = CHALLENGES[((weekIndex % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
  const current = def.metric(thisWeeksWorkouts(workouts, now));
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    current,
    target: def.target,
    progress: Math.max(0, Math.min(1, current / def.target)),
    completed: current >= def.target,
  };
}
