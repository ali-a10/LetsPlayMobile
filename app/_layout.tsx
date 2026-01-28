import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { QueryProvider } from '../lib/providers/QueryProvider';
import { useAuth } from '../lib/hooks/useAuth';

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
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
