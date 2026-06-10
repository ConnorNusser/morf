/**
 * Split Templates
 *
 * Templates that guide AI in generating routines based on real, proven programs.
 * These provide structure and rules WITHOUT rigid exercise lists.
 * The AI has flexibility to choose exercises within the guidelines.
 *
 * Based on research of:
 * - Reddit PPL (Metallicadpa)
 * - PHUL (Brandon Campbell)
 * - PHAT (Layne Norton)
 * - GZCLP (Cody LeFever)
 * - 5/3/1 BBB (Jim Wendler)
 */

export type TrainingGoal = 'hypertrophy' | 'strength' | 'powerbuilding' | 'recomp' | 'athletic' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

// ============================================================================
// SPLIT TEMPLATE INTERFACE
// ============================================================================

export interface SplitTemplate {
  id: string;
  name: string;
  creator: string;
  daysPerWeek: number;
  goals: TrainingGoal[];
  experience: ExperienceLevel[];
  description: string;
  /** Detailed rules and structure for the AI */
  guidelines: string;
}

// ============================================================================
// 3-DAY TEMPLATES
// ============================================================================

export const FULL_BODY_STRENGTH_3DAY: SplitTemplate = {
  id: 'full_body_strength_3',
  name: 'Full Body Strength',
  creator: 'GZCLP / Starting Strength Style',
  daysPerWeek: 3,
  goals: ['strength', 'general', 'athletic'],
  experience: ['beginner', 'intermediate'],
  description: 'Classic full body approach. Heavy compounds 3x/week with rotating emphasis.',
  guidelines: `
================================================================================
FULL BODY STRENGTH (3 DAYS)
================================================================================
Reference: GZCLP, Starting Strength

SECTION 1: STRUCTURE
- 3 workouts per week (e.g., Mon/Wed/Fri)
- Each workout hits full body
- Rotate main lift emphasis: Squat → Bench → Deadlift

SECTION 2: DAY PATTERNS
Day 1 - Squat Focus:
  • Main lift: Squat variation (heavy, 3-5 sets x 3-5 reps)
  • Secondary: Horizontal push (bench, 3 sets x 6-8 reps)
  • Accessory: Horizontal pull (row, 3 sets x 8-10 reps)
  • Accessory: 1-2 isolation movements

Day 2 - Bench Focus:
  • Main lift: Bench variation (heavy, 3-5 sets x 3-5 reps)
  • Secondary: Hinge OR squat variation (3 sets x 5-8 reps)
  • Accessory: Vertical pull (pulldown/pullup, 3 sets x 8-10 reps)
  • Accessory: 1-2 isolation movements

Day 3 - Deadlift Focus:
  • Main lift: Deadlift variation (heavy, 3-5 sets x 3-5 reps)
  • Secondary: Vertical push (OHP, 3 sets x 6-8 reps)
  • Accessory: Row variation (3 sets x 8-10 reps)
  • Accessory: 1-2 isolation movements

SECTION 3: RULES
1. Main lifts are ALWAYS compound barbell movements
2. Total exercises per workout: 4-6
3. Main lift gets most volume and intensity
4. Never heavy squat and heavy deadlift on same day
5. Session duration: 45-60 minutes
`,
};

export const FULL_BODY_HYPERTROPHY_3DAY: SplitTemplate = {
  id: 'full_body_hypertrophy_3',
  name: 'Full Body Hypertrophy',
  creator: 'General Bodybuilding',
  daysPerWeek: 3,
  goals: ['hypertrophy', 'general', 'recomp'],
  experience: ['beginner', 'intermediate'],
  description: 'Full body with hypertrophy focus. Higher reps, more isolation work.',
  guidelines: `
================================================================================
FULL BODY HYPERTROPHY (3 DAYS)
================================================================================

SECTION 1: STRUCTURE
- 3 workouts per week
- Each workout hits all major muscle groups
- Higher reps, more isolation than strength variant

SECTION 2: DAY PATTERNS
Day 1 - Push Emphasis:
  • Compound push: Bench or press (4 sets x 8-12 reps)
  • Compound pull: Row variation (3 sets x 10-12 reps)
  • Compound legs: Squat variation (3 sets x 10-12 reps)
  • Isolation: 2-3 exercises x 12-15 reps

Day 2 - Pull Emphasis:
  • Compound pull: Vertical pull (4 sets x 8-12 reps)
  • Compound push: OHP variation (3 sets x 10-12 reps)
  • Compound legs: Hip hinge (3 sets x 10-12 reps)
  • Isolation: 2-3 exercises x 12-15 reps

Day 3 - Legs Emphasis:
  • Compound legs: Squat or leg press (4 sets x 8-12 reps)
  • Compound push: Incline press (3 sets x 10-12 reps)
  • Compound pull: Row variation (3 sets x 10-12 reps)
  • Isolation: 2-3 exercises x 12-15 reps

SECTION 3: RULES
1. Each workout hits chest, back, shoulders, and legs
2. Total exercises per workout: 5-7
3. Rep ranges: 8-15 for hypertrophy
4. Include at least one isolation exercise per workout
5. Session duration: 50-70 minutes
`,
};

