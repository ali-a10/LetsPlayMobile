/**
 * Single source of truth for analytics event names and their properties.
 * Adding an event = adding a key here; `track()` is typed against this map.
 *
 * Privacy rule: properties may contain ids, enums, booleans, and numbers ONLY.
 * Never emails, names, free-text input, or raw Stripe error messages.
 */
export type AnalyticsEvents = {
  // Onboarding & activation
  signup_completed: { method: 'email' };
  profile_completed: Record<string, never>;

  // Core loop. First-ever event_join_confirmed per user = the "aha moment";
  // compute it in PostHog with a first-time-occurrence filter, not a separate event.
  event_viewed: { event_id: string; sport: string; is_paid: boolean };
  event_created: {
    sport: string;
    is_paid: boolean;
    price_cents: number | null;
    max_participants: number;
  };
  event_join_confirmed: { event_id: string; is_paid: boolean };

  // Paid-join funnel (stage enum only — never Stripe error text)
  payment_sheet_opened: { event_id: string };
  payment_succeeded: { event_id: string };
  payment_failed: {
    event_id: string;
    stage: 'create-intent' | 'init-sheet' | 'present-sheet' | 'confirm';
  };

  // Cancellations (churn-risk / broken-promise signals)
  spot_cancelled: { event_id: string; was_paid: boolean };
  event_cancelled_by_host: { event_id: string };

  // Growth & engagement
  share_tapped: { event_id: string; sport: string };
  search_performed: { query_length: number; result_count: number };
  notification_opened: { target: string };
  feedback_submitted: { category: string };
};

export type AnalyticsEventName = keyof AnalyticsEvents;
