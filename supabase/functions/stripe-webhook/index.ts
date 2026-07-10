import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { refundPaymentFull } from '../_shared/refunds.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Deno-native crypto provider — required for async (non-blocking) signature verification.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Receives Stripe webhook events, verifies their signature, dedups them (§9), and routes them to handlers:
 * `account.updated` (host onboarding status), `payment_intent.succeeded` (join safety net),
 * `payment_intent.payment_failed` (record a failed payment), `charge.refunded` (refund reconciliation safety net),
 * `charge.dispute.created` (hold a disputed payment out of payouts), and `transfer.reversed` (flag a reversed payout).
 */
Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const body = await req.text();

  // Two destinations hit this one URL: the connected-accounts endpoint (account.updated) and the
  // platform-account endpoint (payment_intent.*). Each has its own signing secret, so verify against
  // whichever one matches — the right secret validates, the other throws and is skipped.
  const webhookSecrets = [
    Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',          // connected-accounts destination
    Deno.env.get('STRIPE_WEBHOOK_SECRET_PLATFORM') ?? '', // your platform-account destination
  ].filter(Boolean);

  let event: Stripe.Event | null = null;
  let lastError: unknown = null;
  for (const secret of webhookSecrets) {
    try {
      // Raw body + signature are verified against each configured signing secret.
      event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!event) {
    const message = lastError instanceof Error ? lastError.message : 'Invalid signature';
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Router step 1: dedup (§9). Claim the event id; if it's already recorded, Stripe is re-delivering a
  // duplicate — acknowledge with 200 and skip. Applies to every event type.
  const { error: dedupError } = await adminClient
    .from('stripe_events')
    .insert({
      id: event.id,
      type: event.type,
      created_at: new Date(event.created * 1000).toISOString(),
    });
  if (dedupError) {
    if (dedupError.code === '23505') {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Couldn't record the event — return 500 so Stripe retries later.
    console.error('stripe-webhook dedup insert failed:', dedupError);
    return new Response(`Webhook dedup failed: ${dedupError.message}`, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(adminClient, (event.data.object as Stripe.Account).id);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(adminClient, event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(adminClient, event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(adminClient, event.data.object as Stripe.Charge);
        break;
      case 'charge.dispute.created':
        await handleDisputeCreated(adminClient, event.data.object as Stripe.Dispute);
        break;
      case 'transfer.reversed':
        await handleTransferReversed(adminClient, event.data.object as Stripe.Transfer);
        break;
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying them.
        break;
    }
  } catch (err) {
    console.error('stripe-webhook handler error:', err);
    // Release the dedup claim so Stripe's retry can reprocess this event (the handler didn't finish).
    await adminClient.from('stripe_events').delete().eq('id', event.id);
    const message = err instanceof Error ? err.message : 'Handler error';
    return new Response(`Webhook handler failed: ${message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

/**
 * Re-fetches the live Connect account from Stripe and mirrors its onboarding/payout
 * status onto the matching profile, so a stale or out-of-order event can't regress state (§9).
 */
async function handleAccountUpdated(
  adminClient: ReturnType<typeof createClient>,
  accountId: string
): Promise<void> {
  const account = await stripe.accounts.retrieve(accountId);

  const { error } = await adminClient
    .from('profiles')
    .update({
      stripe_onboarding_complete: account.details_submitted ?? false,
      stripe_payouts_enabled: Boolean(account.charges_enabled && account.payouts_enabled),
    })
    .eq('stripe_account_id', accountId);

  if (error) {
    throw new Error(`Failed to update profile for account ${accountId}: ${error.message}`);
  }
}

/**
 * Safety net (§6.4): if the app crashed between Payment Sheet success and `confirm-payment-join`,
 * finalize the join here via the same shared `finalize_paid_join` transaction. Idempotent, so a
 * duplicate finalize is a no-op. Also covers the deferred refunds when the app never confirmed:
 * a full refund if the host cancelled mid-checkout (§6.2) or the event filled first (§6.6).
 */
async function handlePaymentIntentSucceeded(
  adminClient: ReturnType<typeof createClient>,
  pi: Stripe.PaymentIntent
): Promise<void> {
  const chargeId =
    typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null;

  // Load our payment row for this PI; if we don't track it, nothing to do.
  const { data: payment } = await adminClient
    .from('payments')
    .select('*')
    .eq('stripe_payment_intent_id', pi.id)
    .maybeSingle();
  if (!payment) return;

  // Record the charge id so charge.refunded reconciliation can find this row by charge.
  if (chargeId && payment.stripe_charge_id !== chargeId) {
    await adminClient.from('payments').update({ stripe_charge_id: chargeId }).eq('id', payment.id);
    payment.stripe_charge_id = chargeId;
  }

  // Host cancelled while the user was mid-checkout (§6.2): refund in full, don't seat.
  const { data: event } = await adminClient
    .from('events')
    .select('cancelled_at')
    .eq('id', payment.event_id)
    .single();
  if (event?.cancelled_at) {
    await refundPaymentFull(adminClient, payment);
    return;
  }

  // Finalize the join. If the event filled first (§6.6), refund in full instead of seating.
  const { data: result, error } = await adminClient.rpc('finalize_paid_join', {
    p_payment_intent_id: pi.id,
    p_charge_id: chargeId,
  });
  if (error) {
    throw new Error(`finalize_paid_join failed for ${pi.id}: ${error.message}`);
  }
  if (result === 'event_full') {
    await refundPaymentFull(adminClient, payment);
  }
}

/**
 * Safety net (§7.4): a refund completed at Stripe. If our payments row for this charge isn't already
 * marked refunded (the normal path updates it inline), reconcile it now via finalize_refund — covering
 * a finalize that threw after a successful refund, or a manual dashboard refund with no app code involved.
 */
async function handleChargeRefunded(
  adminClient: ReturnType<typeof createClient>,
  charge: Stripe.Charge
): Promise<void> {
  const { data: payment } = await adminClient
    .from('payments')
    .select('id, status')
    .eq('stripe_charge_id', charge.id)
    .maybeSingle();

  // No matching payment, or it's already reconciled → nothing to do (the common case).
  if (!payment || payment.status === 'refunded') return;

  const refundId = charge.refunds?.data?.[0]?.id ?? null;
  const { error } = await adminClient.rpc('finalize_refund', {
    p_payment_id: payment.id,
    p_stripe_refund_id: refundId,
  });
  if (error) {
    throw new Error(`finalize_refund failed for charge ${charge.id}: ${error.message}`);
  }
}

/**
 * Records a failed payment (§6.5): mark the `payments` row `failed` with the Stripe failure reason.
 * Only touches rows still `pending`/`failed` so a late failure for an earlier attempt can't regress a
 * row that has since `succeeded` (the legal `failed → succeeded` retry on the same PI).
 */
async function handlePaymentIntentFailed(
  adminClient: ReturnType<typeof createClient>,
  pi: Stripe.PaymentIntent
): Promise<void> {
  const failedReason = pi.last_payment_error?.message ?? 'Payment failed';

  const { error } = await adminClient
    .from('payments')
    .update({ status: 'failed', failed_reason: failedReason })
    .eq('stripe_payment_intent_id', pi.id)
    .in('status', ['pending', 'failed']);
  if (error) {
    throw new Error(`Failed to mark payment failed for ${pi.id}: ${error.message}`);
  }
}

/**
 * Holds a disputed payment out of the payout job (§8.2): a chargeback pulled the charge (plus a fee) back
 * out of the platform balance, so stamp `disputed_at` on the matching payment — get_due_payouts then skips
 * it, and paying the host would be a double loss. Idempotent: only stamps a row not already disputed.
 */
async function handleDisputeCreated(
  adminClient: ReturnType<typeof createClient>,
  dispute: Stripe.Dispute
): Promise<void> {
  // Match on the PaymentIntent id (set on our row at creation) rather than the charge id (only written
  // once payment_intent.succeeded lands) — Stripe doesn't guarantee order, and the dispute can arrive
  // before the charge id exists on the row, as with the dispute test card. Fall back to charge id.
  const piId =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? null;
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null;

  let query = adminClient
    .from('payments')
    .update({ disputed_at: new Date().toISOString() })
    .is('disputed_at', null);
  if (piId) query = query.eq('stripe_payment_intent_id', piId);
  else if (chargeId) query = query.eq('stripe_charge_id', chargeId);
  else return;

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to mark payment disputed (pi=${piId}, charge=${chargeId}): ${error.message}`);
  }
}

/**
 * Flags a reversed payout for manual review (§8.3): a transfer we already sent a host was reversed (a late
 * dispute or a manual clawback), so record it on the matching payment via `payout_failed_reason` — a
 * tripwire that surfaces "money we paid out came back, go look." No automated recovery is attempted.
 */
async function handleTransferReversed(
  adminClient: ReturnType<typeof createClient>,
  transfer: Stripe.Transfer
): Promise<void> {
  const { error } = await adminClient
    .from('payments')
    .update({ payout_failed_reason: 'Transfer reversed — needs manual review' })
    .eq('stripe_transfer_id', transfer.id);
  if (error) {
    throw new Error(`Failed to flag reversed transfer ${transfer.id}: ${error.message}`);
  }
}
