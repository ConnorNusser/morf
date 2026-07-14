// Close-of-week snapshot: when a league surface loads, backfill final results
// for any closed weeks (≤4 back) that aren't stored yet. Service-touching glue —
// the pure logic lives in results.ts/scoring.ts.
import { userSyncService } from '@/lib/services/userSyncService';
import { storageService } from '@/lib/storage/storage';
import {
  LeagueWeekResult,
  mergeResult,
  resultFromStandings,
  weeksNeedingSnapshot,
} from './results';
import { buildStandings } from './scoring';

export async function recordClosedWeeks(now: Date = new Date()): Promise<LeagueWeekResult[]> {
  const stored = await storageService.getLeagueWeekResults();

  try {
    const user = await userSyncService.getCurrentUser();
    if (!user) return stored;

    const missing = weeksNeedingSnapshot(stored.map(r => r.weekStartKey), now);
    let results = stored;
    for (const monday of missing) {
      const end = new Date(monday);
      end.setDate(end.getDate() + 7);
      const rows = await userSyncService.getLeagueWeek(monday, end);
      if (rows.length === 0) continue; // backend unavailable — retry next open
      const result = resultFromStandings(buildStandings(rows, [], user.id), monday);
      // Weeks the user didn't train record nothing (a finish requires being on
      // the board); they re-check until they age out of the backfill window.
      if (result) results = mergeResult(results, result);
    }

    if (results !== stored) await storageService.saveLeagueWeekResults(results);
    return results;
  } catch (error) {
    console.error('Error recording closed league weeks:', error);
    return stored;
  }
}
