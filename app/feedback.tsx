import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useThemeColors } from '../lib/hooks/useThemeColors';
import { ThemeColors } from '../lib/constants/colors';
import { useSubmitFeedback } from '../lib/hooks/useSubmitFeedback';
import { FeedbackCategory } from '../lib/types/database';

const MAX_MESSAGE_LENGTH = 1000;

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other', label: 'Other' },
];

/** Feedback screen with a category selector and a message textbox. Inserts into the `feedback` table. */
export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');

  // Synchronous guard to prevent double submission via rapid taps.
  const submittingRef = useRef(false);
  const submitFeedback = useSubmitFeedback();

  const canSubmit = category !== null && message.trim().length > 0;

  /** Submits the feedback and on success shows an alert that navigates back to Profile. */
  async function handleSubmit() {
    if (submittingRef.current) return;
    if (!canSubmit || category === null) return;

    submittingRef.current = true;
    try {
      await submitFeedback.mutateAsync({ category, message });
      Alert.alert('Thanks!', 'Your feedback has been sent.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Couldn't send feedback", err instanceof Error ? err.message : 'Please try again.');
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Us Feedback</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Have an idea or noticed something off? Let us know.
          </Text>

          <Select
            label="Category"
            placeholder="Select a category"
            value={category}
            options={CATEGORY_OPTIONS}
            onSelect={(value) => setCategory(value as FeedbackCategory)}
          />

          <Input
            label="Message"
            placeholder="What's on your mind?"
            value={message}
            onChangeText={setMessage}
            maxLength={MAX_MESSAGE_LENGTH}
            multiline
            numberOfLines={6}
            style={styles.messageInput}
          />
          <Text style={styles.counter}>
            {message.length} / {MAX_MESSAGE_LENGTH}
          </Text>

          <Button
            title="Send Feedback"
            onPress={handleSubmit}
            loading={submitFeedback.isPending}
            disabled={!canSubmit}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 40,
    },
    intro: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 20,
    },
    messageInput: {
      height: 140,
      paddingTop: 14,
      paddingBottom: 14,
      textAlignVertical: 'top',
    },
    counter: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: -8,
      marginBottom: 8,
    },
    submitButton: {
      marginTop: 16,
    },
  });
}
