import { calculateRoutine, getRoutineAnchor } from '@/lib/workout/progressiveOverload';
import { updateExerciseRecords } from '@/lib/workout/progression';
import { addWarmupSet, buildDraft, draftToRoutineExercises, routineDiffersFromDraft, removeSet } from '@/lib/workout/workoutDraft';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import type { ParsedWorkout } from '@/lib/workout/workoutTextParser';
import type { CalculatedRoutine, ExerciseRecord, LoggedWorkout, Routine, RoutineExercise } from '@/types';

const BENCH = 'bench-press-barbell';

const day = (id: string, name: string, reps: number, exerciseId = BENCH): Routine =>
  ({
    id,
    name,
    createdAt: new Date('2026-01-01'),
    exercises: [
      { exerciseId, exerciseName: 'Bench Press (Barbell)', sets: [{ reps }, { reps }, { reps }] },
    ],
  }) as Routine;

const session = (
  routineId: string | undefined,
  sets: [number, number][],
  daysAgo: number,
  exerciseId = BENCH,
): LoggedWorkout =>
  ({
    id: `w_${routineId ?? 'freestyle'}_${daysAgo}`,
    createdAt: new Date(Date.UTC(2026, 5, 30 - daysAgo)),
    routineId,
    exercises: [
      {
        id: exerciseId,
        completedSets: sets.map(([weight, reps], i) => ({
          setNumber: i + 1,
          weight,
          reps,
          unit: 'lbs' as const,
          completed: true,
        })),
      },
    ],
  }) as LoggedWorkout;

const record = (weight: number, reps: number): ExerciseRecord => ({
  exerciseId: BENCH,
  isMainLift: true,
  weight,
  reps,
  unit: 'lbs',
  updatedAt: new Date('2026-06-29'),
  bestE1RMLbs: OneRMCalculator.estimate(weight, reps),
});

const target = (calc: CalculatedRoutine) => ({
  weight: calc.exercises[0].workingWeight,
  reps: calc.exercises[0].sets.find(s => !s.isWarmup)?.reps ?? 0,
});

describe('per-routine anchoring', () => {
  it('anchors each routine to its own last session, not the global record', () => {
    const heavy = day('heavy', 'Heavy 3×5', 5);
    const history = [session('heavy', [[225, 5], [225, 5], [225, 5]], 3)];
    // Global record has since been overwritten by lighter work elsewhere.
    const records = { [BENCH]: record(135, 20) };

    const t = target(calculateRoutine(heavy, records, 'lbs', history));
    expect(t.weight).toBe(225);
    expect(t.reps).toBe(6); // hit the floor last time → chase one more rep
  });

  it('a freestyle session cannot move a routine target', () => {
    const heavy = day('heavy', 'Heavy 3×5', 5);
    const history = [
      session('heavy', [[225, 5], [225, 5], [225, 5]], 3),
      session(undefined, [[95, 20], [95, 20]], 1), // burnout day, no routineId
    ];
    let records: Record<string, ExerciseRecord> = { [BENCH]: record(225, 5) };
    records = updateExerciseRecords(records, [
      { id: BENCH, completedSets: [{ weight: 95, reps: 20, unit: 'lbs', completed: true }, { weight: 95, reps: 20, unit: 'lbs', completed: true }] },
    ], new Date('2026-06-29'));

    const t = target(calculateRoutine(heavy, records, 'lbs', history));
    expect(t.weight).toBe(225);
  });

  it('getRoutineAnchor reads the most recent session of that routine only', () => {
    const history = [
      session('volume', [[180, 12], [180, 12]], 1),
      session('heavy', [[220, 5], [220, 5]], 2),
      session('heavy', [[215, 5], [215, 5]], 9),
      session(undefined, [[315, 1]], 0),
    ];
    expect(getRoutineAnchor('heavy', BENCH, history)).toMatchObject({ weight: 220, reps: 5 });
    expect(getRoutineAnchor('volume', BENCH, history)).toMatchObject({ weight: 180, reps: 12 });
    expect(getRoutineAnchor('new-day', BENCH, history)).toBeNull();
  });
});

