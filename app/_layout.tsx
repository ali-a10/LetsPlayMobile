import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { QueryProvider } from '../lib/providers/QueryProvider';
import { useAuth } from '../lib/hooks/useAuth';
import { supabase } from '../lib/supabase';

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [checkingProfile, setCheckingProfile] = useState(false);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onCompleteProfile = segments.at(1) === 'complete-profile';

    async function checkProfile() {
      if (!session) {
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
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

      if (!profile && !onCompleteProfile) {
        // Logged in but no profile — go to complete profile
        router.replace('/(auth)/complete-profile');
      } else if (profile && inAuthGroup) {
        // Has profile but still in auth group — go to main app
        router.replace('/(tabs)');
      }
    }

    checkProfile();
  }, [session, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthGate />
    </QueryProvider>
  );
}
