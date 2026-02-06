import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../lib/types/database';
import { Button } from '../../components/ui/Button';
import { colors } from '../../lib/constants/colors';

/** Displays the current user's name, email, and a logout button. */
export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  /** Signs the user out via Supabase auth. */
  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.name}>
        {profile?.first_name} {profile?.last_name}
      </Text>
      <Text style={styles.email}>{profile?.email}</Text>

      <Button
        title="Log Out"
        onPress={handleLogout}
        variant="outline"
        loading={loggingOut}
        style={styles.logoutButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: 40,
  },
  logoutButton: {
    width: '100%',
  },
});
