// Input feed -> synthesized workout.
//
// The note sheet is treated as a feed of input entries (one per line — typed,
// dictated, or structured). Each entry is parsed ONCE and cached, then all
// entries are folded into a single synthesized workout (consolidated by
// exercise) that the UI renders below the composer. Re-folding after a new line
// therefore costs nothing: only the new/edited line is parsed, and the local
// regex parse is free. Lines the local parser can't make sense of are flagged
// low-confidence so the caller can escalate just those to the AI parser — which
// overwrites that one entry's cache. So tokens are spent per-ambiguous-line, not
// per-keystroke and not on the whole sheet.
import { ParsedExercise, ParsedSet, ParsedWorkout, workoutNoteParser } from '@/lib/workout/workoutNoteParser';
import { getWorkoutById } from '@/lib/workout/workouts';
import { WeightUnit } from '@/types';

export interface SynthesizedExercise {
  key: string; // matched exercise id, else normalized name
  name: string; // display name
  recognized: boolean; // matched a real (non-custom) exercise
  sets: ParsedSet[];
}

export interface SynthesizedWorkout {
  exercises: SynthesizedExercise[];
  totalSets: number;
  lowConfidenceLines: string[]; // raw lines worth escalating to the AI parser
}

// Per-entry parse cache, keyed by unit + trimmed line. An AI upgrade overwrites
// the entry in place so subsequent folds pick up the better parse for free.
const entryCache = new Map<string, ParsedWorkout>();

function cacheKey(unit: WeightUnit, raw: string): string {
  return `${unit}::${raw.trim()}`;
}

/** Local (free, synchronous) parse of a single input line, memoized. */
export function parseEntryLocal(raw: string, unit: WeightUnit): ParsedWorkout {
  const key = cacheKey(unit, raw);
  const hit = entryCache.get(key);
  if (hit) return hit;
  const result = workoutNoteParser.parseLocal(raw, unit);
  entryCache.set(key, result);
  return result;
}

/**
 * Escalate one ambiguous line to the AI parser and overwrite its cache entry.
 * Returns true if the upgrade produced exercises (so the caller should re-fold).
 */
export async function upgradeEntryWithAI(raw: string, unit: WeightUnit): Promise<boolean> {
  try {
    const ai = await workoutNoteParser.parseWorkoutNote(raw, unit);
    if (ai.exercises.length > 0) {
      entryCache.set(cacheKey(unit, raw), ai);
      return true;
    }
  } catch {
    // leave the local parse in place
  }
  return false;
}

/** Test/diagnostic helper — clears the per-entry parse cache. */
export function _clearEntryCache(): void {
  entryCache.clear();
}

function displayName(ex: ParsedExercise): string {
  if (ex.matchedExerciseId) return getWorkoutById(ex.matchedExerciseId)?.name || ex.name;
  return ex.name;
}

/** Fold every line of the sheet into one consolidated, synthesized workout. */
export function synthesize(text: string, unit: WeightUnit): SynthesizedWorkout {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const byExercise = new Map<string, SynthesizedExercise>();
  const lowConfidenceLines: string[] = [];

  for (const line of lines) {
    const parsed = parseEntryLocal(line, unit);
    // A non-empty line the local parser couldn't turn into any exercise is the
    // signal to escalate — that's where the AI parse earns its tokens.
    if (parsed.exercises.length === 0) {
      lowConfidenceLines.push(line);
      continue;
    }
    for (const ex of parsed.exercises) {
      const name = displayName(ex);
      const key = ex.matchedExerciseId || name.toLowerCase().trim();
      const existing = byExercise.get(key);
      if (existing) {
        existing.sets.push(...ex.sets);
      } else {
        byExercise.set(key, {
          key,
          name,
          recognized: !!ex.matchedExerciseId && !ex.isCustom,
          sets: [...ex.sets],
        });
      }
    }
  }

  const exercises = [...byExercise.values()];
  return {
    exercises,
    totalSets: exercises.reduce((n, e) => n + e.sets.length, 0),
    lowConfidenceLines,
  };
}
