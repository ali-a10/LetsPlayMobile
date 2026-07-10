import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../supabase';

export type PayoutStatus = {
  accountId: string | null;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
};

// The active-fetch result adds pendingVerification (Stripe is still reviewing, nothing for the
// host to do) — used to decide whether to keep watching. It's not stored in the DB, so it lives
// only on the sync result, not on the cached PayoutStatus.
export type PayoutSyncResult = PayoutStatus & { pendingVerification: boolean };

/**
 * Reads the host's Stripe payout status from their profile; pass `poll` to refetch
 * every ~2s (used while waiting for the account.updated webhook to land after onboarding).
 */
export function usePayoutStatus(userId: string | undefined, poll = false) {
  return useQuery<PayoutStatus>({
    queryKey: ['payouts', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return {
        accountId: data.stripe_account_id,
        onboardingComplete: data.stripe_onboarding_complete,
        payoutsEnabled: data.stripe_payouts_enabled,
      };
    },
    enabled: !!userId,
    // While polling, refetch every 2s but stop once payouts are enabled.
    refetchInterval: (query) =>
      poll && !query.state.data?.payoutsEnabled ? 2000 : false,
  });
}

/**
 * Runs Stripe Connect onboarding for the host: ensures their account exists, opens
 * Stripe-hosted onboarding in an in-app browser, and refreshes payout status on return.
 */
export function useStartPayoutOnboarding(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<WebBrowser.WebBrowserResult, Error>({
    mutationFn: async () => {
      // create-connect-account is idempotent — safe to call even if the account exists.
      const account = await supabase.functions.invoke('create-connect-account');
      if (account.error) throw new Error(account.error.message);

      const link = await supabase.functions.invoke('create-connect-account-link');
      if (link.error) throw new Error(link.error.message);

      const url = link.data?.url as string | undefined;
      if (!url) throw new Error('Could not start payout setup. Please try again.');

      // Opens Stripe onboarding in an in-app browser; resolves when the user closes it.
      // (Stripe's return URL is an https page, so there's no custom-scheme auto-return —
      // the user taps Done, then we poll + the account.updated webhook confirms the result.)
      return WebBrowser.openBrowserAsync(url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}

/**
 * Actively re-reads the host's Connect account from Stripe (via the refresh-connect-account
 * Edge Function) the moment the onboarding browser closes, and writes the fresh status into
 * the payouts cache — so the screen shows the real state instantly instead of polling for the
 * account.updated webhook.
 */
export function useSyncPayoutStatus(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<PayoutSyncResult, Error>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('refresh-connect-account');
      if (error) throw new Error(error.message);
      return data as PayoutSyncResult;
    },
    onSuccess: async (result) => {
      // Cancel any in-flight ['payouts'] refetch (e.g. the invalidate from onboarding's onSuccess)
      // so a slower, staler DB read can't overwrite the fresh status we just fetched from Stripe.
      await queryClient.cancelQueries({ queryKey: ['payouts', userId] });
      queryClient.setQueryData<PayoutStatus>(['payouts', userId], {
        accountId: result.accountId,
        onboardingComplete: result.onboardingComplete,
        payoutsEnabled: result.payoutsEnabled,
      });
    },
  });
}

/**
 * Opens the host's Stripe Express dashboard in the in-app browser via a freshly
 * minted single-use login link from the create-express-login-link Edge Function.
 */
export function useOpenStripeDashboard() {
  return useMutation<WebBrowser.WebBrowserResult, Error>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-express-login-link');
      if (error) throw new Error('Could not open your Stripe dashboard. Please try again.');

      const url = data?.url as string | undefined;
      if (!url) throw new Error('Could not open your Stripe dashboard. Please try again.');

      return WebBrowser.openBrowserAsync(url);
    },
  });
}
