import { corsHeaders, json, fail } from '../_shared/cors.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';

/**
 * Reads the authenticated host's Connect account straight from Stripe and mirrors its
 * onboarding/payout status onto their profile, returning the fresh flags. Called by the app
 * the instant the onboarding browser closes, so the screen doesn't have to wait for the
 * account.updated webhook (which stays as the safety net for later changes). Mapping matches
 * the webhook's handleAccountUpdated so the two can't disagree.
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

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const onboardingComplete = account.details_submitted ?? false;
    const payoutsEnabled = Boolean(account.charges_enabled && account.payouts_enabled);

    // "Pending verification" = the host has nothing left to submit (nothing currently/past due),
    // but payouts aren't enabled yet — Stripe is still reviewing. The app keeps watching in this
    // state so it auto-updates the moment the flag flips, instead of stranding the host on
    // "Almost there". If there ARE due items, the ball is in the host's court (e.g. upload ID).
    const currentlyDue = account.requirements?.currently_due ?? [];
    const pastDue = account.requirements?.past_due ?? [];
    const pendingVerification = !payoutsEnabled && currentlyDue.length === 0 && pastDue.length === 0;

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        stripe_onboarding_complete: onboardingComplete,
        stripe_payouts_enabled: payoutsEnabled,
      })
      .eq('id', user.id);
    if (updateError) throw new Error(`Failed to update profile: ${updateError.message}`);

    return json(
      { accountId: profile.stripe_account_id, onboardingComplete, payoutsEnabled, pendingVerification },
      200,
    );
  } catch (err) {
    // Full detail stays in server logs; the caller gets a generic message (no raw Stripe errors).
    console.error('refresh-connect-account error:', err);
    return fail('INTERNAL', 'Something went wrong. Please try again.', 500);
  }
});
