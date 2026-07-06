/**
 * Headless capture of the Home, History, and Workout tabs — the surface of the
 * UI-consistency audit. Same seeding/server approach as capture.js, generalized
 * to a route list so before/after renders of all three tabs come from one run.
 *
 * Env: DIST, PORT, OUT, TAG (same as capture.js).
 * Emits, per route: <TAG>-<name>.png (fold) and <TAG>-<name>-full.png (full page).
 * Plus <TAG>-exercises.png for History's second segment.
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = process.env.DIST || path.resolve(__dirname, '..', 'dist');
const PORT = parseInt(process.env.PORT || '5599', 10);
const OUT = process.env.OUT || process.cwd();
const TAG = process.env.TAG || 'tabs';

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

// ---- realistic ~16-week PPL history with progressive overload + PRs ----
const DAY = 864e5;
const now = Date.now();
const r5 = (n) => Math.round(n / 5) * 5;
const PLAN = {
  push: [['bench-press-barbell', 135, 3, 8], ['overhead-press-barbell', 75, 2, 8], ['incline-bench-press-dumbbells', 50, 1.5, 10], ['lateral-raise-dumbbells', 15, 0.5, 12], ['tricep-extension-dumbbells', 25, 1, 12]],
  pull: [['deadlift-barbell', 225, 6, 5], ['row-barbell', 115, 3, 8], ['lat-pulldown-cables', 100, 3, 10], ['bicep-curl-barbell', 55, 1.5, 10], ['hammer-curl-dumbbells', 25, 0.5, 12]],
  legs: [['squat-barbell', 185, 5, 6], ['romanian-deadlift-barbell', 135, 4, 8], ['lunges-barbell', 95, 2, 10], ['goblet-squat-dumbbells', 45, 1, 12]],
  upper: [['incline-bench-press-barbell', 115, 3, 8], ['row-dumbbells', 50, 1.5, 10], ['shoulder-press-dumbbells', 40, 1.5, 10], ['bicep-curl-dumbbells', 25, 0.75, 12]],
};
const ROT = ['push', 'pull', 'legs', 'upper'];
const TITLES = { push: 'Push Day', pull: 'Pull Day', legs: 'Leg Day', upper: 'Upper Body' };
const workouts = [];
let wi = 0;
const WEEKS = 16;
for (let week = 0; week < WEEKS; week++) {
  for (let d = 0; d < 4; d++) {
    if (week >= 13 && d === 3) continue; // realistic recent gaps
    const day = ROT[(week * 4 + d) % ROT.length];
    const daysAgo = (WEEKS - week) * 7 - d * 2;
    const createdAt = new Date(now - daysAgo * DAY).toISOString();
    const exercises = PLAN[day].map(([id, base, inc, baseReps]) => {
      const w = r5(base + inc * week);
      const reps = Math.max(4, baseReps - Math.floor(week / 6));
      const completedSets = [0, 1, 2].map((s) => ({ setNumber: s + 1, weight: s === 0 ? r5(w * 0.9) : w, reps: s === 0 ? reps + 2 : reps, unit: 'lbs', completed: true }));
      return { id, sets: 3, reps: `${reps}`, completedSets, isCompleted: true };
    });
    workouts.push({ id: `w-${String(wi++).padStart(3, '0')}`, title: TITLES[day], description: '', exercises, estimatedDuration: 52, difficulty: 'moderate', createdAt });
  }
}
const seed = {
  workout_history: JSON.stringify(workouts),
  user_profile: JSON.stringify({ height: { value: 5.9, unit: 'feet' }, weight: { value: 185, unit: 'lbs' }, gender: 'male', age: 28, weightUnitPreference: 'lbs' }),
};

const ROUTES = [
  { route: '/', name: 'home' },
  { route: '/history', name: 'history' },
  { route: '/workout', name: 'workout' },
];

(async () => {
  const srv = await serveDist(PORT);
  const base = `http://localhost:${PORT}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/#418|#419|#423/.test(e.message)) console.log('PAGEERROR:', e.message); });

  // seed storage once, before the app boots for real
  await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => { for (const [k, v] of Object.entries(s)) window.localStorage.setItem(k, v); }, seed);

  for (const { route, name } of ROUTES) {
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT, `${TAG}-${name}.png`) });
    await page.setViewportSize({ width: 402, height: 3600 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-full.png`) });
    await page.setViewportSize({ width: 402, height: 874 });
    await page.waitForTimeout(400);

    if (name === 'history') {
      try {
        const tab = page.getByText('Exercises', { exact: true }).first();
        if (await tab.count()) {
          await tab.click({ timeout: 2000 });
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(OUT, `${TAG}-exercises.png`) });
        }
      } catch (e) { console.log('exercises tab:', e.message); }
    }
  }

  await browser.close();
  srv.close();
  console.log(`${TAG}: captured ${ROUTES.length} tabs -> ${OUT}`);
})().catch((e) => { console.error('capture failed:', e.message); process.exit(1); });
