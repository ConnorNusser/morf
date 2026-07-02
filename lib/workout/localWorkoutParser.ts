// Offline workout-note tokenizer — the free, instant parse behind the live
// synthesized log. It's deliberately forgiving about how lifters actually write
// sets, so the synthesized cards read cleanly from the first keystroke and the
// AI parser is reserved for genuinely ambiguous lines.
//
// Handles, per line:
//   name extraction that survives hyphens / apostrophes / digits in names
//     ("Push-up", "Farmer's Walk", "Romanian Deadlift")
//   set formats: 135x8 · 135 x 8 · 135x8x3 (weight×reps×sets) · 185x5, 5, 5
//     (weight carry-forward) · 225 for 5 · 225 5 · bodyweight x10, 8, 6 · x10
//   units: 60kg / 135lb / 135# override the default
//   noise: trailing "@8" / "RPE 8" intensity markers are stripped
//
// Exercise matching is name-based (not exact-id), with an equipment default, so
// "bench press" resolves to the barbell variant without the user qualifying it.
import type { ParsedExercise, ParsedSet, ParsedWorkout } from '@/lib/workout/workoutNoteParser';
import { getAvailableWorkouts } from '@/lib/workout/workouts';
import { WeightUnit } from '@/types';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // drop "(Barbell)" etc.
    .replace(/[^a-z0-9 ]/g, ' ') // hyphens/apostrophes -> space
    .replace(/\s+/g, ' ')
    .trim();
}

