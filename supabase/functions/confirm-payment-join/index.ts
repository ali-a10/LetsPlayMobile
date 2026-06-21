import { corsHeaders, json, fail } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';

/**
 * Confirms a paid join after the Payment Sheet succeeds: verifies the PaymentIntent really succeeded with
 * Stripe, checks the event wasn't cancelled mid-checkout, then runs the shared finalize_paid_join transaction.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await getUserFromRequest(req, admin);
    if (!user) return fail('UNAUTHORIZED', 'You must be signed in.', 401);

    const { payment_intent_id } = await req.json().catch(() => ({}));
    if (!payment_intent_id) {
      return fail('PAYMENT_NOT_CONFIRMED', 'No payment to confirm.', 400);
    }

    // 1. Find the payment row for this PaymentIntent.
    const { data: payment } = await admin
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', payment_intent_id)
      .maybeSingle();
    if (!payment) return fail('PAYMENT_NOT_CONFIRMED', 'No payment record found.', 404);

    // 2. The caller must own this payment (the webhook path, which is service-role, skips confirm entirely
    //    and calls finalize_paid_join directly).
    if (payment.user_id !== user.id) {
      return fail('UNAUTHORIZED', "You can't confirm this payment.", 403);
    }

    // 3. Ask Stripe whether the payment actually succeeded — never trust the client.
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== 'succeeded') {
      return fail('PAYMENT_NOT_CONFIRMED', 'Your payment has not completed.', 402);
    }

    // 4. Metadata must match the DB row (guards against a mismatched/forged intent id).
    if (pi.metadata?.event_id !== payment.event_id || pi.metadata?.user_id !== payment.user_id) {
      return fail('PAYMENT_NOT_CONFIRMED', 'Payment details did not match.', 400);
    }

    const chargeId =
      typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null;

    // 5. Did the host cancel while the user was in the Payment Sheet? cancelled_at is always NULL in
    //    Phase B (nothing sets it yet); the refund is wired in Phase C. For now: don't seat, mark the
    //    money taken, and return the refund-copy code.
    const { data: event } = await admin
      .from('events')
      .select('cancelled_at')
      .eq('id', payment.event_id)
      .single();

    if (event?.cancelled_at) {
      await admin
        .from('payments')
        .update({ status: 'succeeded', stripe_charge_id: chargeId })
        .eq('id', payment.id);
      return fail('EVENT_CANCELLED_REFUNDED', 'The host cancelled this event, so your payment was refunded.', 409);
    }

    // 6. Run the shared finalize transaction (idempotent on event/user/PI).
    const { data: result, error: rpcError } = await admin.rpc('finalize_paid_join', {
      p_payment_intent_id: payment_intent_id,
      p_charge_id: chargeId,
    });
    if (rpcError) throw new Error(`finalize_paid_join failed: ${rpcError.message}`);

    // 7. Map the finalize outcome.
    if (result === 'event_full') {
      // Seat unavailable; money already taken — refund deferred to Phase C.
      return fail('EVENT_FULL_REFUNDED', 'This event filled up before your spot was confirmed, so your payment was refunded.', 409);
    }

    // 'joined' | 'already_joined' → success
    return json({ kind: result ?? 'joined' }, 200);
  } catch (err) {
    console.error('confirm-payment-join error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return json({ code: 'INTERNAL', message }, 500);
  }
});
