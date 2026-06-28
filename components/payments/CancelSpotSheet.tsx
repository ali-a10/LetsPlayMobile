import { Modal, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useMemo } from 'react';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';
import { computeFees, formatCents } from '../../lib/utils/fees';

interface CancelSpotSheetProps {
  visible: boolean;
  eventTitle: string;
  priceCents: number;
  isProcessing: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation modal for cancelling a paid spot: shows the refund amount (processing fees withheld) and a confirm action. */
export function CancelSpotSheet({
  visible,
  eventTitle,
  priceCents,
  isProcessing,
  error,
  onConfirm,
  onCancel,
}: CancelSpotSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fees = computeFees(priceCents);
  // Refund = everything except the Stripe processing fee (mirrors refund-participant server math).
  const refundCents = fees.amount_total_cents - fees.amount_stripe_fee_cents;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title} numberOfLines={2}>
            Cancel your spot in {eventTitle}?
          </Text>

          <View style={styles.breakdown}>
            <View style={styles.row}>
              <Text style={styles.label}>You paid</Text>
              <Text style={styles.value}>{formatCents(fees.amount_total_cents)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.refundLabel}>Refund</Text>
              <Text style={styles.refundValue}>{formatCents(refundCents)}</Text>
            </View>
          </View>

          <Text style={styles.note}>Payment processing fees are non-refundable.</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttons}>
            <Pressable
              style={[styles.confirmBtn, isProcessing && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={sharedColors.white} />
              ) : (
                <Text style={styles.confirmText}>Cancel & refund</Text>
              )}
            </Pressable>
            <Pressable style={styles.keepBtn} onPress={onCancel} disabled={isProcessing}>
              <Text style={styles.keepText}>Keep my spot</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      gap: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    breakdown: {
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
    refundLabel: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '700',
    },
    refundValue: {
      fontSize: 18,
      color: colors.success,
      fontWeight: '700',
    },
    note: {
      fontSize: 13,
      color: colors.textMuted,
    },
    error: {
      fontSize: 13,
      color: colors.error,
    },
    buttons: {
      flexDirection: 'column',
      gap: 12,
      marginTop: 4,
    },
    keepBtn: {
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    keepText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    confirmBtn: {
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.error,
    },
    confirmText: {
      fontSize: 15,
      fontWeight: '600',
      color: sharedColors.white,
    },
    btnDisabled: {
      opacity: 0.6,
    },
  });
}