// ============================================================================
// 4-DAY TEMPLATES
// ============================================================================

export const UPPER_LOWER_4DAY: SplitTemplate = {
  id: 'upper_lower_4',
  name: 'Upper/Lower Split',
  creator: 'PHUL by Brandon Campbell',
  daysPerWeek: 4,
  goals: ['powerbuilding', 'hypertrophy', 'strength', 'recomp', 'athletic'],
  experience: ['intermediate', 'advanced'],
  description: 'Classic upper/lower with power and hypertrophy days. Best of both worlds.',
  guidelines: `
================================================================================
UPPER/LOWER (4 DAYS) - PHUL
================================================================================
Reference: PHUL (Power Hypertrophy Upper Lower) by Brandon Campbell

SECTION 1: STRUCTURE
- 4 workouts per week (Upper/Lower/Rest/Upper/Lower/Rest/Rest)
- Days 1-2: Power focus (heavier, lower reps)
- Days 3-4: Hypertrophy focus (lighter, higher reps)

SECTION 2: DAY PATTERNS
Day 1 - Upper Power:
  • Heavy horizontal push: Bench (3-4 sets x 3-5 reps)
  • Heavy horizontal pull: Row (3-4 sets x 3-5 reps)
  • Secondary vertical push: OHP (2-3 sets x 5-8 reps)
  • Accessory vertical pull: Pulldown (3-4 sets x 6-10 reps)
  • Arms: 1-2 exercises (2-3 sets x 6-10 reps)

Day 2 - Lower Power:
  • Heavy squat: Back squat (3-4 sets x 3-5 reps)
  • Heavy hinge: Deadlift (3-4 sets x 3-5 reps)
  • Accessory quads: Leg press (3-5 sets x 10-15 reps)
  • Accessory hamstrings: Leg curl (3-4 sets x 6-10 reps)
  • Calves: 4 sets x 6-10 reps

Day 3 - Upper Hypertrophy:
  • Incline press variation (3-4 sets x 8-12 reps)
  • Fly or chest isolation (3-4 sets x 8-12 reps)
  • Row variation (3-4 sets x 8-12 reps)
  • Lateral raises (3-4 sets x 8-12 reps)
  • Arms: 2-3 exercises x 8-12 reps

Day 4 - Lower Hypertrophy:
  • Squat variation (3-4 sets x 8-12 reps)
  • RDL (3-4 sets x 8-12 reps)
  • Leg extension (3-4 sets x 10-15 reps)
  • Leg curl (3-4 sets x 10-15 reps)
  • Calves: 4 sets x 10-15 reps

SECTION 3: RULES
1. Power days: 3-5 rep range on main lifts
2. Hypertrophy days: 8-15 rep range
3. Upper days: 5-7 exercises, Lower days: 4-6 exercises
4. Squat and deadlift CAN be on same day for 4-day splits
5. Session duration: 60-75 minutes
`,
};

// ============================================================================
// 5-DAY TEMPLATES
// ============================================================================

