/**
 * Routine Generation Output Audit
 *
 * Purpose: empirically measure whether the current LLM-owns-structure approach
 * produces correct programs, or whether it silently degrades on the way into the app.
 *
 * Fidelity notes:
 * - Prompt is built with the REAL compiled builder (audit/build/.../routineGeneration.prompt.js).
 * - System prompt + callAI parsing mirror lib/ai/aiRoutineGenerator.ts:callAI verbatim.
 * - findExerciseByName + the fatigue validator are copied VERBATIM from source
 *   (aiRoutineGenerator.ts / trainingAdvancement.ts) so we measure the real system's behavior.
 * - Exercise universe is read from lib/data/exercises.json (same data ALL_WORKOUTS is built from).
 * - User profile/history are synthesized (history mainly biases selection, not structure).
 */

const fs = require('fs');
const path = require('path');

const REPO = '/Users/connor/repo/morph-worktrees/analysis-routine-generation';
const { GoogleGenerativeAI } = require('/Users/connor/repo/morph/node_modules/@google/generative-ai');
const { buildRoutineGenerationPrompt } = require(path.join(REPO, 'audit/build/ai/prompts/routineGeneration.prompt.js'));

// ---- API key from main checkout .env ----
const envText = fs.readFileSync('/Users/connor/repo/morph/.env', 'utf8');
const API_KEY = (envText.match(/EXPO_PUBLIC_GEMINI_API_KEY=(.+)/) || [])[1]?.trim();
if (!API_KEY) { console.error('No API key'); process.exit(1); }
const genAI = new GoogleGenerativeAI(API_KEY);

// ---- exercise universe ----
const exData = require(path.join(REPO, 'lib/data/exercises.json'));
const ALL = Array.isArray(exData) ? exData : (exData.exercises || Object.values(exData)[0]);
// custom exercises: none in audit
const CUSTOM = [];

const EQUIP_DISPLAY = { barbell:'Barbell', dumbbell:'Dumbbells', machine:'Machines', 'smith-machine':'Smith Machine', cable:'Cables', kettlebell:'Kettlebell', bodyweight:'Bodyweight' };

function workoutsByEquipment(userEquipment, limit) {
  const set = new Set(userEquipment);
  return ALL.filter(e => (e.equipment || []).some(q => set.has(q))).slice(0, limit);
}

// ===== VERBATIM from aiRoutineGenerator.ts:findExerciseByName (instrumented to report tier) =====
function findExerciseByName(name) {
  const cleanName = name.toLowerCase().trim();
  for (const ex of ALL) if (ex.name.toLowerCase() === cleanName) return { id: ex.id, name: ex.name, tier: 'exact' };
  for (const ex of CUSTOM) if (ex.name.toLowerCase() === cleanName) return { id: ex.id, name: ex.name, tier: 'exact' };
  for (const ex of ALL) if (ex.name.toLowerCase().includes(cleanName) || cleanName.includes(ex.name.toLowerCase())) return { id: ex.id, name: ex.name, tier: 'partial' };
  for (const ex of CUSTOM) if (ex.name.toLowerCase().includes(cleanName) || cleanName.includes(ex.name.toLowerCase())) return { id: ex.id, name: ex.name, tier: 'partial' };
  const nm = cleanName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  for (const ex of ALL) { const e2 = ex.name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim(); if (e2 === nm) return { id: ex.id, name: ex.name, tier: 'noequip' }; }
  for (const ex of CUSTOM) { const e2 = ex.name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim(); if (e2 === nm) return { id: ex.id, name: ex.name, tier: 'noequip' }; }
  return null;
}

