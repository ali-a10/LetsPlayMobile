import { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';
import { ReportReason } from '../../lib/types/database';
import { useReportUser } from '../../lib/hooks/useReportUser';

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate behavior' },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'spam', label: 'Spam' },
  { value: 'host_no_show', label: 'Host no-show' },
  { value: 'other', label: 'Other' },
];

const MAX_DETAILS_LENGTH = 1000;

interface ReportUserModalProps {
  visible: boolean;
  targetUserId: string;
  targetName: string;
  onClose: () => void;
  onSuccess: () => void;
  /** Links the report to an event (needed for a host no-show report to hold the payout). */
  eventId?: string;
  /** When set, the reason is fixed to this value and the picker is hidden (e.g. a no-show report). */
  presetReason?: ReportReason;
}

/** Modal that collects a reason and optional details, then submits a report for the given user. */
export function ReportUserModal({
  visible,
  targetUserId,
  targetName,
  onClose,
  onSuccess,
  eventId,
  presetReason,
}: ReportUserModalProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reportMutation = useReportUser();

  const isReasonLocked = !!presetReason;
  const [reason, setReason] = useState<ReportReason | null>(presetReason ?? null);
  const [details, setDetails] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Resets local form state to a clean slate. */
  const resetForm = () => {
    setReason(presetReason ?? null);
    setDetails('');
    setReasonError(null);
    setSubmitError(null);
  };

  /** Closes the modal and clears form state if a submission is not in flight. */
  const handleClose = () => {
    if (reportMutation.isPending) return;
    Keyboard.dismiss();
    resetForm();
    onClose();
  };

  /** Validates and submits the report; on success, resets state and notifies the parent. */
  const handleSubmit = () => {
    Keyboard.dismiss();
    setSubmitError(null);
    if (!reason) {
      setReasonError('Please pick a reason.');
      return;
    }
    setReasonError(null);
    reportMutation.mutate(
      { reportedId: targetUserId, reason, details, eventId },
      {
        onSuccess: () => {
          resetForm();
          onSuccess();
        },
        onError: (err) => setSubmitError(err.message),
      },
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <Pressable style={styles.backdrop} onPress={() => Keyboard.dismiss()}>
          {/* Inner Pressable swallows taps so the card doesn't dismiss the keyboard, but
              Text taps inside still bubble up — buttons fire via their own Pressables. */}
          <Pressable style={styles.card} onPress={() => Keyboard.dismiss()}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.title}>Report {targetName}</Text>
              <Text style={styles.body}>
                {isReasonLocked
                  ? `Report ${targetName} for not showing up as the host of this event. Our team will review it. Reports are confidential and the host isn't notified.`
                  : "Tell us what's going on. Reports are reviewed by our team and the reported user is not notified."}
              </Text>

              <Text style={styles.fieldLabel}>Reason</Text>
              {isReasonLocked ? (
                <View style={styles.reasonLocked}>
                  <Text style={styles.reasonLockedText}>
                    {REASON_OPTIONS.find((o) => o.value === reason)?.label ?? 'Host no-show'}
                  </Text>
                </View>
              ) : (
                <View style={styles.reasonList}>
                  {REASON_OPTIONS.map((opt) => {
                    const selected = reason === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setReason(opt.value);
                          setReasonError(null);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <View style={[styles.radio, selected && styles.radioSelected]}>
                          {selected && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.reasonLabel}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {reasonError && <Text style={styles.error}>{reasonError}</Text>}

              <Text style={styles.fieldLabel}>Details (optional)</Text>
              <TextInput
                style={styles.detailsInput}
                value={details}
                onChangeText={setDetails}
                placeholder="Add more context..."
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                textAlignVertical="top"
                maxLength={MAX_DETAILS_LENGTH}
                editable={!reportMutation.isPending}
              />
              <Text
                style={[
                  styles.counter,
                  details.length >= MAX_DETAILS_LENGTH && styles.counterAtLimit,
                ]}
              >
                {details.length}/{MAX_DETAILS_LENGTH}
              </Text>

              {submitError && <Text style={styles.error}>{submitError}</Text>}

              <View style={styles.buttons}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={handleClose}
                  disabled={reportMutation.isPending}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.submitBtn,
                    { backgroundColor: colors.error },
                    reportMutation.isPending && styles.btnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={reportMutation.isPending}
                >
                  {reportMutation.isPending ? (
                    <ActivityIndicator size="small" color={sharedColors.white} />
                  ) : (
                    <Text style={styles.submitText}>Submit report</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      width: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      padding: 22,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    body: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 16,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      marginTop: 4,
    },
    reasonList: {
      gap: 4,
      marginBottom: 4,
    },
    reasonLocked: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: colors.chipInactiveBg,
      marginBottom: 4,
    },
    reasonLockedText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 8,
    },
    reasonRowSelected: {
      backgroundColor: colors.chipInactiveBg,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: colors.error,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.error,
    },
    reasonLabel: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    detailsInput: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: colors.inputText,
      backgroundColor: colors.inputBg,
      minHeight: 88,
      maxHeight: 140,
    },
    counter: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: 4,
    },
    counterAtLimit: {
      color: colors.error,
      fontWeight: '600',
    },
    error: {
      fontSize: 13,
      color: colors.error,
      marginTop: 6,
    },
    buttons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
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
    submitBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    submitText: {
      fontSize: 15,
      fontWeight: '600',
      color: sharedColors.white,
    },
    btnDisabled: {
      opacity: 0.6,
    },
  });
}
