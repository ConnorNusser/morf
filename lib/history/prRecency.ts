import { ExerciseWithMax } from '@/types';
import { dayKeyOf, e1rmLbs } from '@/components/history/liftSeries';

// Pure (no React / react-native) and clock-INJECTABLE so the "how long since this lift
// last set a record" signal is node-gateable — unlike the inline quickStats/streak
// useMemo in app/(tabs)/history.tsx, which hardcodes new Date() and so can't be asserted
// against a fixed REFERENCE_NOW.
//
// It reuses the exact day-bucket walk buildPRDays (prSessions.ts) uses to decide what a
// PR is: collapse history to one best-e1RM bucket per training day, walk oldest→newest,
// and flag every day that strictly beats the running max (first-ever day EXCLUDED — a new
// user's first log beats nothing). Here we additionally keep the DATE of the most-recent
// such record and count the distinct training days logged AFTER it, which is what turns a
// still-climbing curve into an honest "you've plateaued" nudge on the hero.

const DAY = 24 * 60 * 60 * 1000;

/** A lift is flagged plateaued once it has gone this long AND this many sessions with no PR. */
export const PLATEAU_MIN_DAYS = 21;
export const PLATEAU_MIN_SESSIONS = 4;

export interface PRRecency {
  exerciseId: string;
  /** Date of the most-recent all-time-best training day. */
  lastPRDate: Date;
  /** Whole days from lastPRDate to `now` (>= 0). */
  daysSincePR: number;
  /** Distinct training days logged strictly after the last PR day. */
  sessionsSincePR: number;
  /** True once daysSincePR and sessionsSincePR both clear the plateau thresholds. */
  isPlateau: boolean;
}

interface DayBucket {
  time: number;
  bestLbs: number;
}

/**
 * Per-exercise PR recency, keyed by exercise id. Exercises that have never set a record
 * (0 PR days — e.g. a brand-new user's single first log) are OMITTED from the map, so a
 * missing entry reads as "no plateau signal to show".
 *
 * `now` is injected (not read from the clock) so the same call is deterministic under test.
 */
export function computePRRecency(exerciseStats: ExerciseWithMax[], now: Date): Map<string, PRRecency> {
  const out = new Map<string, PRRecency>();
  const nowTime = now.getTime();

  for (const ex of exerciseStats) {
    if (!ex.history || ex.history.length === 0) continue;

    // One bucket per training day, keeping that day's best e1RM (lbs) — identical to the
    // buildPRDays / hero-curve bucketing, so a "plateau" can never disagree with a chip.
    const byDay = new Map<string, DayBucket>();
    for (const h of ex.history) {
      const key = dayKeyOf(h.date);
      const best = e1rmLbs(h);
      const existing = byDay.get(key);
      if (existing) {
        if (best > existing.bestLbs) existing.bestLbs = best;
      } else {
        byDay.set(key, { time: new Date(h.date).getTime(), bestLbs: best });
      }
    }

    const days = [...byDay.values()].sort((a, b) => a.time - b.time);
    let runningMax = -Infinity;
    let lastPRTime: number | null = null;
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      // i > 0: first-ever day beats nothing, so it is never a record.
      if (i > 0 && day.bestLbs > runningMax) lastPRTime = day.time;
      if (day.bestLbs > runningMax) runningMax = day.bestLbs;
    }

    if (lastPRTime === null) continue; // no record ever set → no recency signal

    const pr = lastPRTime;
    const sessionsSincePR = days.reduce((n, d) => (d.time > pr ? n + 1 : n), 0);
    const daysSincePR = Math.max(0, Math.floor((nowTime - pr) / DAY));

    out.set(ex.id, {
      exerciseId: ex.id,
      lastPRDate: new Date(pr),
      daysSincePR,
      sessionsSincePR,
      isPlateau: daysSincePR >= PLATEAU_MIN_DAYS && sessionsSincePR >= PLATEAU_MIN_SESSIONS,
    });
  }

  return out;
}
