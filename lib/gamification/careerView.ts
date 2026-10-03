// View-model helpers for the Career screen. Pure: everything here is derived from
// the already-computed career data (achievements, stats, heatmap) — no storage, no React.
import type { AchievementModalItem } from '@/components/gamification/AchievementModal';
import {
  Achievement,
  AchievementCategory,
  achievementDisplay,
  rarityBreakdown,
  RarityCount,
} from './achievements';
import { CareerStats, formatCompact } from './careerStats';
import { Rarity } from './rarity';
import { TrainingHeatmap } from './trainingHeatmap';

export function cleanExerciseName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// ---- Lifetime stat grid shown in the hero/share card ----
// All six lifetime datapoints live here alongside the percentile (they used to
// be split: three here, all six again in a separate "Lifetime" section below).
export function shareStatItems(stats: CareerStats): { v: string; l: string }[] {
  return [
    { v: `${formatCompact(stats.totalVolume)} ${stats.unit}`, l: 'lifted' },
    { v: formatCompact(stats.totalWorkouts), l: 'workouts' },
    { v: formatCompact(stats.daysActive), l: 'days active' },
    { v: `${stats.longestStreak}w`, l: 'best streak' },
    { v: formatCompact(stats.totalSets), l: 'sets' },
    { v: formatCompact(stats.totalReps), l: 'reps' },
  ];
}

// ---- Recent achievements: the six you unlocked most recently ----
// Ordered by the real first-unlocked timestamp (storageService stamps each badge
// when it's first seen unlocked). Badges without a stored date, or that tie on the
// same day (e.g. the initial backfill), fall back to how narrowly they cleared
// their target (current/target closest to 1) — a decent "just crossed" proxy.
export function recentAchievements(
  achievements: Achievement[],
  unlockedAt: Record<string, string>,
): Achievement[] {
  const at = (a: Achievement) => {
    const d = unlockedAt[a.id];
    return d ? Date.parse(d) : 0;
  };
  return achievements
    .filter(a => a.unlocked)
    .sort((a, b) => at(b) - at(a) || a.current / a.target - b.current / b.target)
    .slice(0, 6);
}

// One achievement mapped to the full-screen spotlight — the same modal the
// History sessions feed opens, so badges behave identically everywhere.
export function toSpotlight(a: Achievement): AchievementModalItem {
  const display = achievementDisplay(a);
  const pct = Math.round(a.progress * 100);
  return {
    id: a.id,
    title: display.title,
    description: display.description,
    icon: display.icon,
    rarity: a.rarity,
    unlocked: a.unlocked,
    masked: display.masked,
    progressLabel:
      a.unlocked || display.masked
        ? undefined
        : `${formatCompact(a.current)} / ${formatCompact(a.target)} · ${pct}%`,
  };
}

// ---- Consistency heatmap ----
// The actual span shown, so the timeframe is explicit (not just "12 wks").
export function heatmapRangeLabel(heatmap: TrainingHeatmap): string {
  const cells = heatmap.weeks.flat();
  const first = cells[0]?.date;
  const lastReal = [...cells].reverse().find(c => !c.future)?.date ?? first;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return first && lastReal ? `${fmt(first)} – ${fmt(lastReal)}` : '';
}

// A month abbreviation above the first week that lands in a new month.
export function heatmapMonthLabels(heatmap: TrainingHeatmap): string[] {
  return heatmap.weeks.map((week, w) => {
    const m = week[0].date.getMonth();
    const prev = w > 0 ? heatmap.weeks[w - 1][0].date.getMonth() : -1;
    return m !== prev ? week[0].date.toLocaleDateString('en-US', { month: 'short' }) : '';
  });
}

// ---- Achievement grid ----
export type AchievementFilter = 'all' | AchievementCategory;

export interface AchievementGroup {
  key: string;
  label: string;
  items: Achievement[];
}

export interface AchievementGrid {
  breakdown: RarityCount[]; // per-rarity counts within the category filter
  filtered: Achievement[];
  unlocked: number;
  groups: AchievementGroup[];
}

export function buildAchievementGrid(
  achievements: Achievement[],
  filter: AchievementFilter,
  rarityFilter: Rarity | null,
  newIds: Set<string>,
): AchievementGrid {
  // Category narrows first; the rarity (tier) chips narrow within it.
  const byCategory = achievements.filter(a => filter === 'all' || a.category === filter);
  const breakdown = rarityBreakdown(byCategory);
  const filtered = byCategory.filter(a => rarityFilter === null || a.rarity === rarityFilter);
  const unlocked = filtered.filter(a => a.unlocked).length;

  // Group by status so "done", "close", and "not started" read at a glance,
  // instead of one flat grid where completion is hard to spot.
  const completed = filtered
    .filter(a => a.unlocked)
    .sort((a, b) => {
      const an = newIds.has(a.id) ? 1 : 0;
      const bn = newIds.has(b.id) ? 1 : 0;
      return bn - an; // newly unlocked first
    });
  const inProgress = filtered
    .filter(a => !a.unlocked && !a.hidden && a.progress > 0)
    .sort((a, b) => b.progress - a.progress); // closest first
  const locked = filtered.filter(a => !a.unlocked && (a.hidden || a.progress <= 0));

  const groups: AchievementGroup[] = [
    { key: 'progress', label: 'In progress', items: inProgress },
    { key: 'done', label: 'Completed', items: completed },
    { key: 'locked', label: 'Locked', items: locked },
  ];

  return { breakdown, filtered, unlocked, groups };
}
