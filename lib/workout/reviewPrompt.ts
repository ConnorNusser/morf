// When to ask for an App Store review. Pure — the expo-store-review side
// effects live in lib/services/appReview.ts.
//
// Philosophy: ask rarely, and only at a high point. The prompt fires on the
// post-workout celebration screen (never mid-workout), only once the user is
// invested, only after a session that earned something, and never twice in a
// stretch. iOS additionally hard-caps the native sheet at 3 shows per year.

export interface ReviewPromptState {
  lastAskedAt: string | null; // ISO date of the last time we requested the sheet
  askCount: number;
}

export interface ReviewContext {
  totalWorkouts: number;
  // The just-finished session earned a PR / achievement / percentile move.
  hadWin: boolean;
  now: Date;
}

export const EMPTY_REVIEW_STATE: ReviewPromptState = { lastAskedAt: null, askCount: 0 };

// Invested = enough sessions that an opinion exists.
const MIN_WORKOUTS = 5;
// "Occasional": at most one ask every ~2 months from our side.
const MIN_DAYS_BETWEEN_ASKS = 60;

export function shouldRequestReview(state: ReviewPromptState, ctx: ReviewContext): boolean {
  if (ctx.totalWorkouts < MIN_WORKOUTS) return false;
  if (!ctx.hadWin) return false;
  if (state.lastAskedAt) {
    const days = (ctx.now.getTime() - new Date(state.lastAskedAt).getTime()) / 86400000;
    if (days < MIN_DAYS_BETWEEN_ASKS) return false;
  }
  return true;
}
