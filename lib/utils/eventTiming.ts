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

/** Hours before a paid event's start within which a host cancellation is "late" and triggers the warning. */
export const LATE_CANCEL_HOURS = 48;

/**
 * Returns true when an event's start is less than LATE_CANCEL_HOURS away — used to show the host
 * the late-cancellation warning. Display affordance only; the cancel-event Edge Function is the enforcer.
 */
export function isWithinLateCancelWindow(eventDateIso: string): boolean {
  const msUntilStart = new Date(eventDateIso).getTime() - Date.now();
  return msUntilStart < LATE_CANCEL_HOURS * 60 * 60 * 1000;
}
