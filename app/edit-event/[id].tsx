import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';
import { useEventDetail } from '../../lib/hooks/useEventDetail';
import { useUpdateEvent } from '../../lib/hooks/useUpdateEvent';
import { getSportLabel } from '../../lib/utils/sports';

/** Formats a Date as a human-readable date string ("Sat, Jun 14, 2026"). */
function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Formats a Date as a human-readable time string ("7:45 PM"). */
function formatDisplayTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Screen for editing an existing event — only title and description are editable; everything else is shown read-only. */
export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading: eventLoading, error: eventError } = useEventDetail(id!);
  const updateMutation = useUpdateEvent(id!);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Tracks whether form has been initialized from event data
  const [initialized, setInitialized] = useState(false);

  // Synchronous guard to prevent double submission
  const submittingRef = useRef(false);

  // Editable form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<{ title?: string }>({});

  // Hide the sticky Save bar while the keyboard is open — the user explicitly didn't want it
  // floating above the keyboard.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /** Seeds the editable fields from the loaded event once, matching the edit-profile pattern. */
  useEffect(() => {
    if (event && !initialized) {
      setTitle(event.title);
      setDescription(event.description ?? '');
      setInitialized(true);
    }
  }, [event, initialized]);

  /** Bounces non-hosts back so the edit form isn't visible to anyone else. */
  useEffect(() => {
    if (!event) return;
    if (!event.isUserHost) {
      Alert.alert('Not allowed', 'Only the host can edit this event.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [event, router]);

  /** Bounces back if the underlying event fetch fails. */
  useEffect(() => {
    if (eventError) {
      Alert.alert('Error', 'Could not load this event.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [eventError, router]);

  /** Validates the title field; returns true when the form is safe to submit. */
  function validate(): boolean {
    const next: { title?: string } = {};
    if (!title.trim()) next.title = 'Title is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /** Validates the form, updates the event via mutation, and navigates back on success. */
  async function handleSave() {
    if (submittingRef.current) return;
    if (!validate()) return;

    submittingRef.current = true;

    try {
      await updateMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
      });
      Alert.alert('Success', 'Your event has been updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Something went wrong.');
    } finally {
      submittingRef.current = false;
    }
  }

  // Loading state while event data is being fetched
  if (eventLoading || !event) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.header} />
        </View>
      </SafeAreaView>
    );
  }

  const eventDate = new Date(event.date);
  const priceLabel =
    event.is_paid && event.price_cents
      ? `$${(event.price_cents / 100).toFixed(2)}`
      : 'Free';

  const dirty =
    title.trim() !== event.title ||
    (description.trim() || null) !== (event.description ?? null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Fixed back button header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Edit Event</Text>
          <Text style={styles.subtitle}>Update your event details</Text>
        </View>

        <View style={styles.form}>
          {/* Editable fields */}
          <Input
            label="Title"
            placeholder="e.g. Saturday Morning Basketball"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            maxLength={100}
            error={errors.title}
          />

          <Input
            label="Description (optional)"
            placeholder="Add details about the event..."
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />

          {/* Read-only fields — locked for now; will be openable in a later milestone */}
          <ReadOnlyField label="Sport" value={getSportLabel(event.sport)} colors={colors} />
          <ReadOnlyField label="Date" value={formatDisplayDate(eventDate)} colors={colors} />
          <ReadOnlyField label="Time" value={formatDisplayTime(eventDate)} colors={colors} />
          <ReadOnlyField label="Location" value={event.location} colors={colors} />
          <ReadOnlyField
            label="Max Participants"
            value={String(event.max_participants)}
            colors={colors}
          />
          <ReadOnlyField label="Price" value={priceLabel} colors={colors} />
        </View>
      </KeyboardAwareScrollView>

      {/* Sticky bottom bar — copies the join/leave/edit CTA from app/event/[id].tsx.
          Hidden while the keyboard is open so it doesn't float above it. */}
      {!keyboardVisible && (
        <View style={styles.stickyBar}>
          <Pressable
            style={dirty ? styles.saveBtn : styles.saveBtnDisabled}
            onPress={handleSave}
            disabled={!dirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color={sharedColors.white} />
            ) : (
              <Text style={dirty ? styles.saveBtnText : styles.saveBtnDisabledText}>
                Save Changes
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

/** Renders a labeled, non-editable field styled like the editable Inputs but visually muted with a lock icon. */
function ReadOnlyField({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readOnlyField}>
        <Text style={styles.readOnlyText} numberOfLines={2}>
          {value}
        </Text>
        <Ionicons
          name="lock-closed-outline"
          size={14}
          color={colors.textMuted}
          style={styles.readOnlyIcon}
        />
      </View>
    </View>
  );
}

/** Creates theme-aware styles for the EditEvent screen. */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
      paddingBottom: 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textMuted,
      marginTop: 8,
    },
    form: {
      width: '100%',
    },
    fieldContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 6,
    },
    readOnlyField: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 14,
      backgroundColor: colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      opacity: 0.7,
    },
    readOnlyText: {
      flex: 1,
      fontSize: 16,
      color: colors.textMuted,
    },
    readOnlyIcon: {
      marginLeft: 8,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    // Sticky CTA bar — values copied verbatim from app/event/[id].tsx so the two screens match.
    stickyBar: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 38,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    saveBtn: {
      backgroundColor: colors.buttonPrimaryBg,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: sharedColors.white,
    },
    saveBtnDisabled: {
      backgroundColor: colors.cardBorder,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveBtnDisabledText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
  });
}
