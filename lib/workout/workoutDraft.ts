// Editable source of truth for a logging session; serializes back to note syntax
// (draftToNoteText) so the finish/save/persistence pipeline works unchanged.
import type { ParsedExercise, ParsedWorkout } from '@/lib/workout/workoutNoteParser';
import { getWorkoutById } from '@/lib/workout/workouts';
import { RoutineExercise, WeightUnit } from '@/types';

export interface DraftSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  done?: boolean; // checked off (green row)
}

export interface DraftExercise {
  key: string;
  name: string;
  exerciseId?: string;
  recognized: boolean;
  sets: DraftSet[];
}

export type WorkoutDraft = DraftExercise[];

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `dex_${keyCounter}`;
}

function displayName(ex: ParsedExercise): string {
  if (ex.matchedExerciseId) return getWorkoutById(ex.matchedExerciseId)?.name || ex.name;
  return ex.name;
}

function consolidationKey(exerciseId: string | undefined, name: string): string {
  return exerciseId || name.toLowerCase().trim();
}

/** Append parsed exercises into a draft, merging sets into an existing match.
 *  `done` marks the added sets complete (composer/voice entries land checked off). */
export function mergeParsed(draft: WorkoutDraft, parsed: ParsedExercise[], opts: { done?: boolean } = {}): WorkoutDraft {
  const next: WorkoutDraft = draft.map(e => ({ ...e, sets: [...e.sets] }));
  for (const pex of parsed) {
    const name = displayName(pex);
    const ckey = consolidationKey(pex.matchedExerciseId, name);
    const sets: DraftSet[] = pex.sets.map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, done: opts.done }));
    const existing = next.find(e => consolidationKey(e.exerciseId, e.name) === ckey);
    if (existing) {
      existing.sets.push(...sets);
    } else {
      next.push({
        key: nextKey(),
        name,
        exerciseId: pex.matchedExerciseId,
        recognized: !!pex.matchedExerciseId && !pex.isCustom,
        sets,
      });
    }
  }
  return next;
}

export function draftFromParsed(parsed: ParsedWorkout): WorkoutDraft {
  return mergeParsed([], parsed.exercises);
}

/** When `asTarget` (following a routine), parsed sets are the prescription:
 *  pre-filled un-done so you just adjust and check off. */
export function buildDraft(
  parsed: ParsedWorkout,
  opts: { asTarget?: boolean } = {},
): WorkoutDraft {
  return parsed.exercises.map(pex => {
    const name = displayName(pex);
    const sets: DraftSet[] = pex.sets.map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit }));
    return {
      key: nextKey(),
      name,
      exerciseId: pex.matchedExerciseId,
      recognized: !!pex.matchedExerciseId && !pex.isCustom,
      sets: opts.asTarget ? sets.map(s => ({ ...s, done: false })) : sets,
    };
  });
}

