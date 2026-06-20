import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Deno-native crypto provider — required for async (non-blocking) signature verification.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Receives Stripe webhook events, verifies their signature, and routes them to handlers.
 * Phase A handles only `account.updated` (host onboarding status); more events arrive in Phase B.
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

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(adminClient, (event.data.object as Stripe.Account).id);
        break;
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying them.
        break;
    }
  } catch (err) {
    console.error('stripe-webhook handler error:', err);
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
