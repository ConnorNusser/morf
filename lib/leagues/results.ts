// Closed-week league results — the append-only local record league achievements
// compute from. This is the one deliberate exception to achievements-from-local-
// history: a league finish depends on other users' server data, so it's
// snapshotted once when a week closes and never recomputed (see spec).
import { dateKey, weekStart } from '@/lib/utils/utils';
import { SCORING } from './types';
import { LeagueStandings } from './scoring';

export interface LeagueWeekResult {
  /** Local-date key (YYYY-MM-DD) of the week's Monday. */
  weekStartKey: string;
  rank: number;
  points: number;
  activeParticipants: number;
}

/** A win only counts against a real field. */
export function isWin(result: LeagueWeekResult): boolean {
  return result.rank === 1 && result.activeParticipants >= SCORING.minParticipantsForWin;
}

export function isPodium(result: LeagueWeekResult): boolean {
  return result.rank <= 3 && result.activeParticipants >= SCORING.minParticipantsForPodium;
}

/** The viewer's final line for a closed week, or null if they didn't train. */
export function resultFromStandings(
  standings: LeagueStandings,
  weekStartDate: Date,
): LeagueWeekResult | null {
  const me = standings.me;
  if (!me || me.rank == null) return null;
  return {
    weekStartKey: dateKey(weekStartDate),
    rank: me.rank,
    points: me.points,
    activeParticipants: standings.active.length,
  };
}

/**
 * Mondays of closed weeks with no stored result yet, oldest first, capped at
 * `maxBack` weeks before the current one. Drives the on-open snapshot backfill.
 */
export function weeksNeedingSnapshot(
  recordedKeys: string[],
  now: Date = new Date(),
  maxBack: number = 4,
): Date[] {
  const recorded = new Set(recordedKeys);
  const missing: Date[] = [];
  for (let weeksAgo = maxBack; weeksAgo >= 1; weeksAgo--) {
    const monday = weekStart(now);
    monday.setDate(monday.getDate() - 7 * weeksAgo);
    if (!recorded.has(dateKey(monday))) missing.push(monday);
  }
  return missing;
}

/** Idempotent append — a week already recorded is never overwritten. */
export function mergeResult(
  stored: LeagueWeekResult[],
  result: LeagueWeekResult,
): LeagueWeekResult[] {
  if (stored.some(r => r.weekStartKey === result.weekStartKey)) return stored;
  return [...stored, result].sort((a, b) => a.weekStartKey.localeCompare(b.weekStartKey));
}

/** Longest run of wins in consecutive calendar weeks. */
export function longestWinStreak(results: LeagueWeekResult[]): number {
  const winMondays = results
    .filter(isWin)
    .map(r => r.weekStartKey)
    .sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of winMondays) {
    run = prev != null && key === nextWeekKey(prev) ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = key;
  }
  return longest;
}

function nextWeekKey(mondayKey: string): string {
  const [y, m, d] = mondayKey.split('-').map(Number);
  const next = new Date(y, m - 1, d);
  next.setDate(next.getDate() + 7);
  return dateKey(next);
}
