import { corsHeaders, json, fail } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';
import { refundPaymentFull } from '../_shared/refunds.ts';
import { notifyUsers } from '../_shared/push.ts';
import { eventCancelledCopy } from '../_shared/messages.ts';

/**
 * Cancels an event on behalf of its host (§7.2): verifies the caller is the host and the 12-hour
 * window is open, marks the event cancelled, then (for paid events) refunds every succeeded payment
 * in full — logging any individual refund failure to failed_refunds and continuing with the rest.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await getUserFromRequest(req, admin);
    if (!user) return fail('UNAUTHORIZED', 'You must be signed in.', 401);

    const { event_id } = await req.json().catch(() => ({}));
    if (!event_id) return fail('EVENT_NOT_FOUND', 'No event specified.', 400);

    // 1. Load the event and verify the caller is its host.
    const { data: event } = await admin
      .from('events')
      .select('id, host_id, is_paid, cancelled_at, title')
      .eq('id', event_id)
      .maybeSingle();
    if (!event) return fail('EVENT_NOT_FOUND', 'This event no longer exists.', 404);
    if (event.host_id !== user.id) {
      return fail('UNAUTHORIZED', 'Only the host can cancel this event.', 403);
    }

    // 2. Already cancelled → idempotent no-op (double-tap / retry).
    if (event.cancelled_at) {
      return json({ already_cancelled: true, refunded: 0, failed: 0 }, 200);
    }

    // 3. Enforce the 12-hour window in Postgres (reuses C1's guard; P0005 = inside the window).
    const { error: windowErr } = await admin.rpc('assert_refund_window_open', {
      p_event_id: event_id,
    });
    if (windowErr) {
      if (windowErr.code === 'P0005') {
        return fail('CANCEL_WINDOW_CLOSED', "You can't cancel an event within 12 hours of its start.", 409);
      }
      if (windowErr.code === 'P0002') {
        return fail('EVENT_NOT_FOUND', 'This event no longer exists.', 404);
      }
      throw new Error(`assert_refund_window_open failed: ${windowErr.message}`);
    }

    // 4. Mark the event cancelled FIRST, so it's definitively dead even if some refunds fail.
    //    Touches only cancelled_at — never a P0007-locked field.
    const { error: cancelErr } = await admin
      .from('events')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', event_id);
    if (cancelErr) throw new Error(`failed to mark event cancelled: ${cancelErr.message}`);

    // 4b. Tell every participant. Before the refund loop so the news is immediate; notifyUsers
    //     never throws, so a push hiccup can't abort the refunds below.
    const { data: participantRows } = await admin
      .from('participants')
      .select('user_id')
      .eq('event_id', event_id);
    // Exclude the host (they may have joined their own event) — they just cancelled it,
    // so a "was cancelled" push to them would be redundant.
    const participantIds = (participantRows ?? [])
      .map((row) => row.user_id)
      .filter((id) => id !== event.host_id);
    const copy = eventCancelledCopy(event.title, event.is_paid);
    await notifyUsers(admin, {
      userIds: participantIds,
      type: 'event_cancelled',
      title: copy.title,
      body: copy.body,
      url: `/event/${event_id}`,
      eventId: event_id,
      dedupeKey: `cancel:${event_id}`,
    });

    // 5. Free event: nothing to refund.
    if (!event.is_paid) {
      return json({ refunded: 0, failed: 0 }, 200);
    }

    // 6. Refund every succeeded payment in full. One bad refund must not abort the rest:
    //    log it to failed_refunds and continue with the others (§7.2 / §4.8).
    //    Skip disputed payments: the bank's chargeback already owns that money and Stripe rejects a
    //    refund on it, so attempting one would only fail and pollute failed_refunds.
    const { data: payments, error: payErr } = await admin
      .from('payments')
      .select('*')
      .eq('event_id', event_id)
      .eq('status', 'succeeded')
      .is('disputed_at', null);
    if (payErr) throw new Error(`failed to load payments: ${payErr.message}`);

    let refunded = 0;
    let failed = 0;
    for (const payment of payments ?? []) {
      try {
        await refundPaymentFull(admin, payment);
        refunded++;
      } catch (refundErr) {
        failed++;
        const message = refundErr instanceof Error ? refundErr.message : 'Refund failed';
        console.error(`cancel-event refund failed for payment ${payment.id}:`, message);
        await admin.from('failed_refunds').insert({
          payment_id: payment.id,
          event_id,
          error_message: message,
        });
      }
    }

    return json({ refunded, failed }, 200);
  } catch (err) {
    console.error('cancel-event error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return json({ code: 'INTERNAL', message }, 500);
  }
});
