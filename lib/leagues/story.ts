// The Week Story: replay the week's raw events (sessions, PRs) through the
// scoring rules so every moment carries the points it actually earned and lead
// changes fall out of the replay. Pure — node-tested, no network.
import { dateKey } from '@/lib/utils/utils';
import { scoreMember } from './scoring';
import { LeagueMemberAggregates, LeaguePrAggregate } from './types';

export interface LeagueEvent {
  userId: string;
  username: string;
  profilePictureUrl: string | null;
  isFriend: boolean;
  kind: 'session' | 'pr';
  /** ISO timestamp. */
  occurredAt: string;
  exerciseId?: string;
  gainPct?: number;
  title?: string;
  /** session only — Σ weight×reps in lbs. */
  volumeLbs?: number;
}

export interface StoryMoment {
  event: LeagueEvent;
  /** Points this event added under the scoring rules (0 once capped), excluding bonusPoints. */
  points: number;
  /** Goal-bonus points this event unlocked (its own narrative beat). */
  bonusPoints: number;
  /** This event moved its user into (sole) first place. */
  tookLead: boolean;
  /** User's total after the event. */
  totalAfter: number;
}

export interface StoryDay {
  dayKey: string; // local YYYY-MM-DD
  /** MON…SUN, or TODAY for the current day. */
  label: string;
  moments: StoryMoment[];
}

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const dayLabelFor = (date: Date, now: Date): string =>
  dateKey(date) === dateKey(now) ? 'TODAY' : DAY_LABELS[(date.getDay() + 6) % 7];

/** Minimal per-user tally the replay scores against. */
interface Tally {
  dayKeys: Set<string>;
  volumeLbs: number;
  prs: LeaguePrAggregate[];
}

const scoreTally = (tally: Tally): { total: number; goalBonus: number } => {
  const breakdown = scoreMember({
    user_id: '',
    username: '',
    profile_picture_url: null,
    sessions: tally.dayKeys.size,
    active_days: tally.dayKeys.size,
    volume_lbs: tally.volumeLbs,
    prs: tally.prs,
    new_lifts: 0,
    is_friend: false,
  } as LeagueMemberAggregates);
  return { total: breakdown.total, goalBonus: breakdown.goalBonus };
};

/**
 * Chronological replay of the week. Every session counts (volume points), and
 * leads are sole leads — a tie doesn't "take" anything.
 */
export function buildWeekStory(events: LeagueEvent[], now: Date = new Date()): StoryDay[] {
  const ordered = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const tallies = new Map<string, Tally>();
  const totals = new Map<string, number>();
  const bonuses = new Map<string, number>();
  const days: StoryDay[] = [];
  let leaderId: string | null = null;

  const tallyFor = (userId: string): Tally => {
    let tally = tallies.get(userId);
    if (!tally) {
      tally = { dayKeys: new Set(), volumeLbs: 0, prs: [] };
      tallies.set(userId, tally);
    }
    return tally;
  };

  for (const event of ordered) {
    const when = new Date(event.occurredAt);
    const dayKeyValue = dateKey(when);
    const tally = tallyFor(event.userId);

    if (event.kind === 'session') {
      // Every session moves iron — same-day repeats keep earning volume points.
      tally.dayKeys.add(dayKeyValue);
      tally.volumeLbs += Math.max(event.volumeLbs ?? 0, 0);
    } else {
      tally.prs.push({
        exercise_id: event.exerciseId ?? '',
        week_best: 0,
        prior_best: 0,
        gain_pct: event.gainPct ?? 0,
      });
    }

    const before = totals.get(event.userId) ?? 0;
    const bonusBefore = bonuses.get(event.userId) ?? 0;
    const { total: after, goalBonus: bonusAfter } = scoreTally(tally);
    totals.set(event.userId, after);
    bonuses.set(event.userId, bonusAfter);

    // Sole leader after this event?
    let maxTotal = 0;
    let maxUser: string | null = null;
    let tied = false;
    for (const [userId, total] of totals) {
      if (total > maxTotal) {
        maxTotal = total;
        maxUser = userId;
        tied = false;
      } else if (total === maxTotal && userId !== maxUser) {
        tied = true;
      }
    }
    const newLeader: string | null = !tied && maxUser != null ? maxUser : leaderId;
    // The week's first scorer "leads" trivially — that's not a story beat.
    const tookLead = leaderId !== null && newLeader !== leaderId && newLeader === event.userId;
    leaderId = newLeader;

    const bonusPoints = Math.max(0, bonusAfter - bonusBefore);
    const moment: StoryMoment = {
      event,
      points: Math.max(0, after - before - bonusPoints),
      bonusPoints,
      tookLead,
      totalAfter: after,
    };

    const last = days[days.length - 1];
    if (last && last.dayKey === dayKeyValue) {
      last.moments.push(moment);
    } else {
      days.push({ dayKey: dayKeyValue, label: dayLabelFor(when, now), moments: [moment] });
    }
  }

  return days;
}
