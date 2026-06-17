/**
 * Shared event-timing rules. The 12-hour cutoff is the one place the threshold
 * lives on the client; the server (RPCs / Edge Functions) is the real enforcer.
 */

/** Hours before an event's start after which a participant can no longer leave / cancel their spot. */
export const LEAVE_CUTOFF_HOURS = 12;

/**
 * Returns true when an event's start is less than LEAVE_CUTOFF_HOURS away (or already past).
 * Display affordance only — the leave_event RPC enforces this server-side against now().
 */
export function isWithinLeaveCutoff(eventDateIso: string): boolean {
  const msUntilStart = new Date(eventDateIso).getTime() - Date.now();
  return msUntilStart < LEAVE_CUTOFF_HOURS * 60 * 60 * 1000;
}