describe('seeding a slot with no history of its own', () => {
  it('rep-translates the current working set when ranges are far apart', () => {
    const volume = day('volume', 'Volume 3×12', 12);
    const calc = calculateRoutine(volume, { [BENCH]: record(225, 5) }, 'lbs', []);
    const ex = calc.exercises[0];

    // Epley-ratio equivalent of 225×5 at 12 reps, grid-floored (bench inc = 5).
    const equivalent = 225 * (1 + 5 / 30) / (1 + 12 / 30);
    const expected = Math.max(5, Math.floor(equivalent / 5) * 5);
    expect(ex.workingWeight).toBe(expected);
    expect(ex.workingWeight).toBeLessThan(200); // far below the 5-rep load
    expect(ex.workingWeight).toBeGreaterThan(150); // but a real working weight
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(12); // prescribes the slot's floor
    expect(ex.progression).toBe('maintain'); // a seed to validate, not a move
  });

  it('uses the record weight directly when its reps are within the slot range — but HOLDS', () => {
    const push = day('push', 'Push 3×8', 8);
    const calc = calculateRoutine(push, { [BENCH]: record(155, 8) }, 'lbs', []);
    expect(target(calc)).toEqual({ weight: 155, reps: 8 });
    expect(calc.exercises[0].progression).toBe('maintain');
  });

  it('a seed never earns an increase off another day\'s work', () => {
    // Record topped out at 200×10 elsewhere; a brand-new 3×8 slot must open AT
    // 200 as a hold — not 205 "increase" for a session this routine never did.
    const push = day('push', 'Push 3×8', 8);
    const calc = calculateRoutine(push, { [BENCH]: record(200, 10) }, 'lbs', []);
    expect(target(calc)).toEqual({ weight: 200, reps: 8 });
    expect(calc.exercises[0].progression).toBe('maintain');
  });

  it('cold-starts blank with no record at all', () => {
    const push = day('push', 'Push 3×8', 8);
    expect(target(calculateRoutine(push, {}, 'lbs', [])).weight).toBe(0);
  });
});

