import { buildWeekStory, LeagueEvent } from '@/lib/leagues/story';
import { SCORING } from '@/lib/leagues/types';

// Week of Mon 2026-07-06; "now" is Sunday so no TODAY collisions unless asked.
const NOW = new Date(2026, 6, 12, 12, 0);

const session = (userId: string, iso: string, title = 'Workout'): LeagueEvent => ({
  userId,
  username: userId,
  profilePictureUrl: null,
  isFriend: false,
  kind: 'session',
  occurredAt: iso,
  title,
});

const pr = (userId: string, iso: string, exerciseId: string, gainPct: number): LeagueEvent => ({
  userId,
  username: userId,
  profilePictureUrl: null,
  isFriend: false,
  kind: 'pr',
  occurredAt: iso,
  exerciseId,
  gainPct,
});

describe('buildWeekStory', () => {
  it('scores a session day and groups by local day with weekday labels', () => {
    const days = buildWeekStory([session('a', '2026-07-06T17:00:00')], NOW);
    expect(days).toHaveLength(1);
    expect(days[0].label).toBe('MON');
    expect(days[0].moments[0].points).toBe(SCORING.pointsPerActiveDay);
  });

  it('labels the current day TODAY', () => {
    const days = buildWeekStory([session('a', '2026-07-12T09:00:00')], NOW);
    expect(days[0].label).toBe('TODAY');
  });

  it('drops same-day repeat sessions from the story', () => {
    const days = buildWeekStory(
      [session('a', '2026-07-06T08:00:00'), session('a', '2026-07-06T18:00:00')],
      NOW,
    );
    expect(days[0].moments).toHaveLength(1);
  });

  it('a PR carries base points plus its gain bonus', () => {
    const days = buildWeekStory([pr('a', '2026-07-07T10:00:00', 'bench-press', 4.7)], NOW);
    expect(days[0].moments[0].points).toBe(SCORING.pointsPerPR + Math.round(SCORING.gainBonusPerPct * 4.7));
  });

  it('capped events still appear but earn zero', () => {
    const sessions = Array.from({ length: 6 }, (_, i) =>
      session('a', `2026-07-${String(6 + i).padStart(2, '0')}T10:00:00`),
    );
    const days = buildWeekStory(sessions, NOW);
    const points = days.map(d => d.moments[0].points);
    // The goal bonus is split out as its own beat; days 5-6 pass the cap.
    expect(points).toEqual([10, 10, 10, 10, 0, 0]);
    expect(days.map(d => d.moments[0].bonusPoints)).toEqual([0, 0, SCORING.goalBonus, 0, 0, 0]);
  });

  it('detects a sole lead change on the event that caused it', () => {
    const days = buildWeekStory(
      [
        session('a', '2026-07-06T08:00:00'), // a: 10, sole lead
        session('b', '2026-07-06T09:00:00'), // b: 10, tie — a keeps the lead
        pr('b', '2026-07-06T09:30:00', 'squat', 3.0), // b: 31 — takes the lead
      ],
      NOW,
    );
    const moments = days[0].moments;
    expect(moments[0].tookLead).toBe(false); // first scorer of the week is not a beat
    expect(moments[1].tookLead).toBe(false); // tie doesn't take anything
    expect(moments[2].tookLead).toBe(true);
    expect(moments[2].event.userId).toBe('b');
  });

  it('orders out-of-order input chronologically', () => {
    const days = buildWeekStory(
      [session('a', '2026-07-08T10:00:00'), session('a', '2026-07-06T10:00:00')],
      NOW,
    );
    expect(days.map(d => d.label)).toEqual(['MON', 'WED']);
  });

  it('empty events → empty story', () => {
    expect(buildWeekStory([], NOW)).toEqual([]);
  });
});
