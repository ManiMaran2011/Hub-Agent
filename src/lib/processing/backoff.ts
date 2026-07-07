/**
 * Exponential backoff in minutes, capped, for retrying failed events.
 * Index = retryCount after the failed attempt (1st failure -> retries[0], etc).
 * After MAX_ATTEMPTS total attempts we stop scheduling further retries —
 * the event stays visible as "failed" on the dashboard rather than
 * retrying forever against a permanently broken downstream.
 */
const BACKOFF_MINUTES = [1, 2, 5, 15, 30, 60];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1; // +1 for the initial attempt

export function nextRetryDelayMinutes(retryCountAfterThisFailure: number): number | null {
  const idx = retryCountAfterThisFailure - 1;
  if (idx < 0 || idx >= BACKOFF_MINUTES.length) return null;
  return BACKOFF_MINUTES[idx] as number;
}
