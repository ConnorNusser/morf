// Pause-aware workout clock. Elapsed = (pause-frozen now) − start − paused
// spans; wall-clock derived so it survives restarts (persisted with the
// session). Pure + clock-injectable, node-tested.
export function sessionElapsedSeconds(
  startTime: Date | null,
  now: Date,
  pausedAt: Date | null,
  pausedTotalSeconds: number,
): number {
  if (!startTime) return 0;
  const end = pausedAt ?? now;
  return Math.max(0, Math.floor((end.getTime() - startTime.getTime()) / 1000) - pausedTotalSeconds);
}

/** Seconds to add to pausedTotal when resuming at `now`. */
export function pausedSpanSeconds(pausedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - pausedAt.getTime()) / 1000));
}
