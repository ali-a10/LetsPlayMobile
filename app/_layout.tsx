import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { QueryProvider } from '../lib/providers/QueryProvider';
import { useAuth } from '../lib/hooks/useAuth';
import { supabase } from '../lib/supabase';

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [checkingProfile, setCheckingProfile] = useState(false);

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
        .single();
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
    <QueryProvider>
      <AuthGate />
    </QueryProvider>
  );
}
