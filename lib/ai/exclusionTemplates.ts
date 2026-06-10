/**
 * Exclusion Templates
 *
 * Specialized templates for when users want to skip specific body parts.
 * These are complete programs designed WITHOUT certain muscle groups,
 * not retrofitted versions of standard splits.
 */

export type ExclusionType = 'no_legs' | 'no_chest' | 'no_back' | 'no_shoulders' | 'no_arms';

export interface ExclusionTemplate {
  id: string;
  name: string;
  exclusionType: ExclusionType;
  daysPerWeek: number;
  description: string;
  guidelines: string;
}

// ============================================================================
// NO LEGS TEMPLATES (Upper Body Only)
// ============================================================================

export const UPPER_BODY_3DAY: ExclusionTemplate = {
  id: 'upper_body_3',
  name: 'Upper Body 3-Day',
  exclusionType: 'no_legs',
  daysPerWeek: 3,
  description: 'Upper body focus with balanced push/pull work across 3 days.',
  guidelines: `
================================================================================
UPPER BODY ONLY (3 DAYS)
================================================================================
NO leg exercises. Focus entirely on upper body development.

SECTION 1: STRUCTURE
- 3 workouts per week
- Alternate push and pull emphasis
- Each muscle hit ~2x per week

SECTION 2: DAY PATTERNS
Day 1 - Push Focus:
  • Horizontal push: Bench variation (4 sets x 6-10 reps)
  • Vertical push: OHP variation (3 sets x 8-12 reps)
  • Chest isolation: Fly variation (3 sets x 10-15 reps)
  • Lateral delts: Lateral raises (3 sets x 12-15 reps)
  • Triceps: Pushdown or extension (3 sets x 10-15 reps)

Day 2 - Pull Focus:
  • Horizontal pull: Row variation (4 sets x 6-10 reps)
  • Vertical pull: Pulldown/pullup (3 sets x 8-12 reps)
  • Rear delts: Face pulls or reverse fly (3 sets x 12-15 reps)
  • Biceps: Curl variation (3 sets x 10-12 reps)
  • Biceps: Second curl variation (3 sets x 10-12 reps)

Day 3 - Upper Mix:
  • Heavy compound: Bench or OHP (4 sets x 5-8 reps)
  • Opposite pattern: Row or pulldown (4 sets x 6-10 reps)
  • Shoulders: Lateral or rear delt work (3 sets x 12-15 reps)
  • Arms superset: Biceps + Triceps (3 sets each)

SECTION 3: RULES
1. NO squats, deadlifts, leg press, lunges, or any leg work
2. NO hip hinges (RDL, good mornings) - these are leg exercises
3. 5-6 exercises per workout
4. Session duration: 45-60 minutes
`,
};

export const UPPER_BODY_4DAY: ExclusionTemplate = {
  id: 'upper_body_4',
  name: 'Upper Body 4-Day',
  exclusionType: 'no_legs',
  daysPerWeek: 4,
  description: 'Upper body split with dedicated push, pull, and mixed days.',
  guidelines: `
================================================================================
UPPER BODY ONLY (4 DAYS)
================================================================================
NO leg exercises. Optimized upper body development.

SECTION 1: STRUCTURE
- 4 workouts per week
- Push/Pull/Push/Pull or Push/Pull/Shoulders/Arms
- High frequency on all upper body muscles

SECTION 2: DAY PATTERNS
Day 1 - Chest & Triceps:
  • Flat bench: 4 sets x 6-8 reps
  • Incline press: 3 sets x 8-12 reps
  • Chest fly: 3 sets x 10-15 reps
  • Close grip bench or dips: 3 sets x 8-12 reps
  • Tricep pushdown: 3 sets x 10-15 reps
  • Overhead extension: 3 sets x 10-15 reps

Day 2 - Back & Biceps:
  • Barbell/dumbbell row: 4 sets x 6-8 reps
  • Lat pulldown or pullups: 3 sets x 8-12 reps
  • Cable row: 3 sets x 10-12 reps
  • Face pulls: 3 sets x 15-20 reps
  • Barbell curl: 3 sets x 8-12 reps
  • Hammer curl: 3 sets x 10-12 reps

Day 3 - Shoulders & Chest:
  • Overhead press: 4 sets x 6-8 reps
  • Incline dumbbell press: 3 sets x 10-12 reps
  • Lateral raise: 4 sets x 12-15 reps
  • Rear delt fly: 3 sets x 12-15 reps
  • Cable fly: 3 sets x 12-15 reps

Day 4 - Back & Arms:
  • Weighted pullups or pulldown: 4 sets x 6-10 reps
  • Chest-supported row: 3 sets x 10-12 reps
  • Straight arm pushdown: 3 sets x 12-15 reps
  • Preacher curl: 3 sets x 10-12 reps
  • Skull crushers: 3 sets x 10-12 reps
  • Cable curl + pushdown superset: 3 sets each

SECTION 3: RULES
1. NO squats, deadlifts, leg press, lunges, or any leg work
2. NO hip hinges - these work legs
3. 5-7 exercises per workout
4. Session duration: 50-70 minutes
`,
};