describe('anchor robustness (audit regressions)', () => {
  const heavy = day('heavy', 'Heavy 3×5', 5);

  it('a cut-short session (ramped warmups + one work set) does not move the anchor', () => {
    const history = [
      session('heavy', [[225, 5], [225, 5], [225, 5]], 5), // full session
      session('heavy', [[115, 5], [135, 5], [225, 5]], 1), // cut short: 2 warmups + 1 work set, nothing repeated
    ];
    const t = target(calculateRoutine(heavy, { [BENCH]: record(225, 5) }, 'lbs', history));
    expect(t.weight).toBe(225); // anchored to the full session, not 135
  });

  it('top singles logged after the work sets read as a test, not a miss', () => {
    const history = [session('heavy', [[225, 5], [225, 5], [225, 5], [245, 1], [245, 1]], 1)];
    const calc = calculateRoutine(heavy, { [BENCH]: record(225, 5) }, 'lbs', history);
    expect(target(calc)).toEqual({ weight: 225, reps: 6 }); // 3 sets at 225 outvote 2 singles
    expect(calc.exercises[0].progression).toBe('increase');
  });

  it('a lone checked set neither ratchets nor deloads — the anchor looks further back', () => {
    const history = [
      session('heavy', [[225, 5], [225, 5], [225, 5]], 5),
      session('heavy', [[225, 7]], 1), // only one set checked, at ceiling reps
    ];
    const t = target(calculateRoutine(heavy, { [BENCH]: record(225, 5) }, 'lbs', history));
    expect(t).toEqual({ weight: 225, reps: 6 }); // not 230 off a single set
  });

  it('the same exercise in two slots anchors each slot to its own work', () => {
    const doubled: Routine = {
      ...heavy,
      exercises: [
        { exerciseId: BENCH, exerciseName: 'Bench Press (Barbell)', sets: [{ reps: 5 }, { reps: 5 }, { reps: 5 }] },
        { exerciseId: BENCH, exerciseName: 'Bench Press (Barbell)', sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }] },
      ],
    } as Routine;
    const w: LoggedWorkout = {
      ...session('heavy', [[225, 5], [225, 5], [225, 5]], 1),
      exercises: [
        session('heavy', [[225, 5], [225, 5], [225, 5]], 1).exercises[0],
        session('heavy', [[150, 12], [150, 12], [150, 12]], 1).exercises[0],
      ],
    } as LoggedWorkout;
    const calc = calculateRoutine(doubled, { [BENCH]: record(225, 5) }, 'lbs', [w]);
    expect(calc.exercises[0].workingWeight).toBe(225); // heavy slot: its own 225
    expect(calc.exercises[1].workingWeight).toBe(150); // backoff slot: its own 150, no phantom deload
    expect(calc.exercises[1].progression).toBe('increase'); // 150×12 → add-rep
  });

  it('editing a routine\'s reps re-expresses the old anchor instead of misreading it', () => {
    const history = [session('heavy', [[200, 5], [200, 5], [200, 5]], 1)];
    // Floor edited 5 → 12: not a catastrophic miss — translate and hold.
    const volumeized = day('heavy', 'Heavy (now 3×12)', 12);
    const down = calculateRoutine(volumeized, { [BENCH]: record(200, 5) }, 'lbs', history);
    expect(down.exercises[0].progression).toBe('maintain');
    const expectedDown = Math.max(5, Math.floor((200 * (1 + 5 / 30) / (1 + 12 / 30)) / 5) * 5);
    expect(down.exercises[0].workingWeight).toBe(expectedDown);

    // Floor edited 12 → 5: not a top-out — translate up and hold.
    const historyVol = [session('heavy', [[100, 12], [100, 12], [100, 12]], 1)];
    const strengthized = day('heavy', 'Heavy (now 3×5)', 5);
    const up = calculateRoutine(strengthized, { [BENCH]: record(100, 12) }, 'lbs', historyVol);
    expect(up.exercises[0].progression).toBe('maintain');
    expect(up.exercises[0].workingWeight).toBeGreaterThan(100); // translated up, not +one increment
  });

  it('an anchor much older than a fresher record reseeds instead of prescribing ancient peak', () => {
    // Last heavy session over a year ago at 225; global record since refreshed
    // at 135×10 by recent light work.
    const old = { ...session('heavy', [[225, 5], [225, 5], [225, 5]], 0), createdAt: new Date('2025-01-05') } as LoggedWorkout;
    const freshRecord = { ...record(135, 10), updatedAt: new Date('2026-07-01') };
    const calc = calculateRoutine(heavy, { [BENCH]: freshRecord }, 'lbs', [old]);
    expect(calc.exercises[0].workingWeight).toBeLessThan(200); // reseeded from 135×10, not 225+
    expect(calc.exercises[0].progression).toBe('maintain');
  });

  it('recorded roles beat the heuristic: flagged warmups can never win the vote', () => {
    // Three identical-weight warmups + two work sets — the unlabeled heuristic
    // would pick 135 (most sets); recorded flags make it unambiguous.
    const w = session('heavy', [[135, 5], [135, 5], [135, 5], [225, 5], [225, 5]], 1);
    w.exercises[0].completedSets.forEach((s, i) => { s.isWarmup = i < 3; });
    const t = target(calculateRoutine(heavy, { [BENCH]: record(225, 5) }, 'lbs', [w]));
    expect(t).toEqual({ weight: 225, reps: 6 });
  });

  it('a role-recorded pyramid does not freeze — heaviest known work set anchors', () => {
    // Nothing repeated, but every set is labeled work: trust the label.
    const w = session('heavy', [[185, 5], [205, 5], [225, 5]], 1);
    w.exercises[0].completedSets.forEach(s => { s.isWarmup = false; });
    const t = target(calculateRoutine(heavy, { [BENCH]: record(225, 5) }, 'lbs', [w]));
    expect(t).toEqual({ weight: 225, reps: 6 });
  });

  it('prescribed warmups ramp — no two warmups share a weight', () => {
    const withWarmups: Routine = {
      ...heavy,
      exercises: [{
        exerciseId: BENCH,
        exerciseName: 'Bench Press (Barbell)',
        sets: [{ reps: 5, isWarmup: true }, { reps: 5, isWarmup: true }, { reps: 5 }, { reps: 5 }, { reps: 5 }],
      }],
    } as Routine;
    const history = [session('heavy', [[200, 5], [200, 5], [200, 5]], 1)];
    const calc = calculateRoutine(withWarmups, { [BENCH]: record(200, 5) }, 'lbs', history);
    const warmupWeights = calc.exercises[0].sets.filter(s => s.isWarmup).map(s => s.targetWeight);
    expect(new Set(warmupWeights).size).toBe(warmupWeights.length);
  });
});