// ===== VERBATIM from trainingAdvancement.ts =====
const PROGRAMMING_RULES = {
  beginner:    { allowHeavySquatAndDeadliftSameDay: true,  maxSetsPerMusclePerSession: 12, suggestedFrequency:{squat:3,bench:3,deadlift:2} },
  intermediate:{ allowHeavySquatAndDeadliftSameDay: false, maxSetsPerMusclePerSession: 10, suggestedFrequency:{squat:2,bench:3,deadlift:1.5} },
  advanced:    { allowHeavySquatAndDeadliftSameDay: false, maxSetsPerMusclePerSession: 8,  suggestedFrequency:{squat:2,bench:2,deadlift:1} },
};
const EXERCISE_MOVEMENT_PATTERNS = {
  'squat-barbell':'squat','front-squat-barbell':'squat','goblet-squat-dumbbell':'squat','leg-press-machine':'squat','hack-squat-machine':'squat','bulgarian-split-squat-dumbbells':'squat',
  'deadlift-barbell':'hinge','deadlift-conventional-barbell':'hinge','deadlift-sumo-barbell':'hinge','romanian-deadlift-barbell':'hinge','romanian-deadlift-dumbbells':'hinge','good-morning-barbell':'hinge','hip-thrust-barbell':'hinge','kettlebell-swing':'hinge',
  'bench-press-barbell':'horizontal_push','bench-press-dumbbells':'horizontal_push','incline-bench-press-barbell':'horizontal_push','incline-bench-press-dumbbells':'horizontal_push','decline-bench-press-barbell':'horizontal_push','chest-fly-dumbbells':'horizontal_push','chest-fly-cables':'horizontal_push','push-up-bodyweight':'horizontal_push','dip-bodyweight':'horizontal_push',
  'row-barbell':'horizontal_pull','row-dumbbells':'horizontal_pull','cable-row-cables':'horizontal_pull','seated-row-cables':'horizontal_pull','t-bar-row-barbell':'horizontal_pull','pendlay-row-barbell':'horizontal_pull','chest-supported-row-dumbbells':'horizontal_pull',
  'overhead-press-barbell':'vertical_push','overhead-press-dumbbells':'vertical_push','arnold-press-dumbbells':'vertical_push','push-press-barbell':'vertical_push','lateral-raise-dumbbells':'vertical_push',
  'pull-up-bodyweight':'vertical_pull','chin-up-bodyweight':'vertical_pull','lat-pulldown-cables':'vertical_pull','lat-pulldown-machine':'vertical_pull',
  'farmers-walk-dumbbells':'carry','suitcase-carry-dumbbell':'carry',
  'bicep-curl-dumbbells':'isolation','bicep-curl-barbell':'isolation','tricep-pushdown-cables':'isolation','tricep-extension-dumbbells':'isolation','leg-curl-machine':'isolation','leg-extension-machine':'isolation','calf-raise-machine':'isolation','face-pull-cables':'isolation','rear-delt-fly-dumbbells':'isolation',
};
const getMovementPattern = id => EXERCISE_MOVEMENT_PATTERNS[id] || 'isolation';

// VERBATIM validator (name->slug like the real validateGeneratedProgram)
function realValidate(program, level) {
  const config = PROGRAMMING_RULES[level];
  const dayWarnings = [];
  let seenSlugs = 0, totalSlugs = 0;
  for (const day of program.routines || []) {
    const counts = {squat:0,hinge:0,horizontal_push:0,horizontal_pull:0,vertical_push:0,vertical_pull:0,carry:0,isolation:0};
    const sets = {...counts};
    for (const ex of day.exercises || []) {
      const slug = ex.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      totalSlugs++; if (EXERCISE_MOVEMENT_PATTERNS[slug]) seenSlugs++;
      const p = getMovementPattern(slug);
      counts[p]++; sets[p] += ex.sets || 3;
    }
    const warns = [];
    if (counts.squat>0 && counts.hinge>0 && !config.allowHeavySquatAndDeadliftSameDay) warns.push(`squat+hinge same day (${day.name})`);
    for (const [p,s] of Object.entries(sets)) if (p!=='isolation' && s>config.maxSetsPerMusclePerSession) warns.push(`${p} ${s} sets > ${config.maxSetsPerMusclePerSession} (${day.name})`);
    const push = sets.horizontal_push+sets.vertical_push, pull = sets.horizontal_pull+sets.vertical_pull;
    if (push>0 && pull>0 && push/pull>1.5) warns.push(`push-heavy ${push}v${pull} (${day.name})`);
    if (warns.length) dayWarnings.push(...warns);
  }
  return { warnings: dayWarnings, patternCoverage: totalSlugs ? seenSlugs/totalSlugs : 1, seenSlugs, totalSlugs };
}

