import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stripe requires http(s) URLs for AccountLink refresh/return — custom app schemes
// (letsplay://) are rejected as "not a valid URL". The host lands here after onboarding,
// then returns to the app. TODO (Phase B/dev-build): make this a Universal/App Link page
// that reopens the app automatically for a seamless return.
const ONBOARDING_RETURN_URL = 'https://letsplayapp.ca/payouts-complete';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

/**
 * Creates a fresh Stripe AccountLink onboarding URL for the authenticated host's
 * existing Connect account, returning it so the app can open Stripe-hosted onboarding.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }
    const jwt = authHeader.replace('Bearer ', '');

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return json({ error: 'Invalid or expired token' }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) {
      return json({ error: 'Profile not found' }, 404);
    }

    // The account must already exist (create-connect-account is called first by the client).
    if (!profile.stripe_account_id) {
      return json({ error: 'No Stripe account for this user' }, 400);
    }

    // AccountLinks are single-use and short-lived, so a fresh one is minted on every call.
    const accountLink = await stripe.accountLinks.create({
      account: profile.stripe_account_id,
      refresh_url: ONBOARDING_RETURN_URL,
      return_url: ONBOARDING_RETURN_URL,
      type: 'account_onboarding',
    });

    return json({ url: accountLink.url }, 200);
  } catch (err) {
    console.error('create-connect-account-link error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return json({ error: message }, 500);
  }
});

/** Builds a JSON Response with CORS headers and the given status code. */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