export const PHAT_5DAY: SplitTemplate = {
  id: 'phat_5',
  name: 'PHAT',
  creator: 'Dr. Layne Norton',
  daysPerWeek: 5,
  goals: ['powerbuilding', 'hypertrophy', 'recomp'],
  experience: ['intermediate', 'advanced'],
  description: 'Power Hypertrophy Adaptive Training. 2 power days + 3 hypertrophy days.',
  guidelines: `
================================================================================
PHAT (5 DAYS)
================================================================================
Reference: Power Hypertrophy Adaptive Training by Dr. Layne Norton

SECTION 1: STRUCTURE
- 5 workouts per week
- Days 1-2: Power (upper/lower)
- Day 3: Rest
- Days 4-6: Hypertrophy (back+shoulders, chest+arms, legs)

SECTION 2: DAY PATTERNS
Day 1 - Upper Power:
  • Heavy bench: 3 sets x 3-5 reps
  • Heavy row: 3 sets x 3-5 reps
  • OHP or weighted dip: 2 sets x 6-10 reps
  • Pulldown: 2 sets x 6-10 reps
  • Arms: 1-2 exercises each (2-3 sets)

Day 2 - Lower Power:
  • Heavy squat: 3 sets x 3-5 reps
  • Heavy deadlift: 2 sets x 3-5 reps
  • Leg press: 2 sets x 6-10 reps
  • Leg curl: 2 sets x 6-10 reps
  • Calves: 3 sets x 6-10 reps

Day 3 - Back & Shoulders Hypertrophy:
  • Row: 3 sets x 8-12 reps
  • Pulldown/pullup: 3 sets x 8-12 reps
  • Seated row: 3 sets x 8-12 reps
  • Shoulder press: 3 sets x 8-12 reps
  • Lateral/rear delt: 3-4 sets x 12-20 reps

Day 4 - Chest & Arms Hypertrophy:
  • Bench variation: 3 sets x 8-12 reps
  • Incline press: 3 sets x 8-12 reps
  • Chest fly: 2 sets x 12-15 reps
  • Triceps: 2-3 exercises x 8-15 reps
  • Biceps: 2-3 exercises x 8-15 reps

Day 5 - Legs Hypertrophy:
  • Squat variation: 3 sets x 8-12 reps
  • Leg press: 3 sets x 10-15 reps
  • Leg extension: 2 sets x 12-20 reps
  • RDL: 3 sets x 8-12 reps
  • Leg curl: 2 sets x 12-15 reps
  • Calves: 4 sets x 10-15 reps

SECTION 3: RULES
1. Power days: 3-5 reps, 3-5 min rest
2. Hypertrophy days: 8-20 rep range, 60-90 sec rest
3. Squat and deadlift on same day (Lower Power)
4. Power sessions: 45-60 min, Hypertrophy: 60-75 min
`,
};

export const BRO_SPLIT_5DAY: SplitTemplate = {
  id: 'bro_split_5',
  name: 'Body Part Split',
  creator: 'Classic Bodybuilding',
  daysPerWeek: 5,
  goals: ['hypertrophy'],
  experience: ['intermediate', 'advanced'],
  description: 'Classic bodybuilding. One muscle group per day, high volume.',
  guidelines: `
================================================================================
BODY PART SPLIT (5 DAYS)
================================================================================
Reference: Classic Bodybuilding

SECTION 1: STRUCTURE
- 5 workouts per week
- Each day: 1-2 muscle groups
- High volume per muscle, trained once per week

SECTION 2: DAY PATTERNS
Day 1 - Chest:
  • Flat press: 4 sets x 8-12 reps
  • Incline press: 4 sets x 8-12 reps
  • Decline or dip: 3 sets x 10-12 reps
  • Chest fly: 3 sets x 12-15 reps

Day 2 - Back:
  • Heavy row: 4 sets x 6-10 reps
  • Vertical pull: 4 sets x 8-12 reps
  • Cable row: 3 sets x 10-12 reps
  • Pullover: 3 sets x 12-15 reps

Day 3 - Shoulders:
  • OHP: 4 sets x 8-12 reps
  • Lateral raise: 4 sets x 12-15 reps
  • Rear delt: 3 sets x 12-15 reps
  • Front raise or upright row: 3 sets x 12-15 reps

Day 4 - Legs:
  • Squat: 4 sets x 6-10 reps
  • Leg press: 4 sets x 10-15 reps
  • RDL or leg curl: 3 sets x 10-12 reps
  • Leg extension: 3 sets x 12-15 reps
  • Leg curl: 3 sets x 12-15 reps
  • Calves: 4-5 sets x 10-20 reps

Day 5 - Arms:
  • Barbell curl: 3 sets x 8-12 reps
  • Skull crushers: 3 sets x 8-12 reps
  • Hammer curl: 3 sets x 10-12 reps
  • Tricep pushdown: 3 sets x 10-12 reps
  • Isolation curls: 3 sets x 12-15 reps
  • Overhead extension: 3 sets x 12-15 reps

SECTION 3: RULES
1. Each muscle gets dedicated day with high volume
2. 4-6 exercises per muscle group
3. Rep ranges: 8-15 for most work
4. Deadlift on back OR leg day (pick one)
5. Session duration: 45-60 minutes
`,
};

