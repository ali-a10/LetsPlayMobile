import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { registerForPushNotifications } from '../notifications/push';

/** Registers this device for push when a user is signed in, and routes notification taps to their in-app screen. */
export function usePushNotifications(session: Session | null): void {
  const router = useRouter();

  // Register once per signed-in user (re-runs on account switch; token upsert is idempotent).
  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotifications();
    }
  }, [session?.user?.id]);

  // Covers both cold start (app launched by the tap) and warm taps (app backgrounded/foregrounded).
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) {
      router.push(url as never);
    }
  }, [lastResponse]);
}
