import { corsHeaders, json, fail } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';
import { stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';
import { computeFees } from '../_shared/fees.ts';

// PaymentIntent statuses that mean the Payment Sheet can still be (re)opened on this same intent.
const REUSABLE_PI_STATUSES = ['requires_payment_method', 'requires_confirmation', 'requires_action'];

/**
 * Sets up (or reuses) a Stripe PaymentIntent + a pending `payments` row so an authenticated user can pay
 * to join a paid event, returning the Payment Sheet payload (or `already_joined` when they're already in).
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await getUserFromRequest(req, admin);
    if (!user) return fail('UNAUTHORIZED', 'You must be signed in.', 401);

    const { event_id } = await req.json().catch(() => ({}));
    if (!event_id) return fail('EVENT_NOT_FOUND', 'This event no longer exists.', 400);

    // 1. Load + validate the event.
    const { data: event } = await admin
      .from('events')
      .select('id, host_id, is_paid, price_cents, max_participants, current_participants, date, cancelled_at')
      .eq('id', event_id)
      .single();

    if (!event) return fail('EVENT_NOT_FOUND', 'This event no longer exists.', 404);
    if (event.cancelled_at) {
      return fail('EVENT_CANCELLED', 'This event has been cancelled.', 409);
    }
    if (!event.is_paid || !event.price_cents) {
      return fail('EVENT_NOT_PAID', 'This event is free — no payment is needed.', 400);
    }
    if (new Date(event.date).getTime() <= Date.now()) {
      return fail('EVENT_PAST', 'This event has already started.', 400);
    }
    if (event.current_participants >= event.max_participants) {
      return fail('EVENT_FULL', 'This event is now full.', 409);
    }

    // 2. Already a participant? Returns success (not an error). Also blocks a host paying for their own
    //    event — hosts are auto-participants, so this check is load-bearing.
    const { data: existing } = await admin
      .from('participants')
      .select('user_id')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) return json({ kind: 'already_joined' }, 200);

    // 3. Block in either direction between the caller and the host.
    const { data: blocks } = await admin
      .from('blocks')
      .select('blocker_id')
      .or(
        `and(blocker_id.eq.${user.id},blocked_id.eq.${event.host_id}),` +
        `and(blocker_id.eq.${event.host_id},blocked_id.eq.${user.id})`
      );
    if (blocks && blocks.length > 0) return fail('USER_BLOCKED', "You can't join this event.", 403);

    // 4. Create-or-reuse the user's Stripe customer.
    const { data: profile } = await admin
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single();
    if (!profile) throw new Error('Profile not found for authenticated user');

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: profile.email });
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // 5. Pending-row lookup — reuse an in-progress attempt instead of duplicating (and tripping the
    //    partial unique index).
    const { data: pending } = await admin
      .from('payments')
      .select('*')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pending) {
      const pi = await stripe.paymentIntents.retrieve(pending.stripe_payment_intent_id);
      if (REUSABLE_PI_STATUSES.includes(pi.status)) {
        const ephemeralKey = await stripe.ephemeralKeys.create(
          { customer: customerId },
          { apiVersion: STRIPE_API_VERSION }
        );
        return json({
          kind: 'reused',
          clientSecret: pi.client_secret,
          paymentIntentId: pi.id,
          ephemeralKey: ephemeralKey.secret,
          customer: customerId,
        }, 200);
      }
      // Unusable PI (canceled/terminal): cancel for hygiene if possible, retire the row, fall through.
      if (pi.status !== 'canceled') {
        try { await stripe.paymentIntents.cancel(pi.id); } catch (_) { /* already terminal */ }
      }
      await admin.from('payments').update({ status: 'failed' }).eq('id', pending.id);
    }

    // 6. Compute amounts (authoritative; the mobile preview is display-only).
    const fees = computeFees(event.price_cents);

    // 7. Create the PaymentIntent. setup_future_usage is omitted on purpose so the Payment Sheet shows
    //    an opt-in "Save this card" checkbox.
    const pi = await stripe.paymentIntents.create({
      amount: fees.amount_total_cents,
      currency: 'cad',
      customer: customerId,
      transfer_group: `event_${event_id}`,
      receipt_email: profile.email,
      metadata: {
        event_id,
        user_id: user.id,
        host_id: event.host_id,
        amount_host_cents: String(fees.amount_host_cents),
      },
    });

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: STRIPE_API_VERSION }
    );

    // 8. Conflict-aware insert of the pending row. The partial unique index raises 23505 if an active
    //    row already exists (a concurrent attempt) — in that case abandon this fresh PI and reuse theirs.
    const { data: inserted, error: insertErr } = await admin
      .from('payments')
      .insert({
        event_id,
        user_id: user.id,
        host_id: event.host_id,
        amount_host_cents: fees.amount_host_cents,
        amount_stripe_fee_cents: fees.amount_stripe_fee_cents,
        amount_platform_fee_cents: fees.amount_platform_fee_cents,
        amount_total_cents: fees.amount_total_cents,
        currency: 'cad',
        stripe_payment_intent_id: pi.id,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        // Lost the race — an active row already exists. Cancel our orphan PI and reuse the winner.
        try { await stripe.paymentIntents.cancel(pi.id); } catch (_) { /* ignore */ }
        const { data: active } = await admin
          .from('payments')
          .select('*')
          .eq('event_id', event_id)
          .eq('user_id', user.id)
          .in('status', ['pending', 'succeeded', 'transferred'])
          .maybeSingle();
        if (active) {
          // A succeeded/transferred winner means the money's already in — treat as "you're in".
          if (active.status !== 'pending') return json({ kind: 'already_joined' }, 200);
          const winnerPi = await stripe.paymentIntents.retrieve(active.stripe_payment_intent_id);
          return json({
            kind: 'reused',
            clientSecret: winnerPi.client_secret,
            paymentIntentId: winnerPi.id,
            ephemeralKey: ephemeralKey.secret,
            customer: customerId,
          }, 200);
        }
      }
      throw new Error(`Failed to record payment: ${insertErr.message}`);
    }

    return json({
      kind: 'new',
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      ephemeralKey: ephemeralKey.secret,
      customer: customerId,
    }, 200);
  } catch (err) {
    console.error('create-payment-intent error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return json({ code: 'INTERNAL', message }, 500);
  }
});
