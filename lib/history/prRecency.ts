import { ExerciseWithMax } from '@/types';
import { dayKeyOf, e1rmLbs } from '@/components/history/liftSeries';

// Clock-injectable "how long since this lift last set a record" signal. Reuses buildPRDays'
// (prSessions.ts) day-bucket walk, then counts training days after the most-recent record.

const DAY = 24 * 60 * 60 * 1000;

// Plateau flagged once BOTH thresholds are cleared with no PR.
export const PLATEAU_MIN_DAYS = 21;
export const PLATEAU_MIN_SESSIONS = 4;

export interface PRRecency {
  exerciseId: string;
  lastPRDate: Date; // most-recent all-time-best training day
  daysSincePR: number;
  sessionsSincePR: number; // distinct training days strictly after the last PR day
  isPlateau: boolean;
}

interface DayBucket {
  time: number;
  bestLbs: number;
}

// Exercises that never set a record are OMITTED. `now` injected for deterministic tests.
export function computePRRecency(exerciseStats: ExerciseWithMax[], now: Date): Map<string, PRRecency> {
  const out = new Map<string, PRRecency>();
  const nowTime = now.getTime();

  for (const ex of exerciseStats) {
    if (!ex.history || ex.history.length === 0) continue;

    // One bucket per training day, best e1RM — identical to buildPRDays, so plateau never
    // disagrees with a chip.
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
      // i > 0: first-ever day beats nothing, never a record.
      if (i > 0 && day.bestLbs > runningMax) lastPRTime = day.time;
      if (day.bestLbs > runningMax) runningMax = day.bestLbs;
    }

    if (lastPRTime === null) continue; // no record → no recency signal

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
