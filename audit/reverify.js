/**
 * Re-score the 16 captured audit programs with the RECONCILED validator logic and compare
 * to the original slug-based validator. Mirrors validateRoutines (trainingAdvancement.ts).
 */
const fs = require('fs');
const path = require('path');
const REPO = '/Users/connor/repo/morph-worktrees/analysis-routine-generation';
const { results } = require(path.join(REPO, 'audit/results.json'));
const exData = require(path.join(REPO, 'lib/data/exercises.json'));
const ALL = Array.isArray(exData) ? exData : (exData.exercises || Object.values(exData)[0]);

// matrix levels (from runAudit.js) so caps match what the app would use
const LEVEL = {
  'hyp-6-ppl-full':'intermediate','str-3-fb-full':'intermediate','pb-4-ul-full':'intermediate',
  'hyp-4-ul-full':'advanced','pb-5-pwr-full':'advanced','hyp-5-bro-full':'intermediate',
  'str-6-ppl-full':'advanced','str-4-ul-full':'beginner','hyp-3-fb-full-beg':'beginner',
  'pb-6-ppl-full':'intermediate','hyp-4-ul-home':'intermediate','hyp-3-fb-home':'beginner',
  'str-3-fb-home':'intermediate','hyp-5-bro-focus':'intermediate','hyp-4-nolegs':'intermediate',
  'pb-4-incl-excl':'intermediate',
};
const CAP = { beginner:12, intermediate:10, advanced:8 };
const ALLOW_SAME_DAY = { beginner:true, intermediate:false, advanced:false };
const MAP = require('./_movementMap.js'); // squat/hinge ids

function matchId(name){
  const c = name.toLowerCase().trim();
  let e = ALL.find(x=>x.name.toLowerCase()===c);
  if (e) return e;
  const nm = c.replace(/\s*\([^)]*\)\s*$/,'').trim();
  e = ALL.find(x=>x.name.toLowerCase().replace(/\s*\([^)]*\)\s*$/,'').trim()===nm);
  return e || null;
}
function parseReps(raw){ if(typeof raw==='number')return raw; const m=String(raw).match(/\d+/); return m?parseInt(m[0]):10; }
function classifyLower(id,name){
  if (MAP[id]==='squat'||MAP[id]==='hinge') return MAP[id];
  const n=(name||'').toLowerCase();
  if (/(romanian|rdl|deadlift|good\s*morning|hip\s*thrust|swing|back\s*extension|hyperextension)/.test(n)) return 'hinge';
  if (/(squat|leg\s*press|hack|lunge|split\s*squat|step.?up)/.test(n)) return 'squat';
  return null;
}

let oldFlagged=0, newFlagged=0, coverNum=0, coverDen=0;
const rows=[];
for (const r of results.filter(r=>r.ok)) {
  const level = LEVEL[r.id] || 'intermediate';
  const cap = CAP[level];
  const prog = r._program;
  // coverage: fraction of exercises that resolve to a real DB id (new approach)
  let resolved=0, total=0;
  let heavyLowerDays=0, muscleOver=false;
  for (const day of prog.routines||[]) {
    const setsPerMuscle={};
    let hSquat=false, hHinge=false;
    for (const ex of day.exercises||[]) {
      total++; const e=matchId(ex.name); if(e)resolved++;
      const reps=parseReps(ex.reps); const heavy=reps<=6;
      const id=e?e.id:''; const pat=classifyLower(id, e?e.name:ex.name);
      if (heavy && pat==='squat') hSquat=true;
      if (heavy && pat==='hinge') hHinge=true;
      const sc = Math.max(1, Math.round(Number(ex.sets)||1));
      for (const m of (e?.primaryMuscles||[])) setsPerMuscle[m]=(setsPerMuscle[m]||0)+sc;
    }
    if (hSquat && hHinge) heavyLowerDays++;
    if (Object.values(setsPerMuscle).some(s=>s>cap)) muscleOver=true;
  }
  coverNum+=resolved; coverDen+=total;
  // shipped validator = squat+hinge frequency only (per-session muscle volume dropped:
  // coarse "legs"/"back"/"arms" region labels make it fire on by-design leg/back days)
  const newWarn = (!ALLOW_SAME_DAY[level] && heavyLowerDays>1);
  const oldWarn = (r.fatigueWarnings||[]).length>0;
  if (oldWarn) oldFlagged++;
  if (newWarn) newFlagged++;
  rows.push({id:r.id, level, oldWarnings:(r.fatigueWarnings||[]).length, heavyLowerDays, muscleOver, newWarn});
}
console.log('per-cell:');
for (const x of rows) console.log(`  ${x.id} [${x.level}] old=${x.oldWarnings} heavyLowerDays=${x.heavyLowerDays} muscleOver=${x.muscleOver} -> newWarn=${x.newWarn}`);
console.log('\nSUMMARY');
console.log(`  exercise->DB id coverage: ${(coverNum/coverDen*100).toFixed(1)}% (old slug coverage avg was ~82%, low 56%)`);
console.log(`  programs flagged OLD validator: ${oldFlagged}/${rows.length}`);
console.log(`  programs flagged NEW validator: ${newFlagged}/${rows.length}`);