describe('rep-translation monotonicity', () => {
  const CURL = 'bicep-curl-barbell'; // isolation → 2.5 lb increment

  it('massively overshooting reps can never prescribe LESS than the bar you lifted', () => {
    // 3×12 curls at 10 lbs, performed 10 × 20/18/20: the damped e1RM estimate
    // minus the safety increment landed at 7.5 — below the performed weight.
    const curls = day('curl', 'Curls 3×12', 12, CURL);
    const w = session('curl', [[10, 20], [10, 18], [10, 20]], 1, CURL);
    const rec: ExerciseRecord = { ...record(10, 20), exerciseId: CURL };
    const ex = calculateRoutine(curls, { [CURL]: rec }, 'lbs', [w]).exercises[0];
    expect(ex.workingWeight).toBeGreaterThanOrEqual(10); // never below the bar
    expect(ex.workingWeight).toBe(10);
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(12);
    expect(ex.progression).toBe('maintain');
  });

  it('translating toward MORE reps can never prescribe above the performed weight', () => {
    // 225 triples against a 3×12 day: estimate lands well under 225 and stays there.
    const volume = day('vol', 'Bench 3×12', 12);
    const history = [session('vol', [[225, 3], [225, 3], [225, 3]], 1)];
    const ex = calculateRoutine(volume, { [BENCH]: record(225, 3) }, 'lbs', history).exercises[0];
    expect(ex.workingWeight).toBeLessThanOrEqual(225);
    expect(ex.workingWeight).toBeGreaterThan(100); // still a real estimate, not a floor
  });
});

describe('bodyweight progression', () => {
  const PULLUP = 'pull-up-bodyweight';
  const pullDay = day('pull', 'Pull-ups 3×8', 8, PULLUP);

  it('hitting the prescribed reps climbs the rep target (no ceiling)', () => {
    const history = [session('pull', [[0, 8], [0, 8], [0, 8]], 1, PULLUP)];
    const ex = calculateRoutine(pullDay, {}, 'lbs', history).exercises[0];
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(9);
    expect(ex.workingWeight).toBe(0);
    expect(ex.progression).toBe('increase');

    // Far past the floor: still reps+1, never rep-translated.
    const deep = [session('pull', [[0, 20], [0, 20], [0, 19]], 1, PULLUP)];
    const ex2 = calculateRoutine(pullDay, {}, 'lbs', deep).exercises[0];
    expect(ex2.sets.find(s => !s.isWarmup)?.reps).toBe(21);
    expect(ex2.workingWeight).toBe(0);
  });

  it('a real miss drops the rep target to what was performed', () => {
    const history = [session('pull', [[0, 5], [0, 5], [0, 4]], 1, PULLUP)];
    const ex = calculateRoutine(pullDay, {}, 'lbs', history).exercises[0];
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(5);
    expect(ex.progression).toBe('decrease');
  });

  it('assigning weight switches to normal load progression', () => {
    // Weighted pull-ups: loaded sets outvote bodyweight burnout sets.
    const history = [session('pull', [[25, 8], [25, 8], [25, 8], [0, 12]], 1, PULLUP)];
    const ex = calculateRoutine(pullDay, {}, 'lbs', history).exercises[0];
    expect(ex.workingWeight).toBe(25); // anchored to the loaded work, not the burnout
  });

  it('a bodyweight record seeds a new slot at bodyweight, not one increment', () => {
    const rec: ExerciseRecord = { ...record(0, 12), exerciseId: PULLUP, bestE1RMLbs: 0 };
    const ex = calculateRoutine(pullDay, { [PULLUP]: rec }, 'lbs', []).exercises[0];
    expect(ex.workingWeight).toBe(0); // not 2.5 lbs
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(8);
    expect(ex.progression).toBe('maintain');
  });
});

