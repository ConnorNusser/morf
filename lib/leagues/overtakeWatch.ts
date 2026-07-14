// Overtake detection around a workout sync: snapshot standings when the workout
// finishes, re-fetch once the sync lands, push to friends the viewer moved past.
// Direction-safe under races — if the "before" fetch already saw the new lifts,
// the diff is empty and nobody gets pushed.
import { notificationService } from '@/lib/services/notificationService';
import { userSyncService } from '@/lib/services/userSyncService';
import { buildStandings, detectOvertakes, weekBounds } from './scoring';

/**
 * Call BEFORE kicking off syncLifts/syncWorkout (captures the pre-sync board),
 * then hand the returned function a promise that settles when the sync is done.
 * Fully fire-and-forget; never throws.
 */
export function beginOvertakeWatch(now: Date = new Date()): (synced: Promise<unknown>) => void {
  const { start, end } = weekBounds(now);

  const beforePromise = (async () => {
    const user = await userSyncService.getCurrentUser();
    if (!user) return null;
    const rows = await userSyncService.getLeagueWeek(start, end);
    return { user, before: buildStandings(rows, [], user.id) };
  })().catch(() => null);

  return (synced: Promise<unknown>) => {
    synced
      .then(async () => {
        const ctx = await beforePromise;
        if (!ctx) return;

        const after = buildStandings(await userSyncService.getLeagueWeek(start, end), [], ctx.user.id);
        const passedIds = detectOvertakes(ctx.before, after, ctx.user.id);
        if (passedIds.length === 0 || !after.me) return;

        const overtaken = passedIds
          .map(id => after.active.find(s => s.userId === id))
          .filter(s => s != null)
          .map(s => ({ userId: s!.userId, points: s!.points }));
        const daysLeft = Math.max(1, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

        await notificationService.notifyLeagueOvertakes(
          overtaken,
          ctx.user.username,
          after.me.points,
          daysLeft,
        );
      })
      .catch(err => {
        console.error('Error checking league overtakes:', err);
      });
  };
}
