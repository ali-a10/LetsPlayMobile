import type { SupabaseClient } from '@supabase/supabase-js';
import { stripe } from './stripe.ts';

/**
 * Issues a FULL Stripe refund for a succeeded payment (platform-initiated → 100%, platform absorbs
 * the Stripe fee, §1) and runs finalize_refund to mark it refunded and free the seat. Idempotent via
 * the `refund_<payment_id>` key; throws if Stripe or the finalize transaction fails.
 */
export async function refundPaymentFull(admin: SupabaseClient, payment: any): Promise<string> {
  const refund = await stripe.refunds.create(
    {
      charge: payment.stripe_charge_id ?? undefined,
      payment_intent: payment.stripe_charge_id ? undefined : payment.stripe_payment_intent_id,
      amount: payment.amount_total_cents,
      metadata: { event_id: payment.event_id, user_id: payment.user_id, payment_id: payment.id },
    },
    { idempotencyKey: `refund_${payment.id}` }
  );
  const { error } = await admin.rpc('finalize_refund', {
    p_payment_id: payment.id,
    p_stripe_refund_id: refund.id,
  });
  if (error) throw new Error(`finalize_refund failed: ${error.message}`);
  return refund.id;
}