export const UPPER_BODY_5DAY: ExclusionTemplate = {
  id: 'upper_body_5',
  name: 'Upper Body 5-Day',
  exclusionType: 'no_legs',
  daysPerWeek: 5,
  description: 'High volume upper body split hitting each muscle 2-3x per week.',
  guidelines: `
================================================================================
UPPER BODY ONLY (5 DAYS)
================================================================================
NO leg exercises. Maximum upper body volume and frequency.

SECTION 1: STRUCTURE
- 5 workouts per week
- Body part split for upper body
- Each muscle group 2-3x per week

SECTION 2: DAY PATTERNS
Day 1 - Chest:
  • Flat bench: 4 sets x 6-8 reps
  • Incline dumbbell: 4 sets x 8-12 reps
  • Decline or dips: 3 sets x 8-12 reps
  • Cable fly: 3 sets x 12-15 reps
  • Pec deck or fly: 3 sets x 12-15 reps

Day 2 - Back:
  • Barbell row: 4 sets x 6-8 reps
  • Weighted pullup or pulldown: 4 sets x 8-10 reps
  • Cable row: 3 sets x 10-12 reps
  • Single arm dumbbell row: 3 sets x 10-12 reps
  • Straight arm pushdown: 3 sets x 12-15 reps

Day 3 - Shoulders:
  • Overhead press: 4 sets x 6-8 reps
  • Dumbbell shoulder press: 3 sets x 10-12 reps
  • Lateral raise: 4 sets x 12-15 reps
  • Rear delt fly: 4 sets x 12-15 reps
  • Face pulls: 3 sets x 15-20 reps

Day 4 - Chest & Back:
  • Incline bench: 4 sets x 8-10 reps
  • Pulldown or pullups: 4 sets x 8-10 reps
  • Cable fly: 3 sets x 12-15 reps
  • Seated row: 3 sets x 10-12 reps
  • Push-ups or dips: 3 sets to near failure

Day 5 - Arms:
  • Close grip bench: 4 sets x 8-10 reps
  • Barbell curl: 4 sets x 8-10 reps
  • Skull crushers: 3 sets x 10-12 reps
  • Incline curl: 3 sets x 10-12 reps
  • Tricep pushdown: 3 sets x 12-15 reps
  • Hammer curl: 3 sets x 12-15 reps
  • Overhead extension: 3 sets x 12-15 reps

SECTION 3: RULES
1. NO squats, deadlifts, leg press, lunges, or any leg work
2. 5-7 exercises per workout
3. Session duration: 50-70 minutes
`,
};

