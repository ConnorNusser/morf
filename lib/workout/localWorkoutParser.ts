// Offline, forgiving workout-note tokenizer; the AI parser is reserved for ambiguous lines. Matching is name-based with an equipment default.
import type { ParsedExercise, ParsedSet, ParsedWorkout } from '@/lib/workout/workoutNoteParser';
import { getAvailableWorkouts } from '@/lib/workout/workouts';
import { WeightUnit } from '@/types';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Like normalize but KEEPS parenthetical equipment ("Overhead Press (Machine)" -> "overhead press machine") so a paren'd qualifier stays searchable as words.
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
  base: string; // equipment stripped
  fullNorm: string; // equipment kept
  aliasBases: string[]; // equipment-stripped alternate names
  equipment: string[];
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
      aliasBases: (e.aliases ?? []).map(a => normalize(a)).filter(Boolean),
      equipment: (e.equipment ?? []).map(eq => eq.toLowerCase()),
      isBarbell: /barbell/i.test(e.name),
    }));
  }
  return exerciseIndex;
}

function baseHits(e: IndexedExercise, q: string): boolean {
  return e.base === q || e.aliasBases.includes(q);
}

/** Reset the cached exercise index (tests). */
export function _resetIndex(): void {
  exerciseIndex = null;
}

function prefer(matches: IndexedExercise[]): IndexedExercise {
  // Prefer barbell, then plainest form (shortest base, fewest qualifier words) so "(Machine)" beats "(Smith Machine)" for a bare "machine".
  return (
    matches.find(m => m.isBarbell) ??
    [...matches].sort((a, b) => a.base.length - b.base.length || a.fullNorm.length - b.fullNorm.length)[0]
  );
}

// Equipment words → catalog tag. 'smith' isn't a tag (smith machines are tagged 'machine'); we match it against the variant's name instead.
const EQUIPMENT_SYNONYMS: Record<string, string> = {
  machine: 'machine',
  dumbbell: 'dumbbell', dumbbells: 'dumbbell', db: 'dumbbell',
  barbell: 'barbell', bb: 'barbell',
  cable: 'cable', cables: 'cable',
  kettlebell: 'kettlebell', kb: 'kettlebell',
  bodyweight: 'bodyweight', bw: 'bodyweight',
  smith: 'smith',
};

// Requested equipment, if any. Smith wins over a bare "machine" when both appear (more specific).
function detectEquipment(t: string): string | null {
  const tags = t.split(' ').map(tok => EQUIPMENT_SYNONYMS[tok]).filter(Boolean);
  if (!tags.length) return null;
  return tags.includes('smith') ? 'smith' : tags[0];
}

function stripEquipment(t: string): string {
  return t.split(' ').filter(tok => !EQUIPMENT_SYNONYMS[tok]).join(' ').trim();
}

// Checks the catalog tag and the name words, so 'smith' (not a tag) still resolves via the name.
function hasEquipment(e: IndexedExercise, equip: string): boolean {
  return e.equipment.includes(equip) || e.fullNorm.split(' ').includes(equip);
}

// Base/plural/prefix match. Empty query matches nothing (an empty prefix would match everything).
function matchByBase(index: IndexedExercise[], q: string): IndexedExercise[] {
  if (!q) return [];
  let matches = index.filter(e => baseHits(e, q));
  if (!matches.length) {
    const alt = q.endsWith('s') ? q.slice(0, -1) : `${q}s`;
    matches = index.filter(e => baseHits(e, alt));
  }
  if (!matches.length) {
    const pfx = (b: string) => b.startsWith(q) || q.startsWith(b);
    matches = index.filter(e => pfx(e.base) || e.aliasBases.some(pfx));
  }
  return matches;
}

// Levenshtein edit distance (two-row DP).
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

// Typo budget: ~1 per 5 chars, min 1. Deliberately tight — over-tolerance snaps a novel lift onto the wrong catalog entry instead of a custom exercise.
function fuzzyBudget(len: number): number {
  return Math.max(1, Math.floor(len * 0.2));
}