describe('repeated overshoots count in full', () => {
  it("40-lb rows at 11/11/31/31 against an 11-rep slot jump, not +1 rep", () => {
    // The 11s were the too-low target being followed; the 31s are the signal.
    const rows = day('row', 'Rows 4×11', 11, 'row-barbell');
    rows.exercises[0].sets = [{ reps: 11 }, { reps: 11 }, { reps: 11 }, { reps: 11 }];
    const history = [session('row', [[40, 11], [40, 11], [40, 31], [40, 31]], 1, 'row-barbell')];
    const rec: ExerciseRecord = { ...record(40, 11), exerciseId: 'row-barbell' };
    const ex = calculateRoutine(rows, { 'row-barbell': rec }, 'lbs', history).exercises[0];
    // Upper median 31 → Epley-translated to an 11-rep weight (row inc = 10) → 50×11 hold.
    expect(ex.workingWeight).toBe(50);
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(11);
    expect(ex.progression).toBe('maintain');
  });
});

describe('translation rep cap', () => {
  it('100-rep endurance sets translate like 30-rep sets, not 4x strength', () => {
    const curls = day('curl', 'Curls 3×6', 6, 'bicep-curl-barbell');
    const history = [session('curl', [[20, 100], [20, 100], [20, 100]], 1, 'bicep-curl-barbell')];
    const rec: ExerciseRecord = { ...record(20, 6), exerciseId: 'bicep-curl-barbell' };
    const ex = calculateRoutine(curls, { 'bicep-curl-barbell': rec }, 'lbs', history).exercises[0];
    // Capped factor 2 ÷ 1.2 → 33.3 → grid 30 (standard 5-lb step), held — not 70.
    expect(ex.workingWeight).toBe(30);
    expect(ex.progression).toBe('maintain');
  });
});

describe('median-set judgment', () => {
  // 4×6 day at 135 — sessions are judged by the TYPICAL (lower-median) set,
  // so one collapsed fatigue set can't turn an overshoot into a deload.
  const fourBySix: Routine = {
    ...day('heavy', 'Bench 4×6', 6),
    exercises: [{
      exerciseId: BENCH,
      exerciseName: 'Bench Press (Barbell)',
      sets: [{ reps: 6 }, { reps: 6 }, { reps: 6 }, { reps: 6 }],
    }],
  } as Routine;
  const rec = record(135, 6);
  const judge = (reps: number[]) =>
    calculateRoutine(fourBySix, { [BENCH]: rec }, 'lbs', [
      session('heavy', reps.map(r => [135, r] as [number, number]), 1),
    ]).exercises[0];

  it('8/9/9/4 is an overshoot, not a miss — load climbs', () => {
    // Upper median 9 → translated to the 6-rep equivalent and held.
    const ex = judge([8, 9, 9, 4]);
    expect(ex.workingWeight).toBe(145);
    expect(ex.progression).toBe('maintain');
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(6);
  });

  it('6/6/6/4 made the session — same weight, chase reps', () => {
    const ex = judge([6, 6, 6, 4]);
    expect(ex.workingWeight).toBe(135);
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(7);
  });

  it('4/4/4/4 genuinely missed — deload as before', () => {
    const ex = judge([4, 4, 4, 4]);
    expect(ex.workingWeight).toBe(125);
    expect(ex.progression).toBe('decrease');
  });

  it('a lone strong set among misses cannot carry the session (median)', () => {
    const ex = judge([8, 4, 4, 4]);
    expect(ex.progression).toBe('decrease'); // median 4, not rescued by the 8
  });
});

