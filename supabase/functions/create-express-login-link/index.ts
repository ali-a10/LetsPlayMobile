import { corsHeaders, json, fail } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';

/**
 * Mints a Stripe Express dashboard login link for the authenticated host's Connect
 * account. Login links are single-use and short-lived, so a fresh one is created per
 * request (same pattern as create-connect-account-link's AccountLinks).
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await getUserFromRequest(req, admin);
    if (!user) return fail('UNAUTHORIZED', 'You must be signed in.', 401);

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_account_id) {
      return fail('NO_STRIPE_ACCOUNT', 'No payout account found. Set up payouts first.', 400);
    }

    // Express-only API — the accounts created by create-connect-account are type 'express'.
    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);

    return json({ url: loginLink.url }, 200);
  } catch (err) {
    // Full detail stays in server logs; the caller gets a generic message (no raw Stripe errors).
    console.error('create-express-login-link error:', err);
    return fail('INTERNAL', 'Something went wrong. Please try again.', 500);
  }
});
