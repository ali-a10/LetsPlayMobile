import { Modal, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useMemo } from 'react';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';

interface ConfirmModalProps {
  visible: boolean;
  isPending: boolean;
  error: string | null;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Generic confirmation modal with title/body/confirm label, plus loading and error states. */
export function ConfirmModal({
  visible,
  isPending,
  error,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmColor,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const buttonColor = confirmColor ?? colors.header;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttons}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={isPending}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: buttonColor }, isPending && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={isPending}
            >
              {isPending
                ? <ActivityIndicator size="small" color={sharedColors.white} />
                : <Text style={styles.confirmText}>{confirmLabel}</Text>}
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
      gap: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    body: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
    },
    error: {
      fontSize: 13,
      color: colors.error,
    },
    buttons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelBtn: {
      flex: 1,
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
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
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
