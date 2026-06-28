import { corsHeaders, json, fail } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';

/**
 * Refunds a participant who cancels their own paid spot (§7.1): verifies they hold a succeeded
 * payment, enforces the 12-hour window in SQL, issues a partial Stripe refund (the participant
 * bears the processing fee), then runs the shared finalize_refund transaction to free the seat.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await getUserFromRequest(req, admin);
    if (!user) return fail('UNAUTHORIZED', 'You must be signed in.', 401);

    const { event_id } = await req.json().catch(() => ({}));
    if (!event_id) return fail('EVENT_NOT_FOUND', 'No event specified.', 400);

    // 1. Find the caller's succeeded payment for this event.
    const { data: payment } = await admin
      .from('payments')
      .select('*')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .eq('status', 'succeeded')
      .maybeSingle();
    if (!payment) {
      return fail('PAYMENT_NOT_CONFIRMED', "We couldn't find a payment to refund for this event.", 404);
    }

    // 2. Enforce the 12-hour window in Postgres (time math never runs in JS — §1).
    //    The guard raises P0005 inside the window, P0002 if the event vanished.
    const { error: windowErr } = await admin.rpc('assert_refund_window_open', {
      p_event_id: event_id,
    });
    if (windowErr) {
      if (windowErr.code === 'P0005') {
        return fail('REFUND_WINDOW_CLOSED', "You can't cancel your spot within 12 hours of the event start.", 409);
      }
      if (windowErr.code === 'P0002') {
        return fail('EVENT_NOT_FOUND', 'This event no longer exists.', 404);
      }
      throw new Error(`assert_refund_window_open failed: ${windowErr.message}`);
    }

    // 3. Refund all but the Stripe fee — participant bears the processing fee, platform fee is
    //    returned (§1/§7.1). Amounts come from the stored payment row, never recomputed.
    const refundAmount = payment.amount_total_cents - payment.amount_stripe_fee_cents;
    let refund;
    try {
      refund = await stripe.refunds.create(
        {
          charge: payment.stripe_charge_id ?? undefined,
          payment_intent: payment.stripe_charge_id ? undefined : payment.stripe_payment_intent_id,
          amount: refundAmount,
          metadata: { event_id, user_id: user.id, payment_id: payment.id },
        },
        // Same key on any retry/double-tap → Stripe returns the original refund, never pays twice.
        { idempotencyKey: `refund_${payment.id}` }
      );
    } catch (stripeErr) {
      console.error('refund-participant Stripe refund failed:', stripeErr);
      return fail('REFUND_FAILED', 'We could not process your refund. Please try again.', 502);
    }

    // 4. Finalize in one transaction: mark refunded, remove participant, free the seat.
    //    If this throws after the refund already went through, the money is back but the seat
    //    isn't freed — surfaced as INTERNAL ("try again"), and a retry self-heals (the idempotency
    //    key returns the same refund and finalize_refund re-runs). C2's charge.refunded webhook is
    //    the async backstop.
    const { error: finErr } = await admin.rpc('finalize_refund', {
      p_payment_id: payment.id,
      p_stripe_refund_id: refund.id,
    });
    if (finErr) throw new Error(`finalize_refund failed: ${finErr.message}`);

    return json({ refunded_cents: refundAmount }, 200);
  } catch (err) {
    console.error('refund-participant error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return json({ code: 'INTERNAL', message }, 500);
  }
});
