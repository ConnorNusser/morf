// The structured workout draft — the editable source of truth for a logging
// session. Freeform text/voice at the composer is parsed and *merged* into this
// draft (append model); the user then edits sets directly via traditional UI.
// The draft serializes back to note syntax (draftToNoteText) so the existing
// finish/save/persistence pipeline keeps working unchanged.
import type { ParsedExercise, ParsedWorkout } from '@/lib/workout/workoutNoteParser';
import { getWorkoutById } from '@/lib/workout/workouts';
import { WeightUnit } from '@/types';

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
    .filter(ex => ex.sets.length > 0)
    .map(ex => ({
      name: ex.name,
      matchedExerciseId: ex.exerciseId,
      isCustom: !ex.exerciseId,
      sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, completed: !!s.done })),
    }));
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
 * Downward "target" mirroring. After set `index` is edited (its old weight×reps
 * were `prevWeight`×`prevReps`), cascade its new weight×reps onto the sets *below*
 * it that were still sitting at that old target — or are a blank 0×0 row — stopping
 * at the first set that carries its own numbers. Only un-done sets below are
 * touched; a set you've already logged is never rewritten. No-op when nothing
 * actually changed.
 *
 * So 140×8 ×4 → editing the first to 150×8 makes them all 150×8; 140/140/170 →
 * editing the first to 150 changes the first two but leaves the customized 170;
 * one filled set over blank rows fills the blanks with the same weight and reps.
 */
export function propagateSet(
  draft: WorkoutDraft,
  key: string,
  index: number,
  prevWeight: number,
  prevReps: number,
): WorkoutDraft {
  return mapExercise(draft, key, ex => {
    const cur = ex.sets[index];
    if (!cur) return ex;
    if (cur.weight === prevWeight && cur.reps === prevReps) return ex; // unchanged
    const matchesOld = (s: DraftSet) => s.weight === prevWeight && s.reps === prevReps;
    const blank = (s: DraftSet) => s.weight === 0 && s.reps === 0;
    const sets = ex.sets.slice();
    for (let j = index + 1; j < sets.length; j++) {
      const s = sets[j];
      if (s.done) break; // never overwrite a performed set
      // Follows along only if it's still the untouched target or an empty row; any
      // set with its own distinct numbers stops the cascade.
      if (matchesOld(s) || blank(s)) sets[j] = { ...s, weight: cur.weight, reps: cur.reps };
      else break;
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
