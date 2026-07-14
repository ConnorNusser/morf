// League achievements — computed from the append-only LeagueWeekResult store
// (lib/leagues/results.ts), NOT from workout history: a league finish depends on
// other users' data and can't be recomputed locally. Merged into snapshots via
// buildRewardSnapshot alongside the niche set.
import { isPodium, isWin, LeagueWeekResult, longestWinStreak } from '@/lib/leagues/results';
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
