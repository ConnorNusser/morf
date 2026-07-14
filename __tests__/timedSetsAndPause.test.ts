import { workoutTextParser } from '@/lib/workout/workoutTextParser';
import {
  draftFromParsed,
  draftToLogText,
  draftToParsedWorkout,
  updateSet,
} from '@/lib/workout/workoutDraft';
import { pausedSpanSeconds, sessionElapsedSeconds } from '@/lib/workout/sessionClock';

describe('timed set parsing (local)', () => {
  it('parses seconds, m:ss, and minutes tokens as durations', () => {
    const parsed = workoutTextParser.parseLocal('plank 90s, 1:30, 2 min');
    expect(parsed.exercises).toHaveLength(1);
    expect(parsed.exercises[0].sets.map(s => s.duration)).toEqual([90, 90, 120]);
    expect(parsed.exercises[0].sets.every(s => s.weight === 0)).toBe(true);
  });

  it('does not mistake weight×reps for a duration', () => {
    const parsed = workoutTextParser.parseLocal('bench 135x8');
    expect(parsed.exercises[0].sets[0]).toMatchObject({ weight: 135, reps: 8 });
    expect(parsed.exercises[0].sets[0].duration).toBeUndefined();
  });
});

describe('duration through the draft pipeline', () => {
  it('survives parse → draft → save conversion', () => {
    const parsed = workoutTextParser.parseLocal('dead hang 45s');
    let draft = draftFromParsed(parsed);
    expect(draft[0].sets[0].duration).toBe(45);

    draft = updateSet(draft, draft[0].key, 0, { done: true, duration: 62 });
    const out = draftToParsedWorkout(draft);
    expect(out.exercises[0].sets[0].duration).toBe(62);
  });

  it('round-trips through the legacy note text', () => {
    const parsed = workoutTextParser.parseLocal('plank 75s');
    const draft = draftFromParsed(parsed);
    const text = draftToLogText(draft);
    expect(text).toContain('75s');
    const reparsed = workoutTextParser.parseLocal(text);
    expect(reparsed.exercises[0].sets[0].duration).toBe(75);
  });
});

describe('pause-aware session clock', () => {
  const t = (secs: number) => new Date(2026, 6, 14, 8, 0, secs);

  it('runs on wall clock when never paused', () => {
    expect(sessionElapsedSeconds(t(0), t(125), null, 0)).toBe(125);
  });

  it('freezes at pausedAt while paused', () => {
    expect(sessionElapsedSeconds(t(0), t(9999), t(300), 0)).toBe(300);
  });

  it('subtracts accumulated paused spans after resume', () => {
    // paused 08:05:00→08:35:00 (1800s), asked at 08:40:00 → 600s of real work
    expect(sessionElapsedSeconds(t(0), t(2400), null, 1800)).toBe(600);
  });

  it('a paused evening resume shows the morning time, not wall clock', () => {
    const start = new Date(2026, 6, 14, 8, 0, 0);
    const pausedAt = new Date(2026, 6, 14, 8, 32, 0);
    const evening = new Date(2026, 6, 14, 19, 0, 0);
    expect(sessionElapsedSeconds(start, evening, pausedAt, 0)).toBe(32 * 60);
    // resume at 19:00 → pausedTotal grows by the gap; clock picks up at 32:00
    const pausedTotal = pausedSpanSeconds(pausedAt, evening);
    expect(sessionElapsedSeconds(start, new Date(evening.getTime() + 60_000), null, pausedTotal)).toBe(33 * 60);
  });

  it('never goes negative', () => {
    expect(sessionElapsedSeconds(t(10), t(0), null, 0)).toBe(0);
    expect(sessionElapsedSeconds(null, t(100), null, 0)).toBe(0);
  });
});
