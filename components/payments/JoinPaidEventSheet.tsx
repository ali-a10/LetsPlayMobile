import { Modal, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useMemo } from 'react';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';
import { PaymentBreakdown } from './PaymentBreakdown';
import { computeFees, formatCents } from '../../lib/utils/fees';

interface JoinPaidEventSheetProps {
  visible: boolean;
  eventTitle: string;
  priceCents: number;
  isProcessing: boolean;
  error: string | null;
  onPay: () => void;
  onCancel: () => void;
}

/** Confirmation modal for joining a paid event: shows the fee breakdown and a "Pay $X.XX" action. */
export function JoinPaidEventSheet({
  visible,
  eventTitle,
  priceCents,
  isProcessing,
  error,
  onPay,
  onCancel,
}: JoinPaidEventSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const total = computeFees(priceCents).amount_total_cents;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title} numberOfLines={2}>
            Join {eventTitle}
          </Text>

          <PaymentBreakdown priceCents={priceCents} />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttons}>
            <Pressable
              style={[styles.payBtn, isProcessing && styles.btnDisabled]}
              onPress={onPay}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={sharedColors.white} />
              ) : (
                <Text style={styles.payText}>Pay {formatCents(total)}</Text>
              )}
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={isProcessing}>
              <Text style={styles.cancelText}>Cancel</Text>
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
    error: {
      fontSize: 13,
      color: colors.error,
    },
    buttons: {
      flexDirection: 'column',
      gap: 12,
      marginTop: 4,
    },
    cancelBtn: {
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    payBtn: {
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.header,
    },
    payText: {
      fontSize: 15,
      fontWeight: '600',
      color: sharedColors.white,
    },
    btnDisabled: {
      opacity: 0.6,
    },
  });
}