// ============================================================================
// 6-DAY TEMPLATES
// ============================================================================

export const PPL_HYPERTROPHY_6DAY: SplitTemplate = {
  id: 'ppl_hypertrophy_6',
  name: 'Push/Pull/Legs',
  creator: 'Reddit PPL (Metallicadpa)',
  daysPerWeek: 6,
  goals: ['hypertrophy', 'powerbuilding', 'recomp'],
  experience: ['intermediate', 'advanced'],
  description: 'The famous Reddit PPL. Each muscle 2x/week. Strength + hypertrophy.',
  guidelines: `
================================================================================
PUSH/PULL/LEGS (6 DAYS)
================================================================================
Reference: Reddit PPL by Metallicadpa

SECTION 1: STRUCTURE
- 6 workouts per week (Push/Pull/Legs x 2)
- Each muscle trained 2x per week
- A days = strength focus, B days = hypertrophy focus

SECTION 2: DAY PATTERNS
Push A (Strength):
  • Bench: 4 sets x 5, 1 AMRAP
  • OHP: 3 sets x 8-12 reps
  • Incline DB press: 3 sets x 8-12 reps
  • Tricep pushdown + lateral raise superset: 3 sets each
  • Optional: Overhead tricep extension

Pull A (Strength):
  • Deadlift: 1 set x 5+ (AMRAP)
  • Row: 4 sets x 5, 1 AMRAP
  • Lat pulldown: 3 sets x 8-12 reps
  • Seated cable row: 3 sets x 8-12 reps
  • Face pull: 5 sets x 15-20 reps
  • Curls: 2 exercises x 4 sets

Legs A (Strength):
  • Squat: 2 sets x 5, 1 AMRAP
  • RDL: 3 sets x 8-12 reps
  • Leg press: 3 sets x 8-12 reps
  • Leg curl: 3 sets x 8-12 reps
  • Calf raise: 5 sets x 8-12 reps

Push B (Hypertrophy):
  • OHP: 4 sets x 5, 1 AMRAP
  • Bench: 3 sets x 8-12 reps
  • Incline DB press: 3 sets x 8-12 reps
  • Tricep + lateral raise superset: 3 sets each

Pull B (Hypertrophy):
  • Row: 4 sets x 5, 1 AMRAP
  • Pullup/pulldown: 3 sets x 8-12 reps
  • Seated cable row: 3 sets x 8-12 reps
  • Face pull: 5 sets x 15-20 reps
  • Curls: 2 exercises x 4 sets

Legs B (Hypertrophy):
  • Squat: 2 sets x 5, 1 AMRAP
  • RDL: 3 sets x 8-12 reps
  • Leg press: 3 sets x 8-12 reps
  • Leg curl: 3 sets x 8-12 reps
  • Calf raise: 5 sets x 8-12 reps

SECTION 3: RULES
1. Deadlift ONLY on Pull A, never on legs
2. Main lifts: 5x5 with AMRAP last set
3. Supersets for time efficiency
4. Face pulls EVERY pull day (5x15-20)
5. Session duration: 60-75 minutes
`,
};

