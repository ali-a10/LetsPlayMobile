import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

/**
 * Creates (idempotently) a Stripe Connect Express account for the authenticated host
 * and stores its id on their profile, so they can later receive event payouts.
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

    // Load the host's profile — we need their email for Stripe and to check for an existing account.
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('email, stripe_account_id')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) {
      return json({ error: 'Profile not found' }, 404);
    }

    // Idempotent: if an account already exists, return it instead of creating a duplicate.
    if (profile.stripe_account_id) {
      return json({ accountId: profile.stripe_account_id, alreadyExists: true }, 200);
    }

    // Express account for a Canadian host. Both capabilities are requested so the
    // account reaches charges_enabled && payouts_enabled — the flag the app gates on (§5.3).
    // business_type + business_profile are prefilled so hosts (all individuals selling access to
    // pickup games under the LetsPlay platform) aren't asked for business type, industry, or website.
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'CA',
      email: profile.email,
      business_type: 'individual',
      business_profile: {
        mcc: '7997', // Membership clubs — sports & recreation
        url: 'https://letsplayapp.ca',
        product_description: 'Hosting recreational sports events and pickup games on the LetsPlay app, where participants pay to reserve a spot.',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .eq('id', user.id);
    if (updateError) {
      throw new Error(`Failed to save Stripe account id: ${updateError.message}`);
    }

    return json({ accountId: account.id, alreadyExists: false }, 200);
  } catch (err) {
    console.error('create-connect-account error:', err);
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
