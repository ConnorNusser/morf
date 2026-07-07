/**
 * Builds a workout program from the template library (no AI). Standard equipment
 * setups only; limited/odd equipment is routed to the AI elsewhere. Returns the same
 * GeneratedRoutineProgram shape the AI path produces, so downstream works unchanged.
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

const WORKOUT_BY_ID = new Map(ALL_WORKOUTS.map(w => [w.id, w]));

// Slots grouped by target muscle — used to backfill days that come up short.
const SLOTS_BY_TARGET: Partial<Record<MuscleGroup, ExerciseSlot[]>> = (() => {
  const map: Partial<Record<MuscleGroup, ExerciseSlot[]>> = {};
  for (const key of Object.keys(SLOTS) as SlotKey[]) {
    const slot = SLOTS[key];
    (map[slot.target] ||= []).push(slot);
  }
  return map;
})();

const ALL_MUSCLES: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'glutes', 'arms', 'core'];

/** Day template per muscle — used to replace a skipped day with a focus day. */
const FOCUS_DAY_TEMPLATE: Partial<Record<MuscleGroup, string>> = {
  chest: 'chest_day',
  back: 'back_day',
  shoulders: 'shoulder_day',
  arms: 'arm_day',
  legs: 'leg_day',
  glutes: 'leg_day',
};

/** Fallback day templates (priority order) when there's no focus area to use. */
const SUBSTITUTE_DAYS = ['upper_gen', 'push', 'pull', 'upper_hyper', 'chest_arms', 'back_shoulders', 'lower_gen'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** A program suits a level if it has no level tag, or explicitly lists the level. */
function suitsLevel(p: ProgramDef, experience?: TrainingAdvancement): boolean {
  return !experience || !p.bestFor || p.bestFor.includes(experience);
}

/** Select a program suited to goal + days (+ experience), RNG-picking among matches.
 *  Relaxes constraints progressively if nothing matches exactly. */
export function selectProgram(goal: TrainingGoal, days: number, experience?: TrainingAdvancement): ProgramDef {
  const byGoalDays = PROGRAMS.filter(p => p.days === days && p.goals.includes(goal));

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
    // Reject by the exercise's actual primary muscle, not the slot's label — some
    // movements sit in a slot whose target differs from what they primarily hit.
    if (w.primaryMuscles[0] && ignored.has(w.primaryMuscles[0])) continue;
    return { id, name: w.name, isCompound: w.category === 'compound' };
  }
  return null;
}

/** Substitute day template when the original targets only skipped muscles. Prefers a
 *  focus-area day, else a general non-skipped day. `seed` rotates through focus areas
 *  so multiple replaced days don't all become the same day. */
function substituteDay(ignored: Set<string>, focus: Set<string>, seed = 0): DayTemplate {
  const focusDays = [...focus]
    .filter(m => !ignored.has(m) && FOCUS_DAY_TEMPLATE[m as MuscleGroup])
    .map(m => DAY_TEMPLATES[FOCUS_DAY_TEMPLATE[m as MuscleGroup]!])
    .filter(dt => dt && !dt.targetMuscles.every(t => ignored.has(t)));
  if (focusDays.length) return focusDays[seed % focusDays.length];

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
  // If the whole day targets only skipped muscles, replace it.
  if (template.targetMuscles.every(m => opts.ignored.has(m))) {
    template = substituteDay(opts.ignored, opts.focus, dayNumber);
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

  // 2. Expand with accessories until the target count, biasing toward focus areas.
  const accessories = [...template.accessories].sort((a, b) => {
    const aF = opts.focus.has(a.target) ? 0 : 1;
    const bF = opts.focus.has(b.target) ? 0 : 1;
    return aF - bF;
  });
  for (const slot of accessories) {
    if (resolved.length >= opts.targetCount) break;
    tryAdd(slot, false);
  }

  // 3. Pull in must-include exercises that fit this day and aren't placed yet.
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

  // 3.5 Focus = frequency: ensure each focus muscle is trained on this day even if the
  //     template doesn't normally hit it. Injected after the core anchors (trained fresh),
  //     capped per day so multiple focuses don't bloat a session.
  const FOCUS_INJECT_CAP = 2;
  const present = new Set(
    resolved.map(r => WORKOUT_BY_ID.get(r.ex.id)?.primaryMuscles[0]).filter(Boolean) as MuscleGroup[]
  );
  let injected = 0;
  for (const m of opts.focus as Set<MuscleGroup>) {
    if (injected >= FOCUS_INJECT_CAP) break;
    if (opts.ignored.has(m) || present.has(m)) continue;
    let added: ResolvedExercise | null = null;
    for (const slot of SLOTS_BY_TARGET[m] || []) {
      added = resolveSlot(slot, opts.available, used, opts.excluded, opts.ignored);
      if (added) break;
    }
    if (added) {
      used.add(added.id);
      const insertAt = resolved.findIndex(r => !r.isCore);
      const entry = { ex: added, isCore: false };
      if (insertAt === -1) resolved.push(entry);
      else resolved.splice(insertAt, 0, entry);
      present.add(m);
      injected++;
    }
  }

  // 4. Backfill a short day, in order: focus areas, then the day's theme, then any
  //    other non-skipped area.
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
