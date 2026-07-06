// Absolute strength "clubs" keyed off the powerlifting total — the combined
// best estimated 1RM of squat, bench and deadlift. The 1,000 lb club is the
// iconic one; the ladder around it gives a believable rarity curve. Derived from
// the same main-lift PRs the Career already computes — no new tracking.
import { StrengthTierBase } from '@/lib/data/strengthStandards';
import { Achievement } from './achievements';
import { LiftPR } from './personalRecords';
import { Rarity } from './rarity';

const SQUAT = 'squat-barbell';
const BENCH = 'bench-press-barbell';
const DEADLIFT = 'deadlift-barbell';

interface TotalTier {
  id: string;
  title: string;
  icon: string;
  rarity: Rarity;
  target: number; // lb total
}

// Each club maps onto the app's strength-tier ladder, so club color = tier
// color everywhere: E grey at the bottom climbing to S gold at 1,500 — the
// summit; totals beyond it are pro-lifter territory, not app-ladder territory.
export const TOTAL_CLUB_TIERS: Record<number, StrengthTierBase> = {
  600: 'E',
  800: 'D',
  1000: 'C',
  1200: 'B',
  1300: 'A',
  1500: 'S',
};

const TIERS: TotalTier[] = [
  { id: 'total-600', title: '600 lb Club', icon: 'barbell', rarity: 'common', target: 600 },
  { id: 'total-800', title: '800 lb Club', icon: 'barbell', rarity: 'rare', target: 800 },
  { id: 'total-1000', title: 'Thousand-Pound Club', icon: 'trophy', rarity: 'epic', target: 1000 },
  { id: 'total-1200', title: 'Twelve Hundred', icon: 'medal', rarity: 'epic', target: 1200 },
  { id: 'total-1300', title: 'Thirteen Hundred', icon: 'ribbon', rarity: 'legendary', target: 1300 },
  { id: 'total-1500', title: 'Fifteen Hundred', icon: 'trophy', rarity: 'legendary', target: 1500 },
];

// `prsLbs` must be in lbs (the total is an absolute, unit-specific milestone).
export function computeStrengthFeats(prsLbs: LiftPR[]): Achievement[] {
  const e1rm = (id: string) => prsLbs.find(p => p.exerciseId === id)?.estimatedOneRM ?? 0;
  const total = Math.round(e1rm(SQUAT) + e1rm(BENCH) + e1rm(DEADLIFT));

  return TIERS.map(t => ({
    id: t.id,
    title: t.title,
    description: `Squat, bench and deadlift add up to ${t.target.toLocaleString()} lb`,
    icon: t.icon,
    category: 'strength' as const,
    rarity: t.rarity,
    current: total,
    target: t.target,
    unlocked: total >= t.target,
    progress: Math.max(0, Math.min(1, total / t.target)),
  }));
}
