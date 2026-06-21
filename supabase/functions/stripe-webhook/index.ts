import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Deno-native crypto provider — required for async (non-blocking) signature verification.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Receives Stripe webhook events, verifies their signature, dedups them (§9), and routes them to handlers:
 * `account.updated` (host onboarding status), `payment_intent.succeeded` (join safety net), and
 * `payment_intent.payment_failed` (record a failed payment).
 */
Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    // Raw body + signature are verified against the endpoint's signing secret.
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
      undefined,
      cryptoProvider
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
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
 * duplicate finalize (app already confirmed) is a no-op; the `event_full` outcome leaves the refund to Phase C.
 */
async function handlePaymentIntentSucceeded(
  adminClient: ReturnType<typeof createClient>,
  pi: Stripe.PaymentIntent
): Promise<void> {
  const chargeId =
    typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null;

  const { error } = await adminClient.rpc('finalize_paid_join', {
    p_payment_intent_id: pi.id,
    p_charge_id: chargeId,
  });
  if (error) {
    throw new Error(`finalize_paid_join failed for ${pi.id}: ${error.message}`);
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
