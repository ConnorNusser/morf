/**
 * Deterministic Routine Builder
 * ------------------------------------------------------------------------------------
 * Builds a workout program from the attributed template library (no AI). Used for
 * standard equipment setups; limited/odd equipment is routed to the AI elsewhere.
 *
 * Pipeline per request:
 *   1. selectProgram(goal, days) — filter the library to suitable programs, RNG-pick one.
 *   2. For each day template: resolve slots → concrete exercises for the user's equipment,
 *      skipping ignored muscle groups, biasing accessories toward focus areas, and
 *      expanding from the 4 core anchors up to the requested exercise count.
 *   3. Assign sets/reps from the program's volume flavor.
 *
 * Returns the same GeneratedRoutineProgram shape the AI path produces, so preview /
 * refine / convert-to-routines all work unchanged.
 */

import { Equipment, MuscleGroup, TrainingAdvancement } from '@/types';
import { TrainingGoal } from '@/lib/ai/splitTemplates';
import { ALL_WORKOUTS } from '@/lib/workout/workouts';
import type { GeneratedRoutineDay, GeneratedRoutineProgram } from '@/lib/ai/aiRoutineGenerator';
import {
  PROGRAMS,
  DAY_TEMPLATES,
  REP_SCHEMES,
  SLOTS,
  SlotKey,
  ProgramDef,
  DayTemplate,
  ExerciseSlot,
} from '@/lib/data/programTemplates';

export interface DeterministicBuildOptions {
  goal: TrainingGoal;
  days: number;
  equipment: Equipment[];
  experience?: TrainingAdvancement;
  exerciseCount?: { min: number; max: number };
  focusMuscles?: string[];
  ignoredMuscles?: string[];
  includedExerciseIds?: string[];
  excludedExerciseIds?: string[];
}

interface ResolvedExercise {
  id: string;
  name: string;
  isCompound: boolean;
}

// id -> workout lookup
const WORKOUT_BY_ID = new Map(ALL_WORKOUTS.map(w => [w.id, w]));

// Slots grouped by the muscle they target — used to backfill days that come up short
// (e.g. after skipping a muscle group) with extra work from other areas.
const SLOTS_BY_TARGET: Partial<Record<MuscleGroup, ExerciseSlot[]>> = (() => {
  const map: Partial<Record<MuscleGroup, ExerciseSlot[]>> = {};
  for (const key of Object.keys(SLOTS) as SlotKey[]) {
    const slot = SLOTS[key];
    (map[slot.target] ||= []).push(slot);
  }
  return map;
})();

const ALL_MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'glutes', 'arms', 'core'];

