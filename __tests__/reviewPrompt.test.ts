import {
  EMPTY_REVIEW_STATE,
  ReviewPromptState,
  shouldRequestReview,
} from '../lib/workout/reviewPrompt';

const NOW = new Date('2026-07-09T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
const ctx = (over: Partial<{ totalWorkouts: number; hadWin: boolean }> = {}) => ({
  totalWorkouts: 10,
  hadWin: true,
  now: NOW,
  ...over,
});

describe('shouldRequestReview', () => {
  it('asks an invested user after a winning session', () => {
    expect(shouldRequestReview(EMPTY_REVIEW_STATE, ctx())).toBe(true);
  });

  it('never asks before 5 workouts', () => {
    expect(shouldRequestReview(EMPTY_REVIEW_STATE, ctx({ totalWorkouts: 4 }))).toBe(false);
    expect(shouldRequestReview(EMPTY_REVIEW_STATE, ctx({ totalWorkouts: 5 }))).toBe(true);
  });

  it('only asks on sessions that earned something', () => {
    expect(shouldRequestReview(EMPTY_REVIEW_STATE, ctx({ hadWin: false }))).toBe(false);
  });

  it('waits at least 60 days between asks', () => {
    const recent: ReviewPromptState = { lastAskedAt: daysAgo(30), askCount: 1 };
    const stale: ReviewPromptState = { lastAskedAt: daysAgo(61), askCount: 1 };
    expect(shouldRequestReview(recent, ctx())).toBe(false);
    expect(shouldRequestReview(stale, ctx())).toBe(true);
  });
});
