import { Modal, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { colors } from '../../lib/constants/colors';

interface JoinConfirmModalProps {
  visible: boolean;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal that asks the user to confirm joining an event, with loading and error states on the confirm button. */
export function JoinConfirmModal({ visible, isPending, error, onConfirm, onCancel }: JoinConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Join Event?</Text>
          <Text style={styles.body}>Are you sure you want to join this event?</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttons}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={isPending}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, isPending && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={isPending}
            >
              {isPending
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.confirmText}>Confirm</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: colors.white,
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
    color: colors.textLight,
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
    borderColor: colors.border,
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
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
