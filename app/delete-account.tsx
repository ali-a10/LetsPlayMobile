import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { colors } from '../lib/constants/colors';
import { supabase } from '../lib/supabase';
import { friendlyErrorMessage } from '../lib/utils/errors';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

const WHAT_GETS_DELETED = [
  'Your profile and personal information',
  'All events you are hosting',
  'Your participation history in other events',
  'Your profile picture',
  'Your login credentials',
];

/** Screen that explains account deletion and lets the user permanently delete their account. */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Calls the delete-account Edge Function, then signs the user out. */
  const handleDeleteAccount = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session found. Please log in again.');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Deletion failed. Please try again.');

      // Sign out locally — the auth account is already deleted server-side
      await supabase.auth.signOut();
      router.replace('/(auth)/welcome');
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning icon */}
        <View style={styles.iconWrapper}>
          <Ionicons name="warning" size={48} color={colors.error} />
        </View>

        <Text style={styles.title}>Are you sure?</Text>
        <Text style={styles.subtitle}>
          This action is permanent and cannot be undone. Once you delete your account,
          all of your data will be removed from our servers immediately.
        </Text>

        {/* What gets deleted */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>The following will be permanently deleted:</Text>
          {WHAT_GETS_DELETED.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Ionicons name="close-circle" size={18} color={colors.error} />
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Legal retention note (Apple requirement) */}
        <Text style={styles.legalNote}>
          We do not retain any personal data after deletion. If we are ever required by
          law to retain specific data, we will inform you of what is kept and why before
          proceeding.
        </Text>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <Button
          title="Permanently Delete My Account"
          onPress={handleDeleteAccount}
          loading={loading}
          style={styles.deleteBtn}
        />

        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.cancelLink}>
          <Text style={styles.cancelText}>Cancel, keep my account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  content: {
    backgroundColor: colors.gray[50],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    flexGrow: 1,
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: colors.textLight,
    lineHeight: 20,
  },
  legalNote: {
    fontSize: 12,
    color: colors.gray[400],
    lineHeight: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  deleteBtn: {
    backgroundColor: colors.error,
    marginBottom: 16,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
});
