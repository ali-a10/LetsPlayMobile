import { useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { functionErrorMessage } from '../utils/errors';
import { useAuth } from './useAuth';
import { track } from '../analytics';

export type PayStatus =
  | 'idle'
  | 'creating-intent'
  | 'sheet-open'
  | 'confirming'
  | 'joined'
  | 'failed';

/**
 * Saga hook that runs the full pay-to-join flow for a paid event: create-payment-intent →
 * Stripe Payment Sheet → confirm-payment-join, with the server as the source of truth for "did I join".
 */
export function usePayPaidEvent(eventId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [status, setStatus] = useState<PayStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Refetches every cache that a new participation affects (same set as useJoinEvent). */
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['my-joined-events', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['userStats', user?.id] });
  }

  /** Runs the create → pay → confirm flow; safe to retry (the server reuses the pending PaymentIntent). */
  async function pay() {
    setError(null);
    try {
      // 1. Create or reuse the PaymentIntent.
      setStatus('creating-intent');
      const { data, error: ciErr } = await supabase.functions.invoke('create-payment-intent', {
        body: { event_id: eventId },
      });
      if (ciErr) {
        track('payment_failed', { event_id: eventId, stage: 'create-intent' });
        setError(await functionErrorMessage(ciErr));
        setStatus('failed');
        return;
      }

      // Already a participant → success, skip the sheet.
      if (data.kind === 'already_joined') {
        invalidate();
        setStatus('joined');
        return;
      }

      // 2. Open the Stripe Payment Sheet.
      const init = await initPaymentSheet({
        merchantDisplayName: 'LetsPlay',
        paymentIntentClientSecret: data.clientSecret,
        customerId: data.customer,
        customerEphemeralKeySecret: data.ephemeralKey,
        // No returnURL: the SDK reclaims the 3D-Secure redirect in-context via StripeProvider's
        // urlScheme. Passing an explicit returnURL made the deep link escape to Expo Router.
        allowsDelayedPaymentMethods: false,
      });
      if (init.error) {
        track('payment_failed', { event_id: eventId, stage: 'init-sheet' });
        setError(init.error.message);
        setStatus('failed');
        return;
      }

      setStatus('sheet-open');
      track('payment_sheet_opened', { event_id: eventId });
      const sheet = await presentPaymentSheet();
      if (sheet.error) {
        // User dismissed the sheet → not an error; the PI stays pending for a later retry.
        if (sheet.error.code === 'Canceled') {
          setStatus('idle');
          return;
        }
        track('payment_failed', { event_id: eventId, stage: 'present-sheet' });
        setError(sheet.error.message);
        setStatus('failed');
        return;
      }

      // 3. Confirm the join server-side.
      setStatus('confirming');
      const { error: cjErr } = await supabase.functions.invoke('confirm-payment-join', {
        body: { payment_intent_id: data.paymentIntentId },
      });
      // Even if confirm errors, the webhook may finalize the join — refetch so server truth wins.
      invalidate();
      if (cjErr) {
        track('payment_failed', { event_id: eventId, stage: 'confirm' });
        setError(await functionErrorMessage(cjErr));
        setStatus('failed');
        return;
      }

      track('payment_succeeded', { event_id: eventId });
      track('event_join_confirmed', { event_id: eventId, is_paid: true });
      setStatus('joined');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again later.');
      setStatus('failed');
    }
  }

  /** Resets the saga back to idle (e.g. when the user closes the join sheet). */
  function reset() {
    setStatus('idle');
    setError(null);
  }

  const isProcessing =
    status === 'creating-intent' || status === 'sheet-open' || status === 'confirming';

  return { status, error, isProcessing, pay, reset };
}
