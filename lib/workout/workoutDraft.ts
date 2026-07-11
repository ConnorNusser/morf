// Editable source of truth for a logging session; serializes back to note syntax
// (draftToLogText) so the finish/save/persistence pipeline works unchanged.
import type { ParsedExercise, ParsedWorkout } from '@/lib/workout/workoutTextParser';
import { roundWeight } from '@/lib/utils/utils';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { RoutineExercise, WeightUnit } from '@/types';

export interface DraftSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  done?: boolean; // checked off (green row)
  // Recorded role — survives save so nothing downstream has to guess it.
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

// Random, not a counter: restored sessions keep their keys and a counter
// restarts at 0 — colliding keys make two exercises edit/remove as one.
function nextKey(): string {
  return `dex_${Math.random().toString(36).slice(2, 10)}`;
}

function displayName(ex: ParsedExercise): string {
  if (ex.matchedExerciseId) return getCatalogExercise(ex.matchedExerciseId)?.name || ex.name;
  return ex.name;
}

function normName(name: string): string {
  return name.toLowerCase().trim();
}

/** Ids match when both exist; otherwise names. Custom/typed rows can arrive
 *  id-less, and comparing id-to-name would file one exercise as two. */
function isSameExercise(
  a: { exerciseId?: string; name: string },
  b: { exerciseId?: string; name: string },
): boolean {
  if (a.exerciseId && b.exerciseId) return a.exerciseId === b.exerciseId;
  return normName(a.name) === normName(b.name);
}

/** Append parsed exercises into a draft, merging sets into an existing match.
 *  `done` marks the added sets complete (composer/voice entries land checked off). */
export function mergeParsed(draft: WorkoutDraft, parsed: ParsedExercise[], opts: { done?: boolean } = {}): WorkoutDraft {
  const next: WorkoutDraft = draft.map(e => ({ ...e, sets: [...e.sets] }));
  for (const pex of parsed) {
    const name = displayName(pex);
    const sets: DraftSet[] = pex.sets.map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, done: opts.done, isWarmup: s.isWarmup }));
    const existing = next.find(e => isSameExercise(e, { exerciseId: pex.matchedExerciseId, name }));
    if (existing) {
      existing.sets.push(...sets);
      // A recognized parse upgrades a name-keyed row.
      if (!existing.exerciseId && pex.matchedExerciseId) {
        existing.exerciseId = pex.matchedExerciseId;
        existing.recognized = !pex.isCustom;
        existing.name = name;
      }
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

export function draftToLogText(draft: WorkoutDraft): string {
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
      // Only checked-off sets log; un-done rows must not land in history.
      sets: ex.sets
        .filter(s => s.done === true)
        // Role stamped true/false on every saved set; absent = legacy session.
        .map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit, completed: true, isWarmup: s.isWarmup === true })),
    }))
    .filter(ex => ex.sets.length > 0);
  return { exercises, confidence: 1, rawText: draftToLogText(draft) };
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
  if (draft.some(e => isSameExercise(e, exercise))) return draft;
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
    // Appended sets are un-done WORK sets; warmups go through addWarmupSet.
    const added: DraftSet = last
      ? { ...last, done: false, isWarmup: undefined }
      : { weight: 0, reps: 0, unit: 'lbs', done: false };
    return { ...ex, sets: [...ex.sets, added] };
  });
}

/** Prepend a flagged warmup row at ~60% of the heaviest work set. */
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

/** Fold the draft into routine structure. Stored reps are the rep-range FLOOR
 *  (program, editor-owned) — performed reps are performance and never overwrite
 *  them; only brand-new rows take reps from the draft. */
export function draftToRoutineExercises(draft: WorkoutDraft, prev: RoutineExercise[]): RoutineExercise[] {
  // nth draft entry of a duplicated exercise folds into the nth stored slot.
  const seen = new Map<string, number>();
  return draft
    .filter(ex => ex.exerciseId && ex.sets.length > 0)
    .map(ex => {
      const occurrence = seen.get(ex.exerciseId as string) ?? 0;
      seen.set(ex.exerciseId as string, occurrence + 1);
      const existing = prev.filter(p => p.exerciseId === ex.exerciseId)[occurrence];

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

/** Structure diff (exercises, order, set counts) for the "update your routine?"
 *  prompt. Reps are deliberately excluded — the draft carries prescription reps,
 *  and comparing them would fire the prompt after every unchanged session. */
export function routineDiffersFromDraft(draft: WorkoutDraft, prev: RoutineExercise[]): boolean {
  const next = draftToRoutineExercises(draft, prev);
  if (next.length !== prev.length) return true;
  for (let i = 0; i < next.length; i++) {
    if (next[i].exerciseId !== prev[i].exerciseId) return true;
    if (next[i].sets.length !== prev[i].sets.length) return true;
  }
  return false;
}
