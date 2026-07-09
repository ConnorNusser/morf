// Goal-gradient engine: surface the closest locked achievements so the next
// session always has a visible payoff. Effort accelerates as a goal gets near —
// but only if the user can *see* how near it is, so this only returns unlocks
// past MIN_PROGRESS (a bar at 8% demotivates; one at 80% pulls).
import { Achievement } from './achievements';
import { Rarity } from './rarity';

export interface NextUnlock {
  id: string;
  title: string;
  description: string;
  icon: string; // Ionicons name
  rarity: Rarity;
  progress: number; // 0..1, exclusive of 1
  percentLabel: string; // e.g. "82%"
}

const MIN_PROGRESS = 0.4;

// Calendar-time achievements advance whether or not the user trains — a bar
// that fills by itself teaches that effort is irrelevant, so keep them out.
const PASSIVE_IDS = new Set(['member-365', 'member-1000']);

export function computeNextUnlocks(
  achievements: Achievement[],
  limit = 2,
  previous?: Achievement[]
): NextUnlock[] {
  // Prefer unlocks whose progress moved this session: a bar that visibly
  // responds to today's work pulls; one that sits static for weeks habituates.
  const prevProgress = new Map((previous ?? []).map(a => [a.id, a.progress]));
  const moved = (a: Achievement) => {
    const prev = prevProgress.get(a.id);
    return prev !== undefined && a.progress > prev;
  };

  return achievements
    .filter(a => !a.unlocked && !a.hidden && !PASSIVE_IDS.has(a.id) && a.progress >= MIN_PROGRESS && a.progress < 1)
    .sort((x, y) => {
      const xm = moved(x) ? 1 : 0;
      const ym = moved(y) ? 1 : 0;
      return ym - xm || y.progress - x.progress;
    })
    .slice(0, limit)
    .map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      icon: a.icon,
      rarity: a.rarity,
      progress: a.progress,
      percentLabel: `${Math.min(99, Math.round(a.progress * 100))}%`,
    }));
}
