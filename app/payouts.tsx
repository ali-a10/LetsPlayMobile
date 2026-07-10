import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { useThemeColors } from '../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../lib/constants/colors';
import { useAuth } from '../lib/hooks/useAuth';
import { usePayoutStatus, useStartPayoutOnboarding, useSyncPayoutStatus } from '../lib/hooks/useStripePayouts';
import { HostEarnings } from '../components/payments/HostEarnings';

// How long to keep polling for the webhook after onboarding before giving up.
// Generous (~1 min) so the "Verifying… this might take a minute" copy stays honest;
// it stops early the moment the flag flips true.
const VERIFY_TIMEOUT_MS = 60000;

const PAYOUT_BENEFITS = [
  'Get paid automatically — earnings are released ~24 hours after each event',
  'Secure identity and bank verification by Stripe',
  'Required before you can host paid events',
];

/** Screen where a host sets up Stripe Connect payouts, or sees that payouts are ready. */
export default function PayoutsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [verifying, setVerifying] = useState(false);
  const status = usePayoutStatus(user?.id, verifying);
  const onboarding = useStartPayoutOnboarding(user?.id);
  const sync = useSyncPayoutStatus(user?.id);

  const payoutsEnabled = status.data?.payoutsEnabled ?? false;
  const onboardingComplete = status.data?.onboardingComplete ?? false;

  // Stop verifying once payouts are enabled, or after the timeout if the webhook never lands.
  useEffect(() => {
    if (payoutsEnabled) setVerifying(false);
  }, [payoutsEnabled]);

  useEffect(() => {
    if (!verifying) return;
    const timer = setTimeout(() => setVerifying(false), VERIFY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [verifying]);

  /**
   * Starts Stripe onboarding; when the browser closes, actively re-reads the account status
   * from Stripe so the correct state shows immediately, falling back to polling if that fails.
   */
  const handleSetup = async () => {
    try {
      await onboarding.mutateAsync();
    } catch {
      // Error is surfaced via onboarding.error below.
      return;
    }
    // The browser closed. Show a brief spinner while we ask Stripe directly for the real status.
    setVerifying(true);
    try {
      const result = await sync.mutateAsync();
      // Keep the spinner + poll running ONLY while Stripe is still verifying with nothing left for
      // the host to do (pendingVerification) — that's when the flag is about to flip on its own.
      // Otherwise show the resolved state now: earnings if enabled, else "Almost there" (action needed).
      if (result.payoutsEnabled || !result.pendingVerification) {
        setVerifying(false);
      }
    } catch {
      // Active fetch failed — leave verifying on so the 2s poll + timeout backstop it,
      // and the account.updated webhook still lands as the safety net.
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={sharedColors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payouts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {status.isLoading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={colors.header} />
          </View>
        ) : payoutsEnabled ? (
          <>
            <Text style={styles.earningsHeading}>Your earnings</Text>
            <HostEarnings userId={user!.id} />
            <LearnMoreLink styles={styles} colors={colors} onPress={() => router.push('/how-paid-events-work')} />
          </>
        ) : verifying ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={colors.header} />
            <Text style={styles.verifyingText}>Verifying your payout setup… this might take a minute.</Text>
          </View>
        ) : onboardingComplete ? (
          <>
            <View style={styles.iconWrapper}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.header} />
            </View>
            <Text style={styles.title}>Almost there</Text>
            <Text style={styles.subtitle}>
              You&apos;ve submitted your details, but Stripe still needs to verify your identity
              before payouts can be enabled. This usually means uploading a photo of your ID.
            </Text>

            {onboarding.error && (
              <Text style={styles.errorText}>{onboarding.error.message}</Text>
            )}

            <Button
              title="Continue verification"
              onPress={handleSetup}
              loading={onboarding.isPending}
              style={styles.actionBtn}
            />
          </>
        ) : (
          <>
            <View style={styles.iconWrapper}>
              <Ionicons name="cash-outline" size={48} color={colors.header} />
            </View>
            <Text style={styles.title}>Set up payouts</Text>
            <Text style={styles.subtitle}>
              To host paid events, connect a Stripe account so you can receive your earnings
              securely. It takes about 3 minutes.
            </Text>

            <View style={styles.card}>
              {PAYOUT_BENEFITS.map((item) => (
                <View key={item} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.header} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>

            {onboarding.error && (
              <Text style={styles.errorText}>{onboarding.error.message}</Text>
            )}

            <Button
              title="Set up payouts"
              onPress={handleSetup}
              loading={onboarding.isPending}
              style={styles.actionBtn}
            />

            <LearnMoreLink styles={styles} colors={colors} onPress={() => router.push('/how-paid-events-work')} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** A centered "Learn more about how payouts work" link that opens the paid-events explainer. */
function LearnMoreLink({
  styles,
  colors,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.learnMoreLink} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="information-circle-outline" size={16} color={colors.sectionTitle} />
      <Text style={styles.learnMoreText}>Learn more about how payouts work</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.header,
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
      color: sharedColors.white,
    },
    content: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      flexGrow: 1,
    },
    centerBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      gap: 16,
    },
    verifyingText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
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
    earningsHeading: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    learnMoreLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      marginTop: 8,
    },
    learnMoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.sectionTitle,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      gap: 12,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      textAlign: 'center',
      marginBottom: 16,
    },
    actionBtn: {
      marginBottom: 16,
    },
  });
}
