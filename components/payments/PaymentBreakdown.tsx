import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors } from '../../lib/constants/colors';
import { computeFees, formatCents } from '../../lib/utils/fees';

interface PaymentBreakdownProps {
  priceCents: number;
}

/** Shows the itemized cost of joining a paid event: event price, a combined service & processing fee, and the total. */
export function PaymentBreakdown({ priceCents }: PaymentBreakdownProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fees = computeFees(priceCents);
  const feeCents = fees.amount_platform_fee_cents + fees.amount_stripe_fee_cents;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Event price</Text>
        <Text style={styles.value}>{formatCents(fees.amount_host_cents)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Service & processing fee</Text>
        <Text style={styles.value}>{formatCents(feeCents)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCents(fees.amount_total_cents)}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: {
      fontSize: 15,
      color: colors.textMuted,
    },
    value: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    divider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginVertical: 2,
    },
    totalLabel: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '700',
    },
    totalValue: {
      fontSize: 18,
      color: colors.text,
      fontWeight: '700',
    },
  });
}