// ===== VERBATIM-equivalent from aiRoutineGenerator.ts:callAI =====
const SYSTEM_PROMPT = `You are an experienced strength and conditioning coach. Create practical, evidence-based workout programs.

STRICT RULES:
1. ONLY use exercises from the "AVAILABLE EXERCISES" list - do NOT invent, substitute, or add any exercises not explicitly listed
2. Follow the "CRITICAL REQUIREMENTS" section exactly - these constraints (exercise counts, included exercises, fatigue management) override all other guidelines
3. If a required exercise is listed, it MUST appear in the program
4. If an exercise is NOT in the available list, do NOT use it under any circumstances

Return only valid JSON.`;

async function callAI(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });
  const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n${prompt}`);
  let content = result.response.text().trim();
  if (content.startsWith('```')) content = content.replace(/```json?\n?/g,'').replace(/```\n?$/g,'');
  return JSON.parse(content);
}

// ---- build params (mirrors aiRoutineGenerator.buildPrompt) ----
function buildParams(cell) {
  const userEquipment = cell.equipment;
  const available = workoutsByEquipment(userEquipment, 100);
  let names = available.map(e => e.name);
  if (cell.excludedExercises) {
    const exSet = new Set(cell.excludedExercises);
    names = names.filter(n => { const e = available.find(x=>x.name===n); return !e || !exSet.has(e.id); });
  }
  const includedNames = (cell.includedExercises||[]).map(id => available.find(e=>e.id===id)?.name).filter(Boolean);
  const cfg = PROGRAMMING_RULES[cell.level];
  const strengthLevelLabel = cell.level==='beginner'?'Beginner':cell.level==='advanced'?'Advanced':'Intermediate';
  const history = cell.level==='beginner'
    ? 'No recent workout history - use reasonable starting weights.'
    : `USER'S TRAINING HISTORY (last 20 workouts):\n- Bench Press (Barbell): 185lbs x 5 PR, trained 8x\n- Squat (Barbell): 245lbs x 5 PR, trained 7x\n- Deadlift (Barbell): 315lbs x 3 PR, trained 5x\n- Row (Barbell): 155lbs x 8 PR, trained 6x\n\nNote: Prioritize exercises the user frequently trains when building their program.`;
  return {
    programTemplate: cell.programTemplate, trainingGoal: cell.goal,
    userStrengthLevel: strengthLevelLabel, userBodyWeight: 180, weightUnit: 'lbs', gender: 'male',
    userEquipmentDisplay: userEquipment.map(e=>EQUIP_DISPLAY[e]).join(', '),
    exerciseHistorySummary: history, customExercisesSummary: '',
    allExerciseNames: names, weeklyDays: cell.days,
    focusMuscles: cell.focusMuscles, ignoredMuscles: cell.ignoredMuscles,
    trainingAdvancement: { level: cell.level, allowHeavySquatAndDeadliftSameDay: cfg.allowHeavySquatAndDeadliftSameDay, maxSetsPerMusclePerSession: cfg.maxSetsPerMusclePerSession, suggestedFrequency: cfg.suggestedFrequency },
    workoutDuration: cell.duration, exercisesPerWorkout: cell.epw,
    includedExercises: includedNames.length?includedNames:undefined,
  };
}

function grade(cell, program) {
  const days = program.routines || [];
  let total=0, matched=0, partial=0, dropped=[], shortDays=0, emptyDays=0, hasWeight=false, allRepsPoint=true;
  for (const d of days) {
    const exs = d.exercises || [];
    if (exs.length===0) emptyDays++;
    if (cell.epw && exs.length < cell.epw.min) shortDays++;
    for (const ex of exs) {
      total++;
      const m = findExerciseByName(ex.name);
      if (m) { matched++; if (m.tier!=='exact') partial++; } else dropped.push(ex.name);
      if ('weight' in ex || 'suggestedWeight' in ex || 'load' in ex) hasWeight = true;
      if (typeof ex.reps !== 'number') allRepsPoint = false; // string/range present
    }
  }
  const val = realValidate(program, cell.level);
  // includes
  let includedMissing = [];
  if (cell.includedExercises) {
    const reqNames = cell.includedExercises.map(id => ALL.find(e=>e.id===id)?.name).filter(Boolean);
    const present = new Set(days.flatMap(d=>(d.exercises||[]).map(e=>findExerciseByName(e.name)?.name).filter(Boolean)));
    includedMissing = reqNames.filter(n => !present.has(n));
  }
  // excludes
  let excludedViolations = [];
  if (cell.excludedExercises) {
    const exNames = new Set(cell.excludedExercises.map(id=>ALL.find(e=>e.id===id)?.name));
    excludedViolations = days.flatMap(d=>(d.exercises||[]).map(e=>findExerciseByName(e.name)?.name)).filter(n=>exNames.has(n));
  }
  return {
    dayCountOk: days.length === cell.days, returnedDays: days.length,
    totalExercises: total, matchedExercises: matched, droppedCount: dropped.length, dropped,
    partialMatchCount: partial, matchRate: total?+(matched/total*100).toFixed(1):0,
    shortDays, emptyDays,
    weightsPresent: hasWeight, repsArePoint: allRepsPoint,
    patternCoverage: +(val.patternCoverage*100).toFixed(1), fatigueWarnings: val.warnings,
    includedMissing, excludedViolations,
  };
}