describe('cross-day spiral regression', () => {
  it('alternating heavy and volume days never erodes either target', () => {
    const heavy = day('heavy', 'Heavy 3×5', 5);
    const volume = day('volume', 'Volume 3×12', 12);
    // Established heavy bencher; volume day brand new.
    const history: LoggedWorkout[] = [session('heavy', [[225, 5], [225, 5], [225, 5]], 10)];
    let records: Record<string, ExerciseRecord> = { [BENCH]: record(225, 5) };

    const heavyTargets: number[] = [];
    const volumeTargets: number[] = [];
    const days = [volume, heavy, volume, heavy, volume, heavy, volume, heavy];
    days.forEach((d, i) => {
      const calc = calculateRoutine(d, records, 'lbs', history);
      const t = target(calc);
      (d.id === 'heavy' ? heavyTargets : volumeTargets).push(t.weight);
      // Obedient user: performs the prescription exactly, all sets done.
      const performed: [number, number][] = [[t.weight, t.reps], [t.weight, t.reps], [t.weight, t.reps]];
      history.push(session(d.id, performed, -(i + 1)));
      records = updateExerciseRecords(records, [
        { id: BENCH, completedSets: performed.map(([weight, reps]) => ({ weight, reps, unit: 'lbs' as const, completed: true })) },
      ], new Date(Date.UTC(2026, 6, i + 1)));
    });

    // The old shared-anchor rule collapsed 225 → 95 over these 8 sessions.
    for (const w of heavyTargets) expect(w).toBeGreaterThanOrEqual(225);
    for (let i = 1; i < heavyTargets.length; i++) expect(heavyTargets[i]).toBeGreaterThanOrEqual(heavyTargets[i - 1]);
    for (let i = 1; i < volumeTargets.length; i++) expect(volumeTargets[i]).toBeGreaterThanOrEqual(volumeTargets[i - 1]);
  });
});

