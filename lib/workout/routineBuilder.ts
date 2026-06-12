// Deterministic routine generation. Two hardcoded things and nothing else:
//   1. GOAL_PROGRAMMING — the goal's prescription (sets / reps / intensity). THIS
//      is what makes "Hypertrophy" actually mean higher reps.
//   2. SPLITS — the day structure (which exercises) per training frequency.
// buildProgram() stamps the goal's prescription onto the chosen split. No AI, no
// validator, no repair loop — the output is correct by construction.
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { TrainingGoal } from '@/lib/ai/splitTemplates';
import {
  ExerciseProgressionState,
  GeneratedWorkout,
  IntensityModifier,
  Routine,
  RoutineExercise,
  RoutineSet,
  SplitType,
  WeightUnit,
  convertWeight,
} from '@/types';

// ---- 1. The goal programming table ----
interface GoalProgramming {
  compoundSets: number;
  compoundReps: number; // base reps for heavy multi-joint lifts
  accessorySets: number;
  accessoryReps: number; // base reps for isolation / lighter work
  intensity: IntensityModifier; // working-weight level for the main lifts
}

export const GOAL_PROGRAMMING: Record<TrainingGoal, GoalProgramming> = {
  strength: { compoundSets: 5, compoundReps: 4, accessorySets: 3, accessoryReps: 8, intensity: 'heavy' },
  powerbuilding: { compoundSets: 4, compoundReps: 6, accessorySets: 3, accessoryReps: 10, intensity: 'heavy' },
  hypertrophy: { compoundSets: 4, compoundReps: 9, accessorySets: 3, accessoryReps: 13, intensity: 'moderate' },
  recomp: { compoundSets: 3, compoundReps: 10, accessorySets: 3, accessoryReps: 15, intensity: 'moderate' },
  athletic: { compoundSets: 4, compoundReps: 5, accessorySets: 3, accessoryReps: 8, intensity: 'heavy' },
  general: { compoundSets: 3, compoundReps: 8, accessorySets: 3, accessoryReps: 12, intensity: 'moderate' },
};

// ---- 2. The hardcoded splits (structure only; reps come from the goal table) ----
type Role = 'compound' | 'accessory';
interface Slot { id: string; role: Role }
interface DayDef { name: string; splitType: SplitType; slots: Slot[] }

const C = (id: string): Slot => ({ id, role: 'compound' });
const A = (id: string): Slot => ({ id, role: 'accessory' });

const PUSH_A: DayDef = { name: 'Push', splitType: 'push', slots: [C('bench-press-barbell'), C('overhead-press-barbell'), A('incline-bench-press-dumbbells'), A('lateral-raise-dumbbells'), A('tricep-pushdown-cables')] };
const PUSH_B: DayDef = { name: 'Push', splitType: 'push', slots: [C('overhead-press-barbell'), C('incline-bench-press-barbell'), A('dip-bodyweight'), A('lateral-raise-cables'), A('tricep-extension-dumbbells')] };
const PULL_A: DayDef = { name: 'Pull', splitType: 'pull', slots: [C('deadlift-barbell'), C('row-barbell'), A('lat-pulldown-cables'), A('rear-delt-fly-dumbbells'), A('bicep-curl-barbell')] };
const PULL_B: DayDef = { name: 'Pull', splitType: 'pull', slots: [C('pull-up-bodyweight'), C('row-cables'), A('seated-row-machine'), A('hammer-curl-dumbbells'), A('bicep-curl-cables')] };
const LEGS_A: DayDef = { name: 'Legs', splitType: 'legs', slots: [C('squat-barbell'), C('romanian-deadlift-barbell'), A('leg-press-machine'), A('leg-curl-machine'), A('calf-raise-machine')] };
const LEGS_B: DayDef = { name: 'Legs', splitType: 'legs', slots: [C('front-squat-barbell'), C('hip-thrust-barbell'), A('leg-extension-machine'), A('leg-curl-machine'), A('calf-raise-machine')] };
const UPPER_A: DayDef = { name: 'Upper', splitType: 'upper', slots: [C('bench-press-barbell'), C('row-barbell'), C('overhead-press-barbell'), A('lat-pulldown-cables'), A('bicep-curl-barbell'), A('tricep-pushdown-cables')] };
const LOWER_A: DayDef = { name: 'Lower', splitType: 'lower', slots: [C('squat-barbell'), C('romanian-deadlift-barbell'), A('leg-press-machine'), A('leg-curl-machine'), A('calf-raise-machine')] };
const UPPER_B: DayDef = { name: 'Upper', splitType: 'upper', slots: [C('incline-bench-press-barbell'), C('pull-up-bodyweight'), C('shoulder-press-dumbbells'), A('chest-fly-cables'), A('rear-delt-fly-cables'), A('hammer-curl-dumbbells')] };
const LOWER_B: DayDef = { name: 'Lower', splitType: 'lower', slots: [C('deadlift-barbell'), C('front-squat-barbell'), A('leg-extension-machine'), A('leg-curl-machine'), A('calf-raise-machine')] };
const FULL_A: DayDef = { name: 'Full Body A', splitType: 'full_body', slots: [C('squat-barbell'), C('bench-press-barbell'), C('row-barbell'), A('lateral-raise-dumbbells'), A('bicep-curl-barbell')] };
const FULL_B: DayDef = { name: 'Full Body B', splitType: 'full_body', slots: [C('deadlift-barbell'), C('overhead-press-barbell'), C('lat-pulldown-cables'), A('leg-curl-machine'), A('tricep-pushdown-cables')] };
const FULL_C: DayDef = { name: 'Full Body C', splitType: 'full_body', slots: [C('front-squat-barbell'), C('incline-bench-press-barbell'), C('pull-up-bodyweight'), A('leg-extension-machine'), A('hammer-curl-dumbbells')] };