/** Fallback day templates (in priority order) used when a whole day is skipped. */
const SUBSTITUTE_DAYS = ['upper_gen', 'push', 'pull', 'upper_hyper', 'chest_arms', 'back_shoulders', 'lower_gen'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** A program suits a level if it has no level tag, or explicitly lists the level. */
function suitsLevel(p: ProgramDef, experience?: TrainingAdvancement): boolean {
  return !experience || !p.bestFor || p.bestFor.includes(experience);
}

/**
 * Select a program suited to the goal + days (+ experience), RNG-picking among the
 * matches for variety. Relaxes constraints progressively if nothing matches exactly.
 */
export function selectProgram(goal: TrainingGoal, days: number, experience?: TrainingAdvancement): ProgramDef {
  const byGoalDays = PROGRAMS.filter(p => p.days === days && p.goals.includes(goal));

  // Prefer programs that also fit the lifter's experience level.
  const levelFit = byGoalDays.filter(p => suitsLevel(p, experience));
  if (levelFit.length) return pickRandom(levelFit);
  if (byGoalDays.length) return pickRandom(byGoalDays);

  const sameDays = PROGRAMS.filter(p => p.days === days);
  if (sameDays.length) return pickRandom(sameDays);

  // Nearest day count as a last resort.
  const byDistance = [...PROGRAMS].sort((a, b) => Math.abs(a.days - days) - Math.abs(b.days - days));
  return byDistance[0];
}

/** Resolve a slot to the best available exercise the user hasn't used yet. */
function resolveSlot(
  slot: ExerciseSlot,
  available: Set<Equipment>,
  used: Set<string>,
  excluded: Set<string>,
  ignored: Set<string>
): ResolvedExercise | null {
  for (const id of slot.options) {
    if (used.has(id) || excluded.has(id)) continue;
    const w = WORKOUT_BY_ID.get(id);
    if (!w) continue;
    if (!w.equipment.every(eq => available.has(eq))) continue;
    // Reject by the exercise's actual primary muscle, not just the slot's label — some
    // movements live in a slot whose target differs from what they primarily hit
    // (e.g. shrugs sit in a "back" slot but primarily work the shoulders/traps).
    if (w.primaryMuscles[0] && ignored.has(w.primaryMuscles[0])) continue;
    return { id, name: w.name, isCompound: w.category === 'compound' };
  }
  return null;
}

/** Choose a substitute day template when the original targets only ignored muscles. */
function substituteDay(ignored: Set<string>): DayTemplate {
  for (const key of SUBSTITUTE_DAYS) {
    const dt = DAY_TEMPLATES[key];
    if (dt && !dt.targetMuscles.every(m => ignored.has(m))) return dt;
  }
  return DAY_TEMPLATES.upper_gen;
}

function setsRepsFor(program: ProgramDef, isCore: boolean, isCompound: boolean): { sets: number; reps: number } {
  const scheme = REP_SCHEMES[program.volume];
  if (isCore && isCompound) return scheme.coreCompound;
  if (isCore) return scheme.coreIso;
  return scheme.accessory;
}

function buildDay(
  program: ProgramDef,
  dayKey: string,
  dayNumber: number,
  opts: {
    available: Set<Equipment>;
    excluded: Set<string>;
    focus: Set<string>;
    ignored: Set<string>;
    targetCount: number;
    pendingIncludes: ResolvedExercise[];
  }
): GeneratedRoutineDay {
  let template = DAY_TEMPLATES[dayKey];
  // If the whole day targets only skipped muscles, swap it for a non-skipped day.
  if (template.targetMuscles.every(m => opts.ignored.has(m))) {
    template = substituteDay(opts.ignored);
  }

  const used = new Set<string>();
  const resolved: { ex: ResolvedExercise; isCore: boolean }[] = [];

  const tryAdd = (slot: ExerciseSlot, isCore: boolean) => {
    if (opts.ignored.has(slot.target)) return;
    const ex = resolveSlot(slot, opts.available, used, opts.excluded, opts.ignored);
    if (ex) {
      used.add(ex.id);
      resolved.push({ ex, isCore });
    }
  };

  // 1. Anchor on the core slots.
  template.core.forEach(slot => tryAdd(slot, true));

  // 2. Expand with accessories until we hit the target count, biasing toward focus areas.
  const accessories = [...template.accessories].sort((a, b) => {
    const aF = opts.focus.has(a.target) ? 0 : 1;
    const bF = opts.focus.has(b.target) ? 0 : 1;
    return aF - bF;
  });
  for (const slot of accessories) {
    if (resolved.length >= opts.targetCount) break;
    tryAdd(slot, false);
  }

  // 3. Pull in any must-include exercises that fit this day and aren't placed yet.
  for (let i = opts.pendingIncludes.length - 1; i >= 0; i--) {
    const inc = opts.pendingIncludes[i];
    if (used.has(inc.id)) { opts.pendingIncludes.splice(i, 1); continue; }
    const w = WORKOUT_BY_ID.get(inc.id);
    const fitsDay = w && w.primaryMuscles.some(m => template.targetMuscles.includes(m));
    if (fitsDay && !opts.ignored.has(w!.primaryMuscles[0])) {
      used.add(inc.id);
      resolved.push({ ex: inc, isCore: false });
      opts.pendingIncludes.splice(i, 1);
    }
  }

  // 4. Backfill: if the day came up short (e.g. after skipping a muscle group, or a
  //    template with few accessories), top it up with extra work from the focus areas
  //    first, then the day's own theme, then any other non-skipped area.
  if (resolved.length < opts.targetCount) {
    const fillOrder: MuscleGroup[] = [];
    const queue = (muscles: MuscleGroup[]) => {
      for (const m of muscles) {
        if (!opts.ignored.has(m) && !fillOrder.includes(m)) fillOrder.push(m);
      }
    };
    queue([...opts.focus] as MuscleGroup[]);
    queue(template.targetMuscles);
    queue(ALL_MUSCLES);

    for (const muscle of fillOrder) {
      if (resolved.length >= opts.targetCount) break;
      for (const slot of SLOTS_BY_TARGET[muscle] || []) {
        if (resolved.length >= opts.targetCount) break;
        tryAdd(slot, false);
      }
    }
  }

  const exercises = resolved.map(({ ex, isCore }) => {
    const { sets, reps } = setsRepsFor(program, isCore, ex.isCompound);
    return { name: ex.name, sets, reps };
  });

  const estMinutes = Math.max(30, Math.round(exercises.length * 9));

  return {
    name: template.name,
    dayNumber,
    focus: template.focus,
    targetMuscles: template.targetMuscles.filter(m => !opts.ignored.has(m)),
    exercises,
    estimatedTime: `${estMinutes} min`,
  };
}

export function buildDeterministicProgram(options: DeterministicBuildOptions): GeneratedRoutineProgram {
  const program = selectProgram(options.goal, options.days, options.experience);

  const available = new Set(options.equipment);
  const excluded = new Set(options.excludedExerciseIds || []);
  const focus = new Set((options.focusMuscles || []) as MuscleGroup[]);
  const ignored = new Set((options.ignoredMuscles || []) as MuscleGroup[]);
  const targetCount = options.exerciseCount?.max ?? 6;

  // Resolve must-include IDs up front so we can slot them into matching days.
  const pendingIncludes: ResolvedExercise[] = (options.includedExerciseIds || [])
    .map(id => {
      const w = WORKOUT_BY_ID.get(id);
      return w ? { id, name: w.name, isCompound: w.category === 'compound' } : null;
    })
    .filter((x): x is ResolvedExercise => !!x);

  const routines = program.dayPlan.map((dayKey, i) =>
    buildDay(program, dayKey, i + 1, {
      available,
      excluded,
      focus,
      ignored,
      targetCount,
      pendingIncludes,
    })
  );

  // Any includes that never found a home: drop them onto the first day with room.
  if (pendingIncludes.length && routines.length) {
    for (const inc of pendingIncludes) {
      const { sets, reps } = setsRepsFor(program, false, inc.isCompound);
      routines[0].exercises.push({ name: inc.name, sets, reps });
    }
  }

  return {
    programName: program.name,
    programStyle: program.style,
    trainingGoal: options.goal,
    routines,
    source: program.source,
  };
}