describe('finish-time routine folding (ratchet regression)', () => {
  const stored = day('heavy', 'Heavy 3×5', 5).exercises;

  // The draft as loaded from the calculated routine: prescription reps, un-done.
  const draftFrom = (reps: number) => {
    const parsed: ParsedWorkout = {
      exercises: [{
        name: 'Bench Press (Barbell)',
        matchedExerciseId: BENCH,
        isCustom: false,
        sets: [
          { weight: 225, reps, unit: 'lbs', completed: false },
          { weight: 225, reps, unit: 'lbs', completed: false },
          { weight: 225, reps, unit: 'lbs', completed: false },
        ],
      }],
      confidence: 1,
      rawText: '',
    };
    return buildDraft(parsed, { asTarget: true });
  };

  it('an unchanged session no longer reports "routine changed"', () => {
    // Prescription said 6 (add-rep) while the stored floor is 5 — reps are
    // performance, not structure, so no prompt.
    expect(routineDiffersFromDraft(draftFrom(6), stored)).toBe(false);
  });

  it('a structural change still prompts', () => {
    const d = draftFrom(6);
    const shorter = removeSet(d, d[0].key, 2);
    // Different set count on the same exercise → structure changed.
    expect(routineDiffersFromDraft(shorter, stored)).toBe(true);
  });

  it('folding keeps the stored rep floors on carried-over sets', () => {
    const folded = draftToRoutineExercises(draftFrom(6), stored);
    expect(folded[0].sets.map(s => s.reps)).toEqual([5, 5, 5]); // floor survives
  });

  it('the fold reads recorded roles — flags never slide between rows', () => {
    const withWarmup: RoutineExercise[] = [{
      exerciseId: BENCH,
      exerciseName: 'Bench Press (Barbell)',
      sets: [{ reps: 10, isWarmup: true }, { reps: 8 }, { reps: 8 }, { reps: 8 }],
    }];
    const loaded = (rows: { reps: number; isWarmup?: boolean }[]) =>
      buildDraft({
        exercises: [{
          name: 'Bench Press (Barbell)', matchedExerciseId: BENCH, isCustom: false,
          sets: rows.map(r => ({ weight: 100, reps: r.reps, unit: 'lbs' as const, completed: false, isWarmup: r.isWarmup })),
        }],
        confidence: 1, rawText: '',
      }, { asTarget: true });

    // Deleted a WORK row → warmup stays the warmup, one work set gone.
    const droppedWork = draftToRoutineExercises(loaded([{ reps: 10, isWarmup: true }, { reps: 9 }, { reps: 9 }]), withWarmup);
    expect(droppedWork[0].sets).toEqual([
      { reps: 10, isWarmup: true },
      { reps: 8, isWarmup: undefined }, // stored floor survives
      { reps: 8, isWarmup: undefined },
    ]);

    // Deleted the WARMUP row → the warmup is genuinely removed, floors intact.
    const droppedWarmup = draftToRoutineExercises(loaded([{ reps: 9 }, { reps: 9 }, { reps: 9 }]), withWarmup);
    expect(droppedWarmup[0].sets).toEqual([
      { reps: 8, isWarmup: undefined },
      { reps: 8, isWarmup: undefined },
      { reps: 8, isWarmup: undefined },
    ]);
  });

  it('adding a warmup mid-session folds a warmup slot into the routine', () => {
    // Connor's scenario: program has 4 work sets and no warmup; user adds one
    // at the start via the ⋯ menu and accepts "update your routine?".
    const fourWork = day('heavy', 'Heavy 4×5', 5);
    fourWork.exercises[0].sets = [{ reps: 5 }, { reps: 5 }, { reps: 5 }, { reps: 5 }];
    const loaded = buildDraft({
      exercises: [{
        name: 'Bench Press (Barbell)', matchedExerciseId: BENCH, isCustom: false,
        sets: [5, 5, 5, 5].map(reps => ({ weight: 225, reps, unit: 'lbs' as const, completed: false })),
      }],
      confidence: 1, rawText: '',
    }, { asTarget: true });
    const withWarmup = addWarmupSet(loaded, loaded[0].key);

    expect(withWarmup[0].sets[0]).toMatchObject({ isWarmup: true, weight: 135 }); // 60% of 225, grid-rounded
    expect(routineDiffersFromDraft(withWarmup, fourWork.exercises)).toBe(true); // prompt fires
    const folded = draftToRoutineExercises(withWarmup, fourWork.exercises);
    expect(folded[0].sets.map(s => !!s.isWarmup)).toEqual([true, false, false, false, false]);
    expect(folded[0].sets.slice(1).map(s => s.reps)).toEqual([5, 5, 5, 5]); // floors untouched
  });

  it('added sets inherit the floor; a new exercise takes its reps from the draft', () => {
    const parsed: ParsedWorkout = {
      exercises: [
        {
          name: 'Bench Press (Barbell)', matchedExerciseId: BENCH, isCustom: false,
          sets: [6, 6, 6, 6].map(reps => ({ weight: 225, reps, unit: 'lbs' as const, completed: false })),
        },
        {
          name: 'Squat (Barbell)', matchedExerciseId: 'squat-barbell', isCustom: false,
          sets: [{ weight: 185, reps: 10, unit: 'lbs' as const, completed: false }],
        },
      ],
      confidence: 1,
      rawText: '',
    };
    const folded = draftToRoutineExercises(buildDraft(parsed, { asTarget: true }), stored);
    expect(folded[0].sets.map(s => s.reps)).toEqual([5, 5, 5, 5]); // 4th set inherits the floor
    expect(folded[1]).toMatchObject({ exerciseId: 'squat-barbell', sets: [{ reps: 10 }] });
  });
});
