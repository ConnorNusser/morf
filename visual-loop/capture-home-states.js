/**
 * Home-screen layout verification: renders the Home tab at PHONE viewport in the
 * three states that previously misused vertical space, so fill/clipping is visible
 * (capture-tabs.js's tall full-page viewport would hide exactly these bugs):
 *
 *   routine   – routine set (pager card). Was: dead space under the card.
 *   recent    – no routine, 3 recent workouts. Was: View Leaderboards clipped.
 *   long      – 10-exercise routine (content taller than screen). Must scroll;
 *               also captures scrolled-to-bottom to prove Leaderboards reachable.
 *
 * Env: DIST, PORT (default 5601), OUT, TAG (default "home"). Same server/seed
 * approach as capture-tabs.js. Requires a prior `expo export --platform web`.
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = process.env.DIST || path.resolve(__dirname, '..', 'dist');
const PORT = parseInt(process.env.PORT || '5601', 10);
const OUT = process.env.OUT || process.cwd();
const TAG = process.env.TAG || 'home';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
function serveDist(port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      const tries = [p, p + '.html', path.join(p, 'index.html'), '/index.html'];
      for (const t of tries) {
        const fp = path.join(DIST, t);
        if (fp.startsWith(DIST) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
          return fs.createReadStream(fp).pipe(res);
        }
      }
      res.writeHead(404); res.end('not found');
    });
    srv.on('error', reject);
    srv.listen(port, () => resolve(srv));
  });
}

// ---- seeds ----
const DAY = 864e5;
const now = Date.now();

// A few weeks of history so WeeklyGoal/streak/Recent all have data.
const PLAN = {
  push: [['bench-press-barbell', 135, 8], ['overhead-press-barbell', 75, 8], ['lateral-raise-dumbbells', 15, 12], ['tricep-extension-dumbbells', 25, 12]],
  pull: [['deadlift-barbell', 225, 5], ['row-barbell', 115, 8], ['lat-pulldown-cables', 100, 10], ['bicep-curl-barbell', 55, 10]],
  legs: [['squat-barbell', 185, 6], ['romanian-deadlift-barbell', 135, 8], ['lunges-barbell', 95, 10]],
};
const ROT = ['push', 'pull', 'legs'];
const TITLES = { push: 'Push Day', pull: 'Pull Day', legs: 'Leg Day' };
const workouts = [];
let wi = 0;
for (let week = 0; week < 4; week++) {
  for (let d = 0; d < 3; d++) {
    const day = ROT[d];
    const daysAgo = (4 - week) * 7 - d * 2;
    const exercises = PLAN[day].map(([id, w, reps]) => ({
      id, sets: 3, reps: `${reps}`, isCompleted: true,
      completedSets: [0, 1, 2].map((s) => ({ setNumber: s + 1, weight: w, reps, unit: 'lbs', completed: true })),
    }));
    workouts.push({ id: `w-${String(wi++).padStart(3, '0')}`, title: TITLES[day], description: '', exercises, estimatedDuration: 50, difficulty: 'moderate', createdAt: new Date(now - daysAgo * DAY).toISOString() });
  }
}

const profile = { height: { value: 5.9, unit: 'feet' }, weight: { value: 185, unit: 'lbs' }, gender: 'male', age: 28, weightUnitPreference: 'lbs' };

const mkRoutine = (id, name, ids, order) => ({
  id, name, splitType: 'push', order, isActive: true,
  createdAt: new Date(now - 30 * DAY).toISOString(),
  exercises: ids.map((exerciseId) => ({ exerciseId, sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] })),
});

const SHORT_ROUTINE = [mkRoutine('rt-push', 'Push Day', ['bench-press-barbell', 'overhead-press-barbell', 'lateral-raise-dumbbells', 'tricep-extension-dumbbells'], 0)];
const LONG_ROUTINE = [mkRoutine('rt-full', 'Full Body Blast', ['bench-press-barbell', 'squat-barbell', 'deadlift-barbell', 'overhead-press-barbell', 'row-barbell', 'lat-pulldown-cables', 'romanian-deadlift-barbell', 'lunges-barbell', 'bicep-curl-barbell', 'tricep-extension-dumbbells'], 0)];

const SCENARIOS = [
  { name: 'routine', seed: { user_profile: JSON.stringify(profile), workout_history: JSON.stringify(workouts), routines: JSON.stringify(SHORT_ROUTINE) } },
  { name: 'recent', seed: { user_profile: JSON.stringify(profile), workout_history: JSON.stringify(workouts) } },
  { name: 'long', seed: { user_profile: JSON.stringify(profile), workout_history: JSON.stringify(workouts), routines: JSON.stringify(LONG_ROUTINE) }, scrollToBottom: true },
];

(async () => {
  const srv = await serveDist(PORT);
  const base = `http://localhost:${PORT}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const { name, seed, scrollToBottom } of SCENARIOS) {
    // Fresh context per scenario — localStorage must not leak between seeds.
    const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { if (!/#418|#419|#423/.test(e.message)) console.log('PAGEERROR:', e.message); });

    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => { for (const [k, v] of Object.entries(s)) window.localStorage.setItem(k, v); }, seed);
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT, `${TAG}-${name}.png`) });

    if (scrollToBottom) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-bottom.png`) });
    }
    await ctx.close();
    console.log(`captured: ${name}`);
  }

  await browser.close();
  srv.close();
  console.log(`${TAG}: done -> ${OUT}`);
})().catch((e) => { console.error('capture failed:', e.message); process.exit(1); });
