/**
 * All push-notification copy in one place. Pure string builders with zero imports so this
 * file runs under both Deno (Edge Functions) and Jest (unit tests).
 *
 * COPY RULE: never include dollar amounts in any title or body.
 */

export interface PushCopy {
  title: string;
  body: string;
}

/** Builds the host-facing copy for a participant joining their event. */
export function joinedCopy(firstName: string, eventTitle: string, filled: number, max: number): PushCopy {
  return {
    title: `${firstName} joined ${eventTitle}`,
    body: `${filled} of ${max} spots are now filled.`,
  };
}

/** Builds the host-facing copy for a participant leaving their event. */
export function leftCopy(firstName: string, eventTitle: string, filled: number, max: number): PushCopy {
  return {
    title: `${firstName} left ${eventTitle}`,
    body: `${filled} of ${max} spots are now filled.`,
  };
}

/** Builds the participant-facing copy for a host cancelling an event (refund line only when paid). */
export function eventCancelledCopy(eventTitle: string, isPaid: boolean): PushCopy {
  return {
    title: `${eventTitle} was cancelled`,
    body: isPaid
      ? 'The host cancelled this event. Your refund is on its way.'
      : 'The host cancelled this event.',
  };
}

/** Builds the participant-facing copy for a completed refund (no amount, per product rule). */
export function refundProcessedCopy(eventTitle: string): PushCopy {
  return {
    title: 'Refund processed',
    body: `Your refund for ${eventTitle} has been issued. It can take 5–10 business days to appear on your statement.`,
  };
}

/** Builds the host-facing copy for a payout on its way (no amount, per product rule). */
export function payoutSentCopy(eventTitle: string): PushCopy {
  return {
    title: 'Payout sent',
    body: `Your earnings for ${eventTitle} are on their way to your bank.`,
  };
}

/** Builds the host-facing copy for a Stripe account that can no longer receive payouts. */
export function accountProblemCopy(): PushCopy {
  return {
    title: 'Action needed for payouts',
    body: 'Stripe needs more information to keep sending your payouts. Open Payouts to fix it.',
  };
}

/** Builds the host-facing copy for a chargeback filed against one of their event's payments. */
export function disputeCopy(eventTitle: string): PushCopy {
  return {
    title: 'Payment disputed',
    body: `A payment for ${eventTitle} was disputed. That payout is on hold while it's reviewed.`,
  };
}

/** Builds the host-facing copy for a payout that was pulled back after being sent. */
export function transferReversedCopy(eventTitle: string): PushCopy {
  return {
    title: 'Payout reversed',
    body: `A payout for ${eventTitle} was reversed. Check the Payouts screen for details.`,
  };
}

/** Builds the participant-facing 24-hour reminder (no clock time — server doesn't know user TZ). */
export function reminder24Copy(eventTitle: string, location: string): PushCopy {
  return {
    title: `${eventTitle} is tomorrow`,
    body: `See you at ${location}!`,
  };
}

/** Builds the host-facing 24-hour reminder with the current headcount. */
export function hostReminder24Copy(eventTitle: string, participantCount: number): PushCopy {
  return {
    title: `You're hosting ${eventTitle} tomorrow`,
    body:
      participantCount === 1
        ? '1 person has joined so far.'
        : `${participantCount} people have joined so far.`,
  };
}

/** Builds the participant-facing 2-hour reminder (no clock time — server doesn't know user TZ). */
export function reminder2Copy(eventTitle: string): PushCopy {
  return {
    title: `${eventTitle} starts in about 2 hours`,
    body: 'See you there!',
  };
}

/** Builds the participant-facing post-event nudge pointing at the My Events Past tab. */
export function postEventNudgeCopy(eventTitle: string): PushCopy {
  return {
    title: `How was ${eventTitle}?`,
    body: 'Check your past events in My Events.',
  };
}