// Like normalize but KEEPS the parenthetical equipment ("Overhead Press (Machine)"
// -> "overhead press machine"), so an equipment qualifier the catalog spells in
// parens is still searchable as words (e.g. matching "smith" against it).
function normalizeKeepEquip(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface IndexedExercise {
  id: string;
  name: string;
  base: string; // normalized, equipment stripped
  fullNorm: string; // normalized, equipment kept
  equipment: string[]; // catalog equipment tags (e.g. ['machine'])
  isBarbell: boolean;
}

let exerciseIndex: IndexedExercise[] | null = null;
function getIndex(): IndexedExercise[] {
  if (!exerciseIndex) {
    exerciseIndex = getAvailableWorkouts(500).map(e => ({
      id: e.id,
      name: e.name,
      base: normalize(e.name),
      fullNorm: normalizeKeepEquip(e.name),
      equipment: (e.equipment ?? []).map(eq => eq.toLowerCase()),
      isBarbell: /barbell/i.test(e.name),
    }));
  }
  return exerciseIndex;
}

/** Reset the cached exercise index (tests). */
export function _resetIndex(): void {
  exerciseIndex = null;
}

function prefer(matches: IndexedExercise[]): IndexedExercise {
  // Prefer the barbell variant, then the plainest form: shortest base, and among
  // equal bases the one with the fewest extra qualifier words (so "(Machine)"
  // beats "(Smith Machine)" when the user only said "machine").
  return (
    matches.find(m => m.isBarbell) ??
    [...matches].sort((a, b) => a.base.length - b.base.length || a.fullNorm.length - b.fullNorm.length)[0]
  );
}

// Equipment words a lifter might type → the catalog tag (or, for smith, a token
// we look for in the variant's name since smith machines are tagged 'machine').
const EQUIPMENT_SYNONYMS: Record<string, string> = {
  machine: 'machine',
  dumbbell: 'dumbbell', dumbbells: 'dumbbell', db: 'dumbbell',
  barbell: 'barbell', bb: 'barbell',
  cable: 'cable', cables: 'cable',
  kettlebell: 'kettlebell', kb: 'kettlebell',
  bodyweight: 'bodyweight', bw: 'bodyweight',
  smith: 'smith',
};

// The equipment the user asked for, if any. Smith wins over a bare "machine"
// when both appear ("squat smith machine"), as it's the more specific request.
function detectEquipment(t: string): string | null {
  const tags = t.split(' ').map(tok => EQUIPMENT_SYNONYMS[tok]).filter(Boolean);
  if (!tags.length) return null;
  return tags.includes('smith') ? 'smith' : tags[0];
}

// Drop equipment words so the core lift name is left ("db bench press" and
// "bench press machine" both reduce to "bench press").
function stripEquipment(t: string): string {
  return t.split(' ').filter(tok => !EQUIPMENT_SYNONYMS[tok]).join(' ').trim();
}

// Does this variant satisfy the requested equipment? Checks the catalog tag and
// the name words (so 'smith', which isn't a tag, still resolves via the name).
function hasEquipment(e: IndexedExercise, equip: string): boolean {
  return e.equipment.includes(equip) || e.fullNorm.split(' ').includes(equip);
}

// Base/plural/prefix match for a query against the index. Empty query matches
// nothing (an empty prefix would otherwise match everything).
function matchByBase(index: IndexedExercise[], q: string): IndexedExercise[] {
  if (!q) return [];
  let matches = index.filter(e => e.base === q);
  if (!matches.length) {
    const alt = q.endsWith('s') ? q.slice(0, -1) : `${q}s`; // simple plural tolerance
    matches = index.filter(e => e.base === alt);
  }
  if (!matches.length) {
    matches = index.filter(e => e.base.startsWith(q) || q.startsWith(e.base));
  }
  return matches;
}

// Levenshtein edit distance (two-row DP). Small catalog → cheap.
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// How many typos to tolerate for a query of this length: ~1 per 5 chars, but at
// least 1 so short names still survive a single slip. Deliberately tight — fuzzy
// is a last resort, and over-tolerance is what snaps a novel lift onto the wrong
// catalog entry instead of letting it become a custom exercise.
function fuzzyBudget(len: number): number {
  return Math.max(1, Math.floor(len * 0.2));
}

// Closest catalog base to a typo'd query, or null when nothing is clearly close.
// Bails on a tie between two distinct bases — guessing between two equally-near
// lifts is exactly the wrong-match failure we're avoiding.
function bestFuzzyBase(index: IndexedExercise[], q: string): string | null {
  if (q.length < 4) return null; // too short to fuzzy-match safely
  const bases = [...new Set(index.map(e => e.base))];
  const scored = bases
    .map(b => ({ b, d: editDistance(q, b) }))
    .sort((x, y) => x.d - y.d);
  const best = scored[0];
  if (!best || best.d > fuzzyBudget(q.length)) return null;
  if (scored[1] && scored[1].d === best.d) return null; // ambiguous — don't guess
  return best.b;
}

// Common gym shorthand → a searchable canonical name, so "bp"/"ohp"/"rdl"
// resolve instantly without an AI round-trip. Only whole-input matches apply.
const ABBREVIATIONS: Record<string, string> = {
  bp: 'bench press',
  ohp: 'overhead press',
  dl: 'deadlift',
  rdl: 'romanian deadlift',
  sldl: 'romanian deadlift',
  sq: 'squat',
  fsq: 'front squat',
  ht: 'hip thrust',
  bor: 'bent over row',
  cgbp: 'close grip bench press',
  lat: 'lat pulldown',
  pulldown: 'lat pulldown',
  bss: 'bulgarian split squat',
};

/** Resolve a typed exercise name to a known exercise id, or null if unknown. */
export function matchExerciseByName(name: string): string | null {
  let t = normalize(name);
  if (!t) return null;
  if (ABBREVIATIONS[t]) t = normalize(ABBREVIATIONS[t]); // expand whole-input shorthand
  const index = getIndex();

  // An equipment qualifier ("machine", "db", "smith"…) shouldn't be matched as
  // part of the lift name — match the core name, then use the qualifier to pick
  // the right variant. Falls back to the full string when stripping doesn't help
  // (e.g. "Cable Crossover", where "cable" is part of the actual name).
  const wantEquip = detectEquipment(t);
  let core = stripEquipment(t);
  if (ABBREVIATIONS[core]) core = normalize(ABBREVIATIONS[core]); // "ohp machine" → "overhead press"

  let matches = matchByBase(index, core);
  if (!matches.length && core !== t) matches = matchByBase(index, t);
  // Last resort: typo tolerance. Match the closest base, then fall through to the
  // same equipment disambiguation. Tight + tie-averse so it never snaps a novel
  // lift onto a near-spelled catalog entry (that should become a custom exercise).
  if (!matches.length) {
    const fuzzyBase = bestFuzzyBase(index, core) ?? (core !== t ? bestFuzzyBase(index, t) : null);
    if (fuzzyBase) matches = index.filter(e => e.base === fuzzyBase);
  }
  if (!matches.length) return null;

  if (wantEquip) {
    const byEquip = matches.filter(e => hasEquipment(e, wantEquip));
    if (byEquip.length) return prefer(byEquip).id;
    // The user named an equipment variant the catalog doesn't carry for this
    // lift. With several variants to choose from, don't silently snap to the
    // wrong equipment — let it be logged as a custom exercise instead. (A lone
    // match whose own name contains the word still resolves via the fall-through.)
    if (matches.length > 1) return null;
  }
  return prefer(matches).id;
}

function unitFrom(token: string | undefined, fallback: WeightUnit): WeightUnit {
  if (!token) return fallback;
  return /kg/i.test(token) ? 'kg' : 'lbs';
}

// One comma-separated chunk of the set region. `carry` is the last weight seen,
// so "185x5, 5, 5" repeats 185, and "x8" reuses it too.
function parseSegment(
  seg: string,
  defaultUnit: WeightUnit,
  isBodyweight: boolean,
  carry: { weight: number | null; unit: WeightUnit },
): ParsedSet[] {
  const s = seg.trim();
  if (!s) return [];

  // weight (unit?) x reps (x sets?) — global, so space-separated sets in one
  // segment ("135x8 135x8") and "135x8x3" both expand to multiple sets.
  const xMatches = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(kg|lbs?|#)?\s*[x×]\s*(\d+)(?:\s*[x×]\s*(\d+))?/gi)];
  if (xMatches.length > 0) {
    const out: ParsedSet[] = [];
    for (const xm of xMatches) {
      const weight = parseFloat(xm[1]);
      const unit = unitFrom(xm[2], defaultUnit);
      const reps = parseInt(xm[3], 10);
      const count = xm[4] ? parseInt(xm[4], 10) : 1;
      carry.weight = weight;
      carry.unit = unit;
      for (let k = 0; k < Math.min(count, 20); k++) out.push({ weight, reps, unit });
    }
    return out;
  }

  // weight (unit?) for reps
  let m = s.match(/(\d+(?:\.\d+)?)\s*(kg|lbs?|#)?\s*for\s*(\d+)/i);
  if (m) {
    const weight = parseFloat(m[1]);
    const unit = unitFrom(m[2], defaultUnit);
    carry.weight = weight;
    carry.unit = unit;
    return [{ weight, reps: parseInt(m[3], 10), unit }];
  }

  // x reps  (rep-only, reuse carried weight / bodyweight)
  m = s.match(/^[x×]\s*(\d+)$/i);
  if (m) {
    const reps = parseInt(m[1], 10);
    const weight = isBodyweight ? 0 : carry.weight ?? 0;
    return [{ weight, reps, unit: carry.unit }];
  }

  // two bare numbers: "225 5" -> weight, reps
  m = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)$/);
  if (m) {
    const weight = parseFloat(m[1]);
    carry.weight = weight;
    return [{ weight, reps: parseInt(m[2], 10), unit: carry.unit }];
  }

  // single bare number: a rep count if we have a carried weight or it's bodyweight
  m = s.match(/^(\d+)$/);
  if (m) {
    const reps = parseInt(m[1], 10);
    if (isBodyweight) return [{ weight: 0, reps, unit: carry.unit }];
    if (carry.weight != null) return [{ weight: carry.weight, reps, unit: carry.unit }];
    return []; // lone number with no context — ignore rather than invent a set
  }

  return [];
}

/** Parse a single note line into one exercise, or null if there's no exercise. */
export function parseLine(line: string, defaultUnit: WeightUnit): ParsedExercise | null {
  // Strip intensity noise so it doesn't get mistaken for set data.
  let clean = line.replace(/@\s*\d+(?:\.\d+)?/g, ' ').replace(/\brpe\s*\d+(?:\.\d+)?/gi, ' ');

  const isBodyweight = /\b(bodyweight|body\s?weight|bw)\b/i.test(clean);
  clean = clean.replace(/\b(bodyweight|body\s?weight|bw)\b/gi, ' ');

  // Name = everything before the first digit or "x<reps>" token. Keeps hyphens,
  // apostrophes and internal spaces; only set data is numeric.
  const boundary = clean.search(/\d|[x×]\s*\d/i);
  const namePart = (boundary === -1 ? clean : clean.slice(0, boundary)).trim();
  const dataPart = boundary === -1 ? '' : clean.slice(boundary);

  const name = namePart.replace(/[,\-:]+$/, '').trim();
  if (!name) return null;

  const carry = { weight: null as number | null, unit: defaultUnit };
  const sets: ParsedSet[] = [];
  for (const seg of dataPart.split(',')) {
    sets.push(...parseSegment(seg, defaultUnit, isBodyweight, carry));
  }

  // No parseable sets: bodyweight exercise with no reps gets a sensible default;
  // otherwise treat the line as not-an-exercise so it can be flagged/escalated.
  if (sets.length === 0) {
    if (isBodyweight) sets.push({ weight: 0, reps: 10, unit: defaultUnit });
    else return null;
  }

  const matchedExerciseId = matchExerciseByName(name) ?? undefined;
  return {
    name,
    matchedExerciseId,
    isCustom: !matchedExerciseId,
    sets,
  };
}

/** Parse a full note into a workout, one exercise per non-empty line. */
export function parseWorkoutTextLocal(text: string, defaultUnit: WeightUnit = 'lbs'): ParsedWorkout {
  const exercises: ParsedExercise[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const parsed = parseLine(line, defaultUnit);
    if (parsed) exercises.push(parsed);
  }
  return {
    exercises,
    confidence: exercises.length > 0 ? 0.7 : 0,
    rawText: text,
  };
}
