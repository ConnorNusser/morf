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
  previous?: DraftSet[]; // last time's sets — per-set ghost + autofill
  target?: DraftSet[]; // prescribed sets when following a routine — ghost + autofill
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
 * Build a draft from a parsed workout, attaching references. When `asTarget`,
 * the parsed sets become the prescription (target) and working sets start empty
 * so the user fills from target/previous; otherwise they're the working sets.
 */
export function buildDraft(
  parsed: ParsedWorkout,
  opts: { asTarget?: boolean; previousFor?: (exerciseId: string | undefined, name: string) => DraftSet[] | null } = {},
): WorkoutDraft {
  return parsed.exercises.map(pex => {
    const name = displayName(pex);
    const sets: DraftSet[] = pex.sets.map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit }));
    const previous = opts.previousFor?.(pex.matchedExerciseId, name) ?? undefined;
    return {
      key: nextKey(),
      name,
      exerciseId: pex.matchedExerciseId,
      recognized: !!pex.matchedExerciseId && !pex.isCustom,
      sets: opts.asTarget ? [] : sets,
      target: opts.asTarget ? sets : undefined,
      previous,
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

/** Total volume (Σ weight × reps) across the draft, in the preferred unit. */
export function totalVolume(draft: WorkoutDraft): number {
  return draft.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0);
}

/**
 * Add a recognized exercise the user named without any sets yet, attaching a
 * "last time" suggestion for one-tap autofill. No-op if it's already present.
 */
export function addNamedExercise(
  draft: WorkoutDraft,
  exercise: { name: string; exerciseId?: string; recognized: boolean; previous?: DraftSet[]; target?: DraftSet[] },
): WorkoutDraft {
  const ckey = consolidationKey(exercise.exerciseId, exercise.name);
  if (draft.some(e => consolidationKey(e.exerciseId, e.name) === ckey)) return draft;
  return [
    ...draft,
    {
      key: nextKey(),
      name: exercise.name,
      exerciseId: exercise.exerciseId,
      recognized: exercise.recognized,
      sets: [],
      previous: exercise.previous,
      target: exercise.target,
    },
  ];
}

export type ReferenceSource = 'previous' | 'target';

/** Autofill an exercise's sets from a reference (last time or the prescription).
 *  The reference is kept so it can still show as a per-set ghost afterward. */
export function applyReference(draft: WorkoutDraft, key: string, source: ReferenceSource): WorkoutDraft {
  return mapExercise(draft, key, ex => {
    const ref = source === 'target' ? ex.target : ex.previous;
    return ref && ref.length ? { ...ex, sets: ref.map(s => ({ ...s, done: false })) } : ex;
  });
}

/** Attach a "previous" reference to recognized exercises that don't have one. */
export function attachPrevious(
  draft: WorkoutDraft,
  previousFor: (exerciseId: string, name: string) => DraftSet[] | null,
): WorkoutDraft {
  return draft.map(ex => {
    if (ex.previous || !ex.exerciseId) return ex;
    return { ...ex, previous: previousFor(ex.exerciseId, ex.name) ?? undefined };
  });
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
