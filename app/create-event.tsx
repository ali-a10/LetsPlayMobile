import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  Switch,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { LocationAutocomplete, SelectedPlace } from '../components/ui/LocationAutocomplete';
import { useThemeColors } from '../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../lib/constants/colors';
import { SPORT_OPTIONS } from '../lib/constants/sports';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/hooks/useAuth';
import { usePayoutStatus } from '../lib/hooks/useStripePayouts';
import { PAID_EVENTS_ENABLED } from '../lib/constants/featureFlags';
import { friendlyErrorMessage } from '../lib/utils/errors';

/** Screen for creating a new sports event. */
export default function CreateEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Only query payout status while the payments feature is on; gate the paid toggle behind it.
  const { data: payoutStatus } = usePayoutStatus(PAID_EVENTS_ENABLED ? user?.id : undefined);
  const paidGated = PAID_EVENTS_ENABLED && !(payoutStatus?.payoutsEnabled ?? false);

  // Synchronous guard to prevent double submission
  const submittingRef = useRef(false);

  // Buffer picker scroll values on iOS so we don't pass them back as value= mid-scroll
  // (feeding state back into the native spinner while it's moving causes it to reset)
  const pendingDateRef = useRef<Date | null>(null);
  const pendingTimeRef = useRef<Date | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<'date' | 'time' | null>(null);
  const [place, setPlace] = useState<SelectedPlace | null>(null);
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('10');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{
    title?: string;
    sport?: string;
    date?: string;
    location?: string;
    maxParticipants?: string;
    price?: string;
  }>({});

  /** Strips invalid characters from price input, keeping digits, one dot, and max 2 decimal places. */
  function handlePriceChange(text: string) {
    let cleaned = text.replace(/[^0-9.]/g, '');
    const dotIndex = cleaned.indexOf('.');
    if (dotIndex !== -1) {
      cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '');
    }
    const parts = cleaned.split('.');
    if (parts[1]?.length > 2) {
      cleaned = parts[0] + '.' + parts[1].slice(0, 2);
    }
    setPrice(cleaned);
    if (errors.price) setErrors(prev => ({ ...prev, price: undefined }));
  }

  /** Normalizes the price to 2 decimal places when the user leaves the field. */
  function handlePriceBlur() {
    if (!price) return;
    const num = parseFloat(price);
    if (!isNaN(num) && num > 0) {
      setPrice(num.toFixed(2));
    } else if (price.endsWith('.')) {
      setPrice(price.slice(0, -1));
    }
  }

  /** Strips non-digit characters and shows an inline error if out of range. */
  function handleMaxParticipantsChange(text: string) {
    const cleaned = text.replace(/[^0-9]/g, '');
    setMaxParticipants(cleaned);
    const num = parseInt(cleaned, 10);
    if (cleaned && (num < 2 || num > 100)) {
      setErrors(prev => ({ ...prev, maxParticipants: 'Must be between 2 and 100' }));
    } else {
      setErrors(prev => ({ ...prev, maxParticipants: undefined }));
    }
  }

  /** Formats a Date as a human-readable date string. */
  function formatDisplayDate(d: Date): string {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /** Formats a Date as a human-readable time string. */
  function formatDisplayTime(d: Date): string {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /** Handles the date selection from the native date picker. */
  function handleDateChange(_event: any, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setActivePicker(null);
      if (selectedDate) {
        setDate(selectedDate);
        if (errors.date) setErrors(prev => ({ ...prev, date: undefined }));
      }
      return;
    }
    // iOS: buffer the value — do not write back to state mid-scroll
    if (selectedDate) pendingDateRef.current = selectedDate;
  }

  /** Handles the time selection from the native time picker. */
  function handleTimeChange(_event: any, selectedTime?: Date) {
    if (Platform.OS === 'android') {
      setActivePicker(null);
      if (selectedTime) {
        setTime(selectedTime);
        if (errors.date) setErrors(prev => ({ ...prev, date: undefined }));
      }
      return;
    }
    // iOS: buffer the value — do not write back to state mid-scroll
    if (selectedTime) pendingTimeRef.current = selectedTime;
  }

  /** Validates all required fields and sets error messages. */
  function validate(): boolean {
    const newErrors: typeof errors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!sport) {
      newErrors.sport = 'Please select a sport';
    }

    if (!date || !time) {
      newErrors.date = 'Date and time are required';
    } else {
      const combined = new Date(date);
      combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
      if (combined <= new Date()) {
        newErrors.date = 'Event must be in the future';
      }
    }

    if (!place) {
      newErrors.location = 'Please select a location';
    }

    if (!maxParticipants.trim()) {
      newErrors.maxParticipants = 'Max participants is required';
    } else {
      const parsedMax = parseInt(maxParticipants, 10);
      if (isNaN(parsedMax) || parsedMax < 2 || parsedMax > 100) {
        newErrors.maxParticipants = 'Must be between 2 and 100';
      }
    }

    if (isPaid) {
      const parsedPrice = parseFloat(price);
      if (!price.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
        newErrors.price = 'Enter a valid price';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  /** Validates the form, inserts the event into Supabase, and navigates to home on success. */
  async function handleCreate() {
    if (submittingRef.current) return;
    if (!validate()) return;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create an event.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      // Host is automatically enrolled as a participant via the auto_enroll_host_on_event_create trigger
      const combined = new Date(date!);
      combined.setHours(time!.getHours(), time!.getMinutes(), 0, 0);
      const { error } = await supabase.from('events').insert([
        {
          host_id: user.id,
          title: title.trim(),
          sport: sport!,
          date: combined.toISOString(),
          location: place!.address,
          latitude: place!.latitude,
          longitude: place!.longitude,
          description: description.trim() || null,
          max_participants: parseInt(maxParticipants, 10) || 10,
          is_paid: isPaid,
          price_cents: isPaid ? Math.round(parseFloat(price) * 100) : null,
        },
      ]);

      if (error) {
        console.error('Event creation failed:', error);
        Alert.alert('Error', friendlyErrorMessage(error));
      } else {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['my-hosted-events', user.id] });
        queryClient.invalidateQueries({ queryKey: ['my-joined-events', user.id] });
        queryClient.invalidateQueries({ queryKey: ['userStats', user.id] });
        setTitle('');
        setSport(null);
        setDate(null);
        setTime(null);
        setPlace(null);
        setDescription('');
        setMaxParticipants('10');
        setIsPaid(false);
        setPrice('');
        setErrors({});

        Alert.alert('Success', 'Your event has been created!', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') },
        ]);
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Teal header */}
      <View style={[styles.headerBg, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={sharedColors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <Text style={styles.headerSubtitle}>Set up a new game or activity</Text>
      </View>

      <KeyboardAwareScrollView
        style={styles.formArea}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          <Input
            label="Title"
            placeholder="e.g. Saturday Morning Basketball"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
            }}
            maxLength={100}
            error={errors.title}
          />

          <Select
            label="Sport"
            placeholder="Select a sport"
            value={sport}
            options={SPORT_OPTIONS}
            onSelect={(value) => {
              setSport(value);
              if (errors.sport) setErrors(prev => ({ ...prev, sport: undefined }));
            }}
            error={errors.sport}
          />

          {/* Date & Time pickers */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={[
                styles.dateButton,
                errors.date && styles.dateButtonError,
              ]}
              onPress={() => {
                Keyboard.dismiss();
                pendingDateRef.current = null;
                setActivePicker('date');
              }}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  !date && styles.dateButtonPlaceholder,
                ]}
              >
                {date ? formatDisplayDate(date) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>

          {activePicker === 'date' && (
            <DateTimePicker
              value={date || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Time</Text>
            <TouchableOpacity
              style={[
                styles.dateButton,
                errors.date && styles.dateButtonError,
              ]}
              onPress={() => {
                Keyboard.dismiss();
                pendingTimeRef.current = null;
                setActivePicker('time');
              }}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  !time && styles.dateButtonPlaceholder,
                ]}
              >
                {time ? formatDisplayTime(time) : 'Select time'}
              </Text>
            </TouchableOpacity>
            {errors.date && (
              <Text style={styles.errorText}>{errors.date}</Text>
            )}
          </View>

          {activePicker === 'time' && (
            <DateTimePicker
              value={time || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}

          {/* iOS Done button — shown below whichever picker is active */}
          {Platform.OS === 'ios' && activePicker !== null && (
            <View style={styles.pickerActions}>
              <Button
                title="Done"
                variant="outline"
                onPress={() => {
                  // Fall back to the picker's displayed value when the user taps Done
                  // without scrolling (no onChange fires, so the pending ref is still null).
                  if (activePicker === 'date') {
                    setDate(pendingDateRef.current ?? date ?? new Date());
                    if (errors.date) setErrors(prev => ({ ...prev, date: undefined }));
                    pendingDateRef.current = null;
                  } else if (activePicker === 'time') {
                    setTime(pendingTimeRef.current ?? time ?? new Date());
                    if (errors.date) setErrors(prev => ({ ...prev, date: undefined }));
                    pendingTimeRef.current = null;
                  }
                  setActivePicker(null);
                }}
                style={styles.pickerButton}
              />
            </View>
          )}

          <LocationAutocomplete
            label="Location"
            error={errors.location}
            onSelect={(selected) => {
              setPlace(selected);
              if (errors.location) setErrors(prev => ({ ...prev, location: undefined }));
            }}
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

          <View style={styles.fieldContainer}>
            <Input
              label="Max Participants"
              placeholder="10"
              value={maxParticipants}
              onChangeText={handleMaxParticipantsChange}
              keyboardType="number-pad"
              error={errors.maxParticipants}
            />
            <Text style={styles.hintText}>Max 100 participants</Text>
          </View>

          {/* Paid event toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Paid Event</Text>
            <Switch
              value={isPaid}
              onValueChange={setIsPaid}
              disabled={paidGated}
              trackColor={{ false: colors.inputBorder, true: colors.accent }}
              thumbColor={isPaid ? colors.header : colors.chevron}
            />
          </View>

          {paidGated && (
            <TouchableOpacity
              style={styles.payoutBanner}
              onPress={() => router.push('/payouts')}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle-outline" size={20} color={colors.header} />
              <Text style={styles.payoutBannerText}>Set up payouts to create paid events.</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.header} />
            </TouchableOpacity>
          )}

          {isPaid && (
            <Input
              label="Price ($)"
              placeholder="0.00"
              value={price}
              onChangeText={handlePriceChange}
              onBlur={handlePriceBlur}
              keyboardType="decimal-pad"
              error={errors.price}
            />
          )}

          <Button
            title="Create Event"
            onPress={handleCreate}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

/** Creates theme-aware styles for the CreateEvent screen. */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.header,
    },

    // Header
    headerBg: {
      backgroundColor: colors.header,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    backButton: {
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: sharedColors.white,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 14,
      color: sharedColors.white,
      opacity: 0.8,
      marginTop: 2,
      marginBottom: 5,
      textAlign: 'center',
    },

    // Form area
    formArea: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    formContent: {
      padding: 24,
      paddingBottom: 40,
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
    dateButton: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 14,
      backgroundColor: colors.inputBg,
    },
    dateButtonError: {
      borderColor: colors.error,
    },
    dateButtonText: {
      fontSize: 16,
      color: colors.text,
    },
    dateButtonPlaceholder: {
      color: colors.inputPlaceholder,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingVertical: 8,
    },
    switchLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    payoutBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    payoutBannerText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
    },
    pickerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginBottom: 16,
    },
    pickerButton: {
      height: 36,
      paddingHorizontal: 16,
    },
    hintText: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: -12,
    },
    submitButton: {
      marginTop: 24,
      marginBottom: 40,
    },
  });
}
