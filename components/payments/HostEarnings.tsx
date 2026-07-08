import { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors } from '../../lib/constants/colors';
import { useHostEarnings } from '../../lib/hooks/useHostEarnings';
import { useOpenStripeDashboard } from '../../lib/hooks/useStripePayouts';
import { EventEarnings, EarningStatus } from '../../lib/utils/earnings';
import { formatCents } from '../../lib/utils/fees';
import { formatEventDate } from '../../lib/utils/sports';

const STATUS_LABEL: Record<EarningStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  held: 'On hold',
};

/** Earnings dashboard shown on the Payouts screen once payouts are enabled: totals, a per-event list, and a link to the Stripe Express dashboard. */
export function HostEarnings({ userId }: { userId: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, isLoading, error, refetch } = useHostEarnings(userId);
  const dashboard = useOpenStripeDashboard();

  if (isLoading) {
    return (
      <View style={styles.centerBlock}>
        <ActivityIndicator size="large" color={colors.header} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centerBlock}>
        <Text style={styles.mutedText}>Couldn&apos;t load your earnings.</Text>
        <Pressable onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      {/* Totals */}
      <View style={styles.totalsRow}>
        <View style={styles.totalCard}>
          <Text style={styles.totalAmount}>{formatCents(data.totalPendingCents)}</Text>
          <Text style={styles.totalLabel}>Pending</Text>
        </View>
        <View style={styles.totalCard}>
          <Text style={styles.totalAmount}>{formatCents(data.totalPaidCents)}</Text>
          <Text style={styles.totalLabel}>Paid out</Text>
        </View>
      </View>

      {data.totalHeldCents > 0 && (
        <View style={styles.heldNotice}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.heldNoticeText}>
            {formatCents(data.totalHeldCents)} is on hold (a dispute or review). Contact support if
            this doesn&apos;t clear up.
          </Text>
        </View>
      )}

      <Text style={styles.helperText}>
        Pending earnings are released about 24 hours after each event.
      </Text>

      {/* Per-event list */}
      {data.events.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cash-outline" size={28} color={colors.textMuted} />
          <Text style={styles.mutedText}>
            No earnings yet — payments from your paid events will show up here.
          </Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {data.events.map((e, i) => (
            <EarningsRow key={e.eventId} earning={e} isLast={i === data.events.length - 1} styles={styles} />
          ))}
        </View>
      )}

      {/* Stripe dashboard link */}
      {dashboard.error && <Text style={styles.errorText}>{dashboard.error.message}</Text>}
      <Pressable
        style={styles.stripeBtn}
        onPress={() => dashboard.mutate()}
        disabled={dashboard.isPending}
        accessibilityRole="button"
        accessibilityLabel="View details on Stripe"
      >
        {dashboard.isPending ? (
          <ActivityIndicator size="small" color={colors.sectionTitle} />
        ) : (
          <>
            <Text style={styles.stripeBtnText}>View details on Stripe</Text>
            <Ionicons name="open-outline" size={16} color={colors.sectionTitle} />
          </>
        )}
      </Pressable>
      <Text style={styles.stripeHint}>
        Bank details, statements, and tax info live in your Stripe dashboard.
      </Text>
    </View>
  );
}

/** One event's earnings row: title + date on the left, net amount + status chip on the right. */
function EarningsRow({
  earning,
  isLast,
  styles,
}: {
  earning: EventEarnings;
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle} numberOfLines={1}>{earning.title}</Text>
        {!!earning.date && <Text style={styles.rowDate}>{formatEventDate(earning.date)}</Text>}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{formatCents(earning.netCents)}</Text>
        <View style={[styles.chip, styles[`chip_${earning.status}`]]}>
          <Text style={[styles.chipText, styles[`chipText_${earning.status}`]]}>
            {STATUS_LABEL[earning.status]}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Creates theme-aware styles for the HostEarnings dashboard. */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      gap: 12,
    },
    mutedText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryText: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: '500',
      padding: 8,
    },
    totalsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    totalCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    totalAmount: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    totalLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    heldNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    heldNoticeText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    helperText: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 16,
      textAlign: 'center',
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingVertical: 32,
      paddingHorizontal: 24,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 16,
    },
    listCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      gap: 12,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.menuDivider,
    },
    rowLeft: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    rowDate: {
      fontSize: 12,
      color: colors.textMuted,
    },
    rowRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    rowAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    chip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    chip_paid: {
      backgroundColor: `${colors.success}22`,
    },
    chip_pending: {
      backgroundColor: `${colors.warning}22`,
    },
    chip_held: {
      backgroundColor: `${colors.error}22`,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '600',
    },
    chipText_paid: {
      color: colors.success,
    },
    chipText_pending: {
      color: colors.warning,
    },
    chipText_held: {
      color: colors.error,
    },
    errorText: {
      fontSize: 13,
      color: colors.error,
      textAlign: 'center',
      marginBottom: 8,
    },
    stripeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    stripeBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.sectionTitle,
    },
    stripeHint: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
    },
  });
}
