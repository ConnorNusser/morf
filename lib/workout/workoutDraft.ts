// Editable source of truth for a logging session; serializes back to note syntax
// (draftToNoteText) so the finish/save/persistence pipeline works unchanged.
import type { ParsedExercise, ParsedWorkout } from '@/lib/workout/workoutNoteParser';
import { roundWeight } from '@/lib/utils/utils';
import { getWorkoutById } from '@/lib/workout/workouts';
import { RoutineExercise, WeightUnit } from '@/types';

export interface DraftSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  done?: boolean; // checked off (green row)
  // Recorded role, not a guess: carried from the routine prescription or set by
  // the explicit "Add warmup set" action, and persisted through save so anchor
  // resolution and routine folding read it instead of reconstructing it.
  isWarmup?: boolean;
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
    const sets: DraftSet[] = pex.sets.map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, done: opts.done, isWarmup: s.isWarmup }));
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
    const sets: DraftSet[] = pex.sets.map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, isWarmup: s.isWarmup }));
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
        // Stamp the role on every saved set (false, not undefined, for work sets)
        // so downstream can tell a role-recorded session from legacy history.
        .map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, completed: true, isWarmup: s.isWarmup === true })),
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
    // A manually added set starts un-done and is a WORK set — sets append at the
    // end, after the work; warmups are added explicitly via addWarmupSet.
    const added: DraftSet = last
      ? { ...last, done: false, isWarmup: undefined }
      : { weight: 0, reps: 0, unit: 'lbs', done: false };
    return { ...ex, sets: [...ex.sets, added] };
  });
}

/** Prepend an explicit warmup row (from the exercise's ⋯ menu): ~60% of the
 *  heaviest work set, flagged so the anchor and the routine fold read it as a
 *  warmup — no guessing downstream. */
export function addWarmupSet(draft: WorkoutDraft, key: string): WorkoutDraft {
  return mapExercise(draft, key, ex => {
    const work = ex.sets.filter(s => !s.isWarmup);
    const top = work.reduce((m, s) => Math.max(m, s.weight), 0);
    const unit = ex.sets[0]?.unit ?? 'lbs';
    const added: DraftSet = {
      weight: top > 0 ? roundWeight(top * 0.6, unit) : 0,
      reps: work[0]?.reps ?? ex.sets[0]?.reps ?? 5,
      unit,
      done: false,
      isWarmup: true,
    };
    return { ...ex, sets: [added, ...ex.sets] };
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

/** Build a routine's exercise list from the draft — captures order and set count.
 *  Routines store no weights, and stored reps are the rep-range FLOOR the
 *  progression rule works against — the reps performed in a session are
 *  performance (the prescription moves them every workout), not program, so
 *  carried-over sets keep their stored floors (added sets inherit the last one)
 *  and only a brand-new exercise takes its reps from the draft. Rep targets are
 *  edited in the routine editor. Only exercises with a resolved id survive;
 *  warmup flags and notes are preserved by matching exerciseId. */
export function draftToRoutineExercises(draft: WorkoutDraft, prev: RoutineExercise[]): RoutineExercise[] {
  // Same exercise in two slots: the nth draft entry folds into the nth stored
  // slot, so a top-sets/backoff-sets pair can't overwrite each other's floors.
  const seen = new Map<string, number>();
  return draft
    .filter(ex => ex.exerciseId && ex.sets.length > 0)
    .map(ex => {
      const occurrence = seen.get(ex.exerciseId as string) ?? 0;
      seen.set(ex.exerciseId as string, occurrence + 1);
      const existing = prev.filter(p => p.exerciseId === ex.exerciseId)[occurrence];

      // Each draft row carries its recorded role (isWarmup), so the fold reads
      // it instead of reconstructing it from counts — adding a warmup row in the
      // session adds a warmup slot; deleting one removes exactly that slot.
      // Reps still preserve the stored floors for carried-over sets (performed
      // reps are performance, not program); added work sets inherit the last
      // floor, and only brand-new rows take their reps from the draft.
      const storedWarmupReps = (existing?.sets ?? []).filter(s => s.isWarmup).map(s => s.reps);
      const floors = (existing?.sets ?? []).filter(s => !s.isWarmup).map(s => s.reps);
      let warmupIdx = 0;
      let workIdx = 0;

      return {
        exerciseId: ex.exerciseId as string,
        exerciseName: ex.name,
        sets: ex.sets.map(s =>
          s.isWarmup
            ? { reps: storedWarmupReps[warmupIdx++] ?? s.reps, isWarmup: true }
            : { reps: floors[workIdx++] ?? floors[floors.length - 1] ?? s.reps, isWarmup: undefined },
        ),
        notes: existing?.notes,
      };
    });
}

/** True when folding the draft into the routine would change its STRUCTURE —
 *  exercises, order, or set counts. Drives the pre-finish "update your routine?"
 *  prompt. Reps are deliberately not compared: the draft carries prescription
 *  reps (floor+1 after a normal in-range session), so comparing them fired the
 *  prompt after every unchanged session — and accepting ratcheted the stored
 *  rep floor upward, breaking the fixed range that load steps are earned against. */
export function routineDiffersFromDraft(draft: WorkoutDraft, prev: RoutineExercise[]): boolean {
  const next = draftToRoutineExercises(draft, prev);
  if (next.length !== prev.length) return true;
  for (let i = 0; i < next.length; i++) {
    if (next[i].exerciseId !== prev[i].exerciseId) return true;
    if (next[i].sets.length !== prev[i].sets.length) return true;
  }
  return false;
}
