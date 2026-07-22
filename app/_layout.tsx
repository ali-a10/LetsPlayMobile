import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StatusBar } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryProvider } from '../lib/providers/QueryProvider';
import { useAuth } from '../lib/hooks/useAuth';
import { usePushNotifications } from '../lib/hooks/usePushNotifications';
import { useThemeColors } from '../lib/hooks/useThemeColors';
import { useThemeStore } from '../lib/stores/themeStore';
import { supabase } from '../lib/supabase';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

/** Provides a theme-aware StatusBar that updates when the user toggles dark mode. */
function ThemedStatusBar() {
  const colors = useThemeColors();
  return <StatusBar barStyle={colors.statusBarStyle} />;
}

function AuthGate() {
  const { session, loading } = useAuth();
  usePushNotifications(session);
  const segments = useSegments();
  const router = useRouter();
  const [checkingProfile, setCheckingProfile] = useState(false);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  // Reset theme to light when signed out so auth screens are always light.
  useEffect(() => {
    if (!loading && !session) {
      setThemePreference('light');
    }
  }, [session, loading]);

  // Handle password reset deep links (letsplay://auth/reset-password#access_token=...&type=recovery)
  useEffect(() => {
    async function handleResetLink(url: string) {
      if (!url.includes('reset-password')) return;
      const hash = url.split('#')[1];
      if (!hash) return;
      const params = Object.fromEntries(new URLSearchParams(hash));
      if (params.access_token && params.refresh_token) {
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        router.replace('/(auth)/reset-password');
      }
    }

    // Cold start: app was fully closed when the link was tapped
    Linking.getInitialURL().then(url => { if (url) handleResetLink(url); });

    // Warm start: app was already running in the background
    const subscription = Linking.addEventListener('url', ({ url }) => handleResetLink(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onResetScreen = segments.join('/').includes('reset-password');

    async function checkProfile() {
      if (!session) {
        if (!inAuthGroup) {
          router.replace('/(auth)/welcome');
        }
        return;
      }

      // User is logged in
      setCheckingProfile(true);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();
      setCheckingProfile(false);

      if (error) {
        console.warn('Profile fetch error:', error.message);
      }

      if (!profile && !inAuthGroup) {
        // Logged in but no profile — go to onboarding
        router.replace('/(auth)/onboarding-details');
      } else if (profile && inAuthGroup && !onResetScreen) {
        // Has profile but still in auth group — go to main app
        // (exception: stay on reset-password screen until user saves new password)
        router.replace('/(tabs)');
      }
    }

    checkProfile();
  }, [session, loading, segments]);

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}

export default function RootLayout() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} urlScheme="letsplay">
      <QueryProvider>
        <ThemedStatusBar />
        <AuthGate />
      </QueryProvider>
    </StripeProvider>
  );
}