export function draftToNoteText(draft: WorkoutDraft): string {
  return draft
    .map(ex => {
      const tokens = ex.sets.map(s => {
        const unit = s.unit === 'kg' ? 'kg' : '';
        return s.weight > 0 ? `${s.weight}${unit}x${s.reps}` : `x${s.reps}`;
      });
      return tokens.length ? `${ex.name} ${tokens.join(', ')}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

export function totalSets(draft: WorkoutDraft): number {
  return draft.reduce((n, e) => n + e.sets.length, 0);
}

/** Convert the draft straight to a ParsedWorkout for saving — no AI/parse pass. */
export function draftToParsedWorkout(draft: WorkoutDraft): ParsedWorkout {
  const exercises: ParsedExercise[] = draft
    .map(ex => ({
      name: ex.name,
      matchedExerciseId: ex.exerciseId,
      isCustom: !ex.exerciseId,
      // Only log sets checked off (done === true); un-done rows (prescriptions,
      // prefill/restore, added) are dropped so they don't land in history as completed.
      sets: ex.sets
        .filter(s => s.done === true)
        .map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, completed: true })),
    }))
    .filter(ex => ex.sets.length > 0);
  return { exercises, confidence: 1, rawText: draftToNoteText(draft) };
}

/** Total volume (Σ weight × reps) across the draft, in the preferred unit. */
export function totalVolume(draft: WorkoutDraft): number {
  return draft.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0);
}

/** Add a named exercise with no sets, pre-filling from the best reference
 *  (prescription, else last time). No-op if present. */
export function addNamedExercise(
  draft: WorkoutDraft,
  exercise: { name: string; exerciseId?: string; recognized: boolean; previous?: DraftSet[]; target?: DraftSet[] },
): WorkoutDraft {
  const ckey = consolidationKey(exercise.exerciseId, exercise.name);
  if (draft.some(e => consolidationKey(e.exerciseId, e.name) === ckey)) return draft;
  const ref = exercise.target?.length ? exercise.target : exercise.previous;
  return [
    ...draft,
    {
      key: nextKey(),
      name: exercise.name,
      exerciseId: exercise.exerciseId,
      recognized: exercise.recognized,
      sets: ref?.length ? ref.map(s => ({ ...s, done: false })) : [],
    },
  ];
}

function mapExercise(draft: WorkoutDraft, key: string, fn: (ex: DraftExercise) => DraftExercise): WorkoutDraft {
  return draft.map(ex => (ex.key === key ? fn(ex) : ex));
}

export function updateSet(draft: WorkoutDraft, key: string, index: number, patch: Partial<DraftSet>): WorkoutDraft {
  return mapExercise(draft, key, ex => ({
    ...ex,
    sets: ex.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)),
  }));
}

/**
 * Live downward "target" mirroring: set `index` gets the in-progress weight×reps,
 * cascading onto un-done sets below that still match the original target (or are
 * blank 0×0), stopping at the first set with its own numbers.
 *
 * Must recompute from `originalSets` (not the mutated draft) every keystroke — the
 * rows below start from their original values so clear-and-retype keeps tracking.
 */
export function previewSetEdit(
  draft: WorkoutDraft,
  key: string,
  index: number,
  originalSets: DraftSet[],
  weight: number,
  reps: number,
): WorkoutDraft {
  const orig = originalSets[index];
  if (!orig) return draft;
  return mapExercise(draft, key, ex => {
    const sets = originalSets.map(s => ({ ...s }));
    sets[index] = { ...sets[index], weight, reps };
    if (weight !== orig.weight || reps !== orig.reps) {
      const matchesOld = (s: DraftSet) => s.weight === orig.weight && s.reps === orig.reps;
      const blank = (s: DraftSet) => s.weight === 0 && s.reps === 0;
      for (let j = index + 1; j < sets.length; j++) {
        const s = sets[j];
        if (s.done) break; // never overwrite a performed set
        if (matchesOld(s) || blank(s)) sets[j] = { ...s, weight, reps };
        else break; // a set with its own distinct numbers stops the cascade
      }
    }
    return { ...ex, sets };
  });
}

export function toggleSetDone(draft: WorkoutDraft, key: string, index: number): WorkoutDraft {
  return mapExercise(draft, key, ex => ({
    ...ex,
    sets: ex.sets.map((s, i) => (i === index ? { ...s, done: !s.done } : s)),
  }));
}

export function addSet(draft: WorkoutDraft, key: string): WorkoutDraft {
  return mapExercise(draft, key, ex => {
    const last = ex.sets[ex.sets.length - 1];
    // A manually added set starts un-done.
    const added: DraftSet = last ? { ...last, done: false } : { weight: 0, reps: 0, unit: 'lbs', done: false };
    return { ...ex, sets: [...ex.sets, added] };
  });
}

/** Remove a set; drops the whole exercise if it was the last one. */
export function removeSet(draft: WorkoutDraft, key: string, index: number): WorkoutDraft {
  return draft
    .map(ex => (ex.key === key ? { ...ex, sets: ex.sets.filter((_, i) => i !== index) } : ex))
    .filter(ex => ex.sets.length > 0);
}

export function removeExercise(draft: WorkoutDraft, key: string): WorkoutDraft {
  return draft.filter(ex => ex.key !== key);
}

export function moveExercise(draft: WorkoutDraft, key: string, dir: -1 | 1): WorkoutDraft {
  const from = draft.findIndex(ex => ex.key === key);
  if (from < 0) return draft;
  const to = from + dir;
  if (to < 0 || to >= draft.length) return draft;
  const next = [...draft];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function moveExerciseToEdge(draft: WorkoutDraft, key: string, edge: 'top' | 'bottom'): WorkoutDraft {
  const from = draft.findIndex(ex => ex.key === key);
  if (from < 0) return draft;
  const to = edge === 'top' ? 0 : draft.length - 1;
  if (to === from) return draft;
  const next = [...draft];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Build a routine's exercise list from the draft — captures order, set count, reps.
 *  Routines store no weights (computed from records), so only structure carries over.
 *  Only exercises with a resolved id survive; warmup flags and notes are preserved
 *  from the previous routine by matching exerciseId. */
export function draftToRoutineExercises(draft: WorkoutDraft, prev: RoutineExercise[]): RoutineExercise[] {
  return draft
    .filter(ex => ex.exerciseId && ex.sets.length > 0)
    .map(ex => {
      const existing = prev.find(p => p.exerciseId === ex.exerciseId);
      return {
        exerciseId: ex.exerciseId as string,
        exerciseName: ex.name,
        sets: ex.sets.map((s, i) => ({ reps: s.reps, isWarmup: existing?.sets[i]?.isWarmup })),
        intensityModifier: existing?.intensityModifier,
        notes: existing?.notes,
      };
    });
}

/** True when folding the draft into the routine would change it (exercises, order,
 *  set counts, or reps). Drives the pre-finish "update your routine?" prompt. */
export function routineDiffersFromDraft(draft: WorkoutDraft, prev: RoutineExercise[]): boolean {
  const next = draftToRoutineExercises(draft, prev);
  if (next.length !== prev.length) return true;
  for (let i = 0; i < next.length; i++) {
    const a = next[i];
    const b = prev[i];
    if (a.exerciseId !== b.exerciseId) return true;
    if (a.sets.length !== b.sets.length) return true;
    for (let j = 0; j < a.sets.length; j++) {
      if (a.sets[j].reps !== b.sets[j].reps) return true;
    }
  }
  return false;
}
