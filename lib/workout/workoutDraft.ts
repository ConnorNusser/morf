// The structured workout draft — the editable source of truth for a logging
// session. Freeform text/voice at the composer is parsed and *merged* into this
// draft (append model); the user then edits sets directly via traditional UI.
// The draft serializes back to note syntax (draftToNoteText) so the existing
// finish/save/persistence pipeline keeps working unchanged.
import type { ParsedExercise, ParsedWorkout } from '@/lib/workout/workoutNoteParser';
import { getWorkoutById } from '@/lib/workout/workouts';
import { RoutineExercise, WeightUnit } from '@/types';

export interface DraftSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  done?: boolean; // checked off during the session (green row)
}

export interface DraftExercise {
  key: string; // stable UI key for the row
  name: string;
  exerciseId?: string; // matched catalog/custom id, if recognized
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
 *  `done` marks the added sets complete (composer/voice entries are sets you
 *  just did, so they land checked off). */
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

/** Build a fresh draft from a parsed workout (e.g. parsed text or prefill). */
export function draftFromParsed(parsed: ParsedWorkout): WorkoutDraft {
  return mergeParsed([], parsed.exercises);
}

/**
 * Build a draft from a parsed workout. When `asTarget` (following a routine),
 * the parsed sets are the prescription: they pre-fill the working sets un-done
 * so there's nothing to tap — you just adjust and check off.
 */
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

/** Serialize a draft back to note syntax for the finish/save pipeline. */
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

/** Convert the draft straight to a ParsedWorkout for saving — no AI/parse pass.
 *  The draft already is the structured workout, so finishing is deterministic. */
export function draftToParsedWorkout(draft: WorkoutDraft): ParsedWorkout {
  const exercises: ParsedExercise[] = draft
    .map(ex => ({
      name: ex.name,
      matchedExerciseId: ex.exerciseId,
      isCustom: !ex.exerciseId,
      // Only log sets the user actually performed. Sets explicitly left un-done
      // (routine prescriptions/added rows never checked off) are dropped so they
      // don't land in history. `done === undefined` (freeform text/voice, which
      // arrive already-performed) counts as done.
      sets: ex.sets
        .filter(s => s.done !== false)
        .map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, completed: true })),
    }))
    // Drop exercises with nothing performed.
    .filter(ex => ex.sets.length > 0);
  return { exercises, confidence: 1, rawText: draftToNoteText(draft) };
}

/** Total volume (Σ weight × reps) across the draft, in the preferred unit. */
export function totalVolume(draft: WorkoutDraft): number {
  return draft.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0);
}

/**
 * Add a recognized exercise the user named without any sets yet, pre-filling its
 * sets from the best reference (prescription, else last time). No-op if present.
 */
export function addNamedExercise(
  draft: WorkoutDraft,
  exercise: { name: string; exerciseId?: string; recognized: boolean; previous?: DraftSet[]; target?: DraftSet[] },
): WorkoutDraft {
  const ckey = consolidationKey(exercise.exerciseId, exercise.name);
  if (draft.some(e => consolidationKey(e.exerciseId, e.name) === ckey)) return draft;
  // Auto-fill the working sets from the best reference we have (prescription, else
  // last time) so naming an exercise drops in ready-to-adjust sets — no button.
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

// ---- immutable edit helpers (traditional-UI editing of the cards) ----

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
 * Live downward "target" mirroring, computed from a snapshot of the exercise's
 * sets taken when editing began (`originalSets`). Set `index` is shown with the
 * in-progress `weight`×`reps`, and that value cascades onto the sets *below* it
 * that were still sitting at the original target — or are a blank 0×0 row —
 * stopping at the first set that carries its own numbers. Un-done sets only; a set
 * you've already logged is never rewritten.
 *
 * Recomputing from `originalSets` every keystroke (rather than from the mutated
 * draft) is what lets the targets keep tracking as you clear-and-retype: the rows
 * below always start from their original values, so the match doesn't get lost.
 *
 * 140×8 ×4 → retyping the first as 150×8 drags them all to 150×8; 140/140/170 →
 * the customized 170 stays put; one filled set over blank rows fills the blanks.
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

/** Toggle a set's done state (drives the green check-off row). */
export function toggleSetDone(draft: WorkoutDraft, key: string, index: number): WorkoutDraft {
  return mapExercise(draft, key, ex => ({
    ...ex,
    sets: ex.sets.map((s, i) => (i === index ? { ...s, done: !s.done } : s)),
  }));
}

export function addSet(draft: WorkoutDraft, key: string): WorkoutDraft {
  return mapExercise(draft, key, ex => {
    const last = ex.sets[ex.sets.length - 1];
    // A manually added set starts un-done — you check it off when you do it.
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

/** Move an exercise one slot up (dir -1) or down (dir +1); no-op at the ends. */
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

// ---- routine sync: fold a finished draft back into its routine prescription ----

/** Build a routine's exercise list from the current draft — captures the draft's
 *  order, per-exercise set count, and reps. Routines store no weights (they're
 *  computed from your records), so only structure carries over. Only exercises
 *  with a resolved id can live in a routine; freeform/unrecognized ones are
 *  dropped. Warmup flags and notes are preserved from the previous routine by
 *  matching exerciseId. */
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

/** True when folding the draft into the routine would actually change it —
 *  exercise set (added/removed), order, set counts, or reps all count. Drives the
 *  pre-finish "update your routine?" prompt so it only appears when there's a diff. */
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