export const PPL_STRENGTH_6DAY: SplitTemplate = {
  id: 'ppl_strength_6',
  name: 'Push/Pull/Legs (Strength)',
  creator: 'Strength-focused PPL',
  daysPerWeek: 6,
  goals: ['strength', 'powerbuilding', 'athletic'],
  experience: ['intermediate', 'advanced'],
  description: 'PPL with strength emphasis. Heavy compounds, lower rep ranges.',
  guidelines: `
================================================================================
PPL STRENGTH (6 DAYS)
================================================================================

SECTION 1: STRUCTURE
- 6 workouts per week
- Heavy compounds with lower rep ranges
- More frequency on main lifts

SECTION 2: DAY PATTERNS
Push A - Bench Focus:
  • Bench: 5 sets x 3-5 reps (heavy)
  • Close grip bench or dip: 3 sets x 6-8 reps
  • Incline press: 3 sets x 6-8 reps
  • OHP: 3 sets x 8-10 reps
  • Tricep isolation: 2-3 sets

Pull A - Deadlift Focus:
  • Deadlift: 5 sets x 3-5 reps (heavy)
  • Barbell row: 4 sets x 5-8 reps
  • Pullup/pulldown: 3 sets x 6-10 reps
  • Face pull: 3 sets x 15-20 reps
  • Bicep work: 2-3 sets

Legs A - Squat Focus:
  • Squat: 5 sets x 3-5 reps (heavy)
  • Front/pause squat: 3 sets x 5-8 reps
  • RDL: 3 sets x 6-8 reps
  • Leg press: 3 sets x 8-10 reps
  • Calves: 4 sets

Push B - OHP Focus:
  • OHP: 5 sets x 3-5 reps (heavy)
  • Bench: 3 sets x 6-8 reps
  • Incline DB: 3 sets x 8-10 reps
  • Lateral raise: 3 sets x 12-15 reps
  • Tricep isolation: 2-3 sets

Pull B - Row Focus:
  • Barbell row: 5 sets x 3-5 reps (heavy)
  • Deadlift variation: 3 sets x 5-8 reps
  • Pullup/pulldown: 3 sets x 6-10 reps
  • Face pull: 3 sets x 15-20 reps
  • Bicep work: 2-3 sets

Legs B - Squat Variation:
  • Front squat: 4 sets x 4-6 reps
  • Back squat: 3 sets x 6-8 reps
  • Hip hinge: 3 sets x 6-8 reps
  • Leg curl: 3 sets x 10-12 reps
  • Calves: 4 sets

SECTION 3: RULES
1. Main lift each day: 3-5 rep range
2. Secondary compound supports main pattern
3. Limit isolation - focus on compounds
4. 5-7 exercises max per session
5. Session duration: 60-75 minutes
6. Heavy deadlift only on Pull A
`,
};

// ============================================================================
// TEMPLATE SELECTION
// ============================================================================

export const ALL_SPLIT_TEMPLATES: SplitTemplate[] = [
  // 3-day
  FULL_BODY_STRENGTH_3DAY,
  FULL_BODY_HYPERTROPHY_3DAY,
  // 4-day
  UPPER_LOWER_4DAY,
  // 5-day
  PHAT_5DAY,
  BRO_SPLIT_5DAY,
  // 6-day
  PPL_HYPERTROPHY_6DAY,
  PPL_STRENGTH_6DAY,
];

/**
 * Select the best template based on user inputs
 *
 * Priority:
 * 1. Days (MUST match)
 * 2. Goal (prefer matching)
 * 3. Experience (prefer matching)
 */
export function selectTemplate(
  days: number,
  goal: TrainingGoal,
  experience?: ExperienceLevel
): SplitTemplate | null {
  // Filter by days (MUST match)
  const byDays = ALL_SPLIT_TEMPLATES.filter(t => t.daysPerWeek === days);

  if (byDays.length === 0) {
    // No exact match - find closest
    const closest = ALL_SPLIT_TEMPLATES.reduce((prev, curr) =>
      Math.abs(curr.daysPerWeek - days) < Math.abs(prev.daysPerWeek - days) ? curr : prev
    );
    return closest;
  }

  // Score templates
  const scored = byDays.map(template => {
    let score = 0;
    if (template.goals.includes(goal)) score += 10;
    if (experience && template.experience.includes(experience)) score += 5;
    return { template, score };
  });

  // Return highest scored
  scored.sort((a, b) => b.score - a.score);
  return scored[0].template;
}

/**
 * Get all templates for a given day count
 */
export function getTemplatesForDays(days: number): SplitTemplate[] {
  return ALL_SPLIT_TEMPLATES.filter(t => t.daysPerWeek === days);
}