// ---- matrix ----
const FULL = ['barbell','dumbbell','machine','cable','kettlebell','bodyweight'];
const HOME = ['dumbbell','bodyweight'];
const D60 = { min:5, max:7 }, D90 = { min:6, max:8 };
const cells = [
  { id:'hyp-6-ppl-full',     goal:'hypertrophy', days:6, programTemplate:'ppl',          level:'intermediate', equipment:FULL, duration:60, epw:D60 },
  { id:'str-3-fb-full',      goal:'strength',    days:3, programTemplate:'full_body',     level:'intermediate', equipment:FULL, duration:60, epw:D60 },
  { id:'pb-4-ul-full',       goal:'powerbuilding',days:4,programTemplate:'upper_lower',   level:'intermediate', equipment:FULL, duration:60, epw:D60 },
  { id:'hyp-4-ul-full',      goal:'hypertrophy', days:4, programTemplate:'upper_lower',   level:'advanced',     equipment:FULL, duration:60, epw:D60 },
  { id:'pb-5-pwr-full',      goal:'powerbuilding',days:5,programTemplate:'powerbuilding', level:'advanced',     equipment:FULL, duration:90, epw:D90 },
  { id:'hyp-5-bro-full',     goal:'hypertrophy', days:5, programTemplate:'bro_split',     level:'intermediate', equipment:FULL, duration:60, epw:D60 },
  { id:'str-6-ppl-full',     goal:'strength',    days:6, programTemplate:'ppl',           level:'advanced',     equipment:FULL, duration:60, epw:D60 },
  { id:'str-4-ul-full',      goal:'strength',    days:4, programTemplate:'upper_lower',   level:'beginner',     equipment:FULL, duration:60, epw:D60 },
  { id:'hyp-3-fb-full-beg',  goal:'hypertrophy', days:3, programTemplate:'full_body',     level:'beginner',     equipment:FULL, duration:60, epw:D60 },
  { id:'pb-6-ppl-full',      goal:'powerbuilding',days:6,programTemplate:'ppl',           level:'intermediate', equipment:FULL, duration:90, epw:D90 },
  // equipment stress (home: dumbbell + bodyweight only)
  { id:'hyp-4-ul-home',      goal:'hypertrophy', days:4, programTemplate:'upper_lower',   level:'intermediate', equipment:HOME, duration:60, epw:D60 },
  { id:'hyp-3-fb-home',      goal:'hypertrophy', days:3, programTemplate:'full_body',     level:'beginner',     equipment:HOME, duration:60, epw:D60 },
  { id:'str-3-fb-home',      goal:'strength',    days:3, programTemplate:'full_body',     level:'intermediate', equipment:HOME, duration:60, epw:D60 },
  // focus
  { id:'hyp-5-bro-focus',    goal:'hypertrophy', days:5, programTemplate:'bro_split',     level:'intermediate', equipment:FULL, duration:60, epw:D60, focusMuscles:['chest','arms'] },
  // exclusion: no legs
  { id:'hyp-4-nolegs',       goal:'hypertrophy', days:4, programTemplate:'upper_lower',   level:'intermediate', equipment:FULL, duration:60, epw:D60, ignoredMuscles:['legs'] },
  // include / exclude specific
  { id:'pb-4-incl-excl',     goal:'powerbuilding',days:4,programTemplate:'upper_lower',   level:'intermediate', equipment:FULL, duration:60, epw:D60, includedExercises:['hip-thrust-barbell'], excludedExercises:['bench-press-barbell'] },
];

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({length:n}, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

async function runCell(cell) {
  const t0 = Date.now();
  try {
    const prompt = buildRoutineGenerationPrompt(buildParams(cell));
    const program = await callAI(prompt);
    const g = grade(cell, program);
    return { id:cell.id, ok:true, ms:Date.now()-t0, promptChars:prompt.length, programName:program.programName, ...g, _program:program };
  } catch (e) {
    return { id:cell.id, ok:false, ms:Date.now()-t0, error:String(e.message||e) };
  }
}

(async () => {
  console.log(`Running ${cells.length} cells + determinism probe...`);
  const results = await pool(cells, 5, async (c) => { const r = await runCell(c); console.log(`  ${r.ok?'✓':'✗'} ${r.id} ${r.ms}ms ${r.ok?`match=${r.matchRate}% dropped=${r.droppedCount} dayOk=${r.dayCountOk} fatigue=${r.fatigueWarnings.length} cover=${r.patternCoverage}%`:r.error}`); return r; });

  // determinism probe: same cell 3x
  console.log('Determinism probe (hyp-6-ppl-full x3)...');
  const probeCell = cells[0];
  const probes = await pool([0,1,2], 3, async () => { const p = buildRoutineGenerationPrompt(buildParams(probeCell)); const prog = await callAI(p); return (prog.routines||[]).map(d=>({name:d.name, ex:(d.exercises||[]).map(e=>e.name)})); });
  // jaccard of day1 exercise sets across runs
  function jac(a,b){const A=new Set(a),B=new Set(b);const inter=[...A].filter(x=>B.has(x)).length;return +(inter/(new Set([...a,...b]).size)).toFixed(2);}
  const detPairs = [];
  for (let d=0; d<Math.min(...probes.map(p=>p.length)); d++) detPairs.push(jac(probes[0][d].ex, probes[1][d].ex), jac(probes[1][d].ex, probes[2][d].ex), jac(probes[0][d].ex, probes[2][d].ex));
  const avgJac = +(detPairs.reduce((a,b)=>a+b,0)/detPairs.length).toFixed(2);

  fs.writeFileSync(path.join(REPO,'audit/results.json'), JSON.stringify({ results, probes, avgJaccard:avgJac }, null, 2));

  // ---- aggregate ----
  const ok = results.filter(r=>r.ok);
  const agg = {
    cells: results.length, succeeded: ok.length, failed: results.length-ok.length,
    avgMatchRate: +(ok.reduce((s,r)=>s+r.matchRate,0)/ok.length).toFixed(1),
    cellsWithDrops: ok.filter(r=>r.droppedCount>0).length,
    totalDropped: ok.reduce((s,r)=>s+r.droppedCount,0),
    cellsWithPartialMatch: ok.filter(r=>r.partialMatchCount>0).length,
    totalPartialMatches: ok.reduce((s,r)=>s+r.partialMatchCount,0),
    dayCountWrong: ok.filter(r=>!r.dayCountOk).length,
    cellsWithShortDays: ok.filter(r=>r.shortDays>0).length,
    cellsWithEmptyDays: ok.filter(r=>r.emptyDays>0).length,
    cellsWithWeights: ok.filter(r=>r.weightsPresent).length,
    cellsWithRepRanges: ok.filter(r=>!r.repsArePoint).length,
    avgPatternCoverage: +(ok.reduce((s,r)=>s+r.patternCoverage,0)/ok.length).toFixed(1),
    cellsWithFatigueWarnings: ok.filter(r=>r.fatigueWarnings.length>0).length,
    includeMisses: ok.filter(r=>(r.includedMissing||[]).length>0).map(r=>r.id),
    excludeViolations: ok.filter(r=>(r.excludedViolations||[]).length>0).map(r=>({id:r.id,v:r.excludedViolations})),
    avgJaccardDeterminism: avgJac,
  };
  fs.writeFileSync(path.join(REPO,'audit/summary.json'), JSON.stringify(agg, null, 2));
  console.log('\n===== AGGREGATE =====');
  console.log(JSON.stringify(agg, null, 2));
})();