export const UPPER_BODY_6DAY: ExclusionTemplate = {
  id: 'upper_body_6',
  name: 'Upper Body 6-Day PPL',
  exclusionType: 'no_legs',
  daysPerWeek: 6,
  description: 'Push/Pull split repeated 3x per week. High frequency upper body.',
  guidelines: `
================================================================================
UPPER BODY ONLY (6 DAYS) - PUSH/PULL
================================================================================
NO leg exercises. Push/Pull split done 3x each per week.

SECTION 1: STRUCTURE
- 6 workouts per week
- Push A / Pull A / Push B / Pull B / Push C / Pull C
- Or: Push / Pull repeated 3x with variation
- Maximum frequency on upper body

SECTION 2: DAY PATTERNS
Push A (Chest Focus):
  • Flat bench: 4 sets x 5-6 reps (heavy)
  • Incline dumbbell: 3 sets x 8-12 reps
  • OHP: 3 sets x 8-10 reps
  • Lateral raise: 3 sets x 12-15 reps
  • Tricep pushdown: 3 sets x 10-15 reps

Pull A (Row Focus):
  • Barbell row: 4 sets x 5-6 reps (heavy)
  • Lat pulldown: 3 sets x 8-12 reps
  • Cable row: 3 sets x 10-12 reps
  • Face pulls: 4 sets x 15-20 reps
  • Barbell curl: 3 sets x 8-12 reps

Push B (Shoulder Focus):
  • OHP: 4 sets x 5-6 reps (heavy)
  • Incline bench: 3 sets x 8-12 reps
  • Lateral raise: 4 sets x 12-15 reps
  • Chest fly: 3 sets x 12-15 reps
  • Overhead extension: 3 sets x 10-15 reps

Pull B (Pulldown Focus):
  • Weighted pullups/pulldown: 4 sets x 6-8 reps
  • Chest-supported row: 3 sets x 8-12 reps
  • Single arm row: 3 sets x 10-12 reps
  • Rear delt fly: 3 sets x 12-15 reps
  • Hammer curl: 3 sets x 10-12 reps

Push C (Volume):
  • Dumbbell bench: 4 sets x 8-12 reps
  • Arnold press: 3 sets x 10-12 reps
  • Cable fly: 3 sets x 12-15 reps
  • Lateral raise: 3 sets x 12-15 reps
  • Dips or close grip bench: 3 sets x 10-12 reps

Pull C (Volume):
  • Cable row: 4 sets x 10-12 reps
  • Pulldown (wide grip): 3 sets x 10-12 reps
  • Dumbbell row: 3 sets x 10-12 reps
  • Face pulls: 3 sets x 15-20 reps
  • Incline curl: 3 sets x 12-15 reps

SECTION 3: RULES
1. NO squats, deadlifts, leg press, lunges, or any leg work
2. 5-6 exercises per workout
3. Session duration: 45-60 minutes
4. Face pulls EVERY pull day for shoulder health
`,
};

// ============================================================================
// TEMPLATE SELECTION
// ============================================================================

export const ALL_EXCLUSION_TEMPLATES: ExclusionTemplate[] = [
  UPPER_BODY_3DAY,
  UPPER_BODY_4DAY,
  UPPER_BODY_5DAY,
  UPPER_BODY_6DAY,
];

/**
 * Get the appropriate exclusion template based on ignored muscles and days
 */
export function getExclusionTemplate(
  ignoredMuscles: string[],
  days: number
): ExclusionTemplate | null {
  const ignored = ignoredMuscles.map(m => m.toLowerCase());

  // Check if legs are being skipped
  if (ignored.includes('legs')) {
    const templates = ALL_EXCLUSION_TEMPLATES.filter(t => t.exclusionType === 'no_legs');

    // Find exact match or closest
    const exact = templates.find(t => t.daysPerWeek === days);
    if (exact) return exact;

    // Find closest
    return templates.reduce((prev, curr) =>
      Math.abs(curr.daysPerWeek - days) < Math.abs(prev.daysPerWeek - days) ? curr : prev
    );
  }

  // For other exclusions, return null (use modified standard templates)
  // Could add more specialized templates here in the future
  return null;
}

/**
 * Check if we should use an exclusion template instead of standard templates
 */
export function shouldUseExclusionTemplate(ignoredMuscles?: string[]): boolean {
  if (!ignoredMuscles || ignoredMuscles.length === 0) return false;

  const ignored = ignoredMuscles.map(m => m.toLowerCase());

  // Currently only have specialized templates for legs
  // Legs is a major body part that fundamentally changes program structure
  return ignored.includes('legs');
}
