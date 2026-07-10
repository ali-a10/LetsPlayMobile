/**
 * Build-time feature flags.
 *
 * `PAID_EVENTS_ENABLED` gates the entire Stripe payments feature (Phases A–E of the
 * payments spec). While false, hosts see no payouts UI and the create-event paid
 * toggle behaves exactly as it did before payments existed. Flip to true only once
 * the full charge → refund → payout loop is shipped and tested (spec §11/§12.3).
 */
export const PAID_EVENTS_ENABLED = true;
