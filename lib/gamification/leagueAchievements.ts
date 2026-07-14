// League achievements — computed from the append-only LeagueWeekResult store
// (lib/leagues/results.ts), NOT from workout history: a league finish depends on
// other users' data and can't be recomputed locally. Merged into snapshots via
// buildRewardSnapshot alongside the niche set.
import { isPodium, isWin, LeagueWeekResult, longestWinStreak } from '@/lib/leagues/results';
import { SCORING } from '@/lib/leagues/types';
import { dateKey, weekStart } from '@/lib/utils/utils';
import { Achievement } from './achievements';

interface LeagueAchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string; // Ionicons fallback — emblems in achievementEmblems.ts are the real face
  rarity: Achievement['rarity'];
  target: number;
  metric: (results: LeagueWeekResult[]) => number;
}

const wins = (results: LeagueWeekResult[]) => results.filter(isWin).length;

const DEFS: LeagueAchievementDef[] = [
  { id: 'league-first', title: 'Contender', description: 'Finish a league week on the board', icon: 'flag', rarity: 'common', target: 1, metric: r => r.length },
  { id: 'league-podium', title: 'On the Board', description: 'Finish a league week in the top 3', icon: 'podium', rarity: 'common', target: 1, metric: r => r.filter(isPodium).length },
  { id: 'league-win-1', title: 'Champion', description: 'Win a weekly league', icon: 'trophy', rarity: 'rare', target: 1, metric: wins },
  { id: 'league-win-3', title: 'Back for More', description: 'Win 3 weekly leagues', icon: 'trophy', rarity: 'epic', target: 3, metric: wins },
  { id: 'league-win-10', title: 'Dynasty', description: 'Win 10 weekly leagues', icon: 'ribbon', rarity: 'legendary', target: 10, metric: wins },
  { id: 'league-streak-3', title: 'Undisputed', description: 'Win 3 league weeks in a row', icon: 'medal', rarity: 'epic', target: 3, metric: longestWinStreak },
];

/** Wins in the weeks immediately preceding the current one (streak still alive). */
function trailingWinStreak(results: LeagueWeekResult[], now: Date): number {
  const wins = new Set(results.filter(isWin).map(r => r.weekStartKey));
  let streak = 0;
  const monday = weekStart(now);
  for (;;) {
    monday.setDate(monday.getDate() - 7);
    if (wins.has(dateKey(monday))) streak += 1;
    else break;
  }
  return streak;
}

export interface LeagueUpForGrabs {
  id: string;
  title: string;
  /** What finishing the week like this earns/needs. */
  hint: string;
}

/**
 * The league achievement the CURRENT week is playing for, given live rank and
 * field size — the card's one-line answer to "why finish this week".
 */
export function upForGrabs(
  results: LeagueWeekResult[],
  currentRank: number | null,
  field: number,
  now: Date = new Date(),
): LeagueUpForGrabs | null {
  const winCount = results.filter(isWin).length;
  const podiumCount = results.filter(isPodium).length;

  if (results.length === 0) {
    return { id: 'league-first', title: 'Contender', hint: 'Finish the week on the board' };
  }

  const holdingFirst = currentRank === 1 && field >= SCORING.minParticipantsForWin;
  if (holdingFirst) {
    if (trailingWinStreak(results, now) >= 2) {
      return { id: 'league-streak-3', title: 'Undisputed', hint: 'Hold #1 for a third straight week' };
    }
    if (winCount === 0) return { id: 'league-win-1', title: 'Champion', hint: 'Hold #1 through Sunday' };
    if (winCount < 3) return { id: 'league-win-3', title: 'Back for More', hint: 'Hold #1 through Sunday' };
    if (winCount < 10) return { id: 'league-win-10', title: 'Dynasty', hint: 'Hold #1 through Sunday' };
  }

  if (
    podiumCount === 0 &&
    currentRank != null &&
    currentRank <= 3 &&
    field >= SCORING.minParticipantsForPodium
  ) {
    return { id: 'league-podium', title: 'On the Board', hint: 'Hold top 3 through Sunday' };
  }

  if (winCount === 0) {
    return { id: 'league-win-1', title: 'Champion', hint: 'Take #1 to earn it' };
  }
  const nextWinTarget = winCount < 3 ? { id: 'league-win-3', title: 'Back for More', target: 3 } : winCount < 10 ? { id: 'league-win-10', title: 'Dynasty', target: 10 } : null;
  if (nextWinTarget) {
    const need = nextWinTarget.target - winCount;
    return { id: nextWinTarget.id, title: nextWinTarget.title, hint: `${need} more win${need === 1 ? '' : 's'}` };
  }
  return null;
}

export function computeLeagueAchievements(results: LeagueWeekResult[]): Achievement[] {
  return DEFS.map(def => {
    const current = def.metric(results);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      category: 'special',
      rarity: def.rarity,
      current,
      target: def.target,
      unlocked: current >= def.target,
      progress: Math.min(current / def.target, 1),
    };
  });
}