// Frequency → day structure. Strength-leaning goals get a lower-frequency full-body
// bias at 3 days; everyone else rotates a split. Clamped to 3–6 days.
function splitFor(goal: TrainingGoal, days: number): DayDef[] {
  const d = Math.max(3, Math.min(6, Math.round(days)));
  if (d === 3) return [FULL_A, FULL_B, FULL_C];
  if (d === 4) return [UPPER_A, LOWER_A, UPPER_B, LOWER_B];
  if (d === 5) return [PUSH_A, PULL_A, LEGS_A, UPPER_B, LOWER_B];
  return [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B]; // 6
}

// ---- The builder ----
const INTENSITY_PCT: Record<IntensityModifier, number> = { heavy: 1.0, moderate: 0.9, light: 0.8 };

// Best estimated 1RM the lifter has hit on an exercise, in their unit (0 if none).
function bestE1RM(exerciseId: string, history: GeneratedWorkout[], unit: WeightUnit): number {
  let best = 0;
  for (const w of history) {
    for (const ex of w.exercises || []) {
      if (ex.id !== exerciseId) continue;
      for (const s of ex.completedSets || []) {
        if (!s.completed || s.weight <= 0 || s.reps <= 0) continue;
        const wt = s.unit && s.unit !== unit ? convertWeight(s.weight, s.unit, unit) : s.weight;
        best = Math.max(best, OneRMCalculator.estimate(wt, s.reps));
      }
    }
  }
  return best;
}

function seedWeight(exerciseId: string, reps: number, intensity: IntensityModifier, history: GeneratedWorkout[], unit: WeightUnit): number {
  const e1rm = bestE1RM(exerciseId, history, unit);
  if (e1rm <= 0) return 0; // no history → let the user fill it in / progressive overload seeds later
  const raw = e1rm * (OneRMCalculator.getPercentageFor(reps) / 100) * INTENSITY_PCT[intensity];
  const inc = unit === 'kg' ? 2.5 : 5;
  return Math.round(raw / inc) * inc;
}

export interface BuildOpts {
  history?: GeneratedWorkout[];
  unit?: WeightUnit;
  now?: number; // injectable timestamp for stable ids in tests
}

// Build a full week of routines for a goal + training days. Deterministic.
export function buildProgram(goal: TrainingGoal, days: number, opts: BuildOpts = {}): Routine[] {
  const prog = GOAL_PROGRAMMING[goal] ?? GOAL_PROGRAMMING.general;
  const history = opts.history ?? [];
  const unit = opts.unit ?? 'lbs';
  const stamp = opts.now ?? 0;

  return splitFor(goal, days).map((day, dayIdx) => {
    const progressionState: Record<string, ExerciseProgressionState> = {};
    const exercises: RoutineExercise[] = day.slots.map(slot => {
      const isCompound = slot.role === 'compound';
      const setCount = isCompound ? prog.compoundSets : prog.accessorySets;
      const reps = isCompound ? prog.compoundReps : prog.accessoryReps;
      const intensity: IntensityModifier = isCompound ? prog.intensity : 'light';
      const sets: RoutineSet[] = Array.from({ length: setCount }, () => ({ reps }));
      progressionState[slot.id] = {
        baseReps: reps,
        currentRepBonus: 0,
        currentWeight: seedWeight(slot.id, reps, intensity, history, unit),
        consecutiveFailures: 0,
      };
      return { exerciseId: slot.id, sets, intensityModifier: intensity };
    });

    return {
      id: `${goal}-${dayIdx + 1}-${stamp}`,
      name: day.name,
      splitType: day.splitType,
      exercises,
      createdAt: new Date(stamp),
      isActive: true,
      progressionState,
    } as Routine;
  });
}