// Closest catalog base to a typo'd query, or null. Bails on a tie between distinct bases — guessing between equally-near lifts is the wrong-match failure we avoid.
function bestFuzzyBase(index: IndexedExercise[], q: string): string | null {
  if (q.length < 4) return null; // too short to fuzzy-match safely
  const bases = [...new Set(index.flatMap(e => [e.base, ...e.aliasBases]))];
  const scored = bases
    .map(b => ({ b, d: editDistance(q, b) }))
    .sort((x, y) => x.d - y.d);
  const best = scored[0];
  if (!best || best.d > fuzzyBudget(q.length)) return null;
  if (scored[1] && scored[1].d === best.d) return null; // ambiguous — don't guess
  return best.b;
}

// Gym shorthand → canonical name. Whole-input matches only.
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
  if (ABBREVIATIONS[t]) t = normalize(ABBREVIATIONS[t]);
  const index = getIndex();

  // Match the core lift name, then use the equipment qualifier to pick the variant. Detect from the paren-keeping form so "RDL (Dumbbells)" resolves like "rdl dumbbells".
  const wantEquip = detectEquipment(normalizeKeepEquip(name)) ?? detectEquipment(t);
  let core = stripEquipment(t);
  if (ABBREVIATIONS[core]) core = normalize(ABBREVIATIONS[core]);

  let matches = matchByBase(index, core);
  if (!matches.length && core !== t) matches = matchByBase(index, t);
  // Last resort: typo tolerance, then the same equipment disambiguation.
  if (!matches.length) {
    const fuzzyBase = bestFuzzyBase(index, core) ?? (core !== t ? bestFuzzyBase(index, t) : null);
    if (fuzzyBase) matches = index.filter(e => baseHits(e, fuzzyBase));
  }
  if (!matches.length) return null;

  if (wantEquip) {
    const byEquip = matches.filter(e => hasEquipment(e, wantEquip));
    if (byEquip.length) return prefer(byEquip).id;
    // Requested equipment variant the catalog lacks: with several variants, don't snap to the wrong one — log as custom. (A lone match resolves via the fall-through.)
    if (matches.length > 1) return null;
  }
  return prefer(matches).id;
}

function unitFrom(token: string | undefined, fallback: WeightUnit): WeightUnit {
  if (!token) return fallback;
  return /kg/i.test(token) ? 'kg' : 'lbs';
}

// One comma-separated chunk of the set region. `carry` is the last weight seen, so "185x5, 5, 5" repeats 185.
function parseSegment(
  seg: string,
  defaultUnit: WeightUnit,
  isBodyweight: boolean,
  carry: { weight: number | null; unit: WeightUnit },
): ParsedSet[] {
  const s = seg.trim();
  if (!s) return [];

  // weight (unit?) x reps (x sets?) — global, so "135x8 135x8" and "135x8x3" both expand to multiple sets.
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

  let m = s.match(/(\d+(?:\.\d+)?)\s*(kg|lbs?|#)?\s*for\s*(\d+)/i);
  if (m) {
    const weight = parseFloat(m[1]);
    const unit = unitFrom(m[2], defaultUnit);
    carry.weight = weight;
    carry.unit = unit;
    return [{ weight, reps: parseInt(m[3], 10), unit }];
  }

  // rep-only: reuse carried weight / bodyweight
  m = s.match(/^[x×]\s*(\d+)$/i);
  if (m) {
    const reps = parseInt(m[1], 10);
    const weight = isBodyweight ? 0 : carry.weight ?? 0;
    return [{ weight, reps, unit: carry.unit }];
  }

  // "225 5" -> weight, reps
  m = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)$/);
  if (m) {
    const weight = parseFloat(m[1]);
    carry.weight = weight;
    return [{ weight, reps: parseInt(m[2], 10), unit: carry.unit }];
  }

  // bare number: a rep count if there's a carried weight or it's bodyweight
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
  // Strip intensity noise so it isn't mistaken for set data.
  let clean = line.replace(/@\s*\d+(?:\.\d+)?/g, ' ').replace(/\brpe\s*\d+(?:\.\d+)?/gi, ' ');

  const isBodyweight = /\b(bodyweight|body\s?weight|bw)\b/i.test(clean);
  clean = clean.replace(/\b(bodyweight|body\s?weight|bw)\b/gi, ' ');

  // Name = everything before the first digit or "x<reps>" token (only set data is numeric).
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

  // No parseable sets: bodyweight gets a default; otherwise treat the line as not-an-exercise.
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
