// Side-effect wrapper around the review-prompt gate: loads state, asks the
// native sheet, persists the ask. Called fire-and-forget from the celebration
// screen — never mid-workout, never blocking, never throwing.
import { storageService } from '@/lib/storage/storage';
import { shouldRequestReview } from '@/lib/workout/reviewPrompt';
import * as StoreReview from 'expo-store-review';

// Delay so the celebration (embers, count-ups) lands before the sheet slides over it.
const CELEBRATION_SETTLE_MS = 2500;

export async function maybeAskForReview(ctx: {
  totalWorkouts: number;
  hadWin: boolean;
}): Promise<void> {
  try {
    const state = await storageService.getReviewPromptState();
    if (!shouldRequestReview(state, { ...ctx, now: new Date() })) return;
    if (!(await StoreReview.isAvailableAsync())) return;

    // Mark as asked up front so a re-entry can't double-fire; iOS decides
    // whether the sheet actually shows (hard-capped at 3/year).
    await storageService.setReviewPromptState({
      lastAskedAt: new Date().toISOString(),
      askCount: state.askCount + 1,
    });

    setTimeout(() => {
      StoreReview.requestReview().catch(() => {});
    }, CELEBRATION_SETTLE_MS);
  } catch (error) {
    console.error('Review prompt failed:', error);
  }
}
