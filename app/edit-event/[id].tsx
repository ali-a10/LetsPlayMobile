import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  Switch,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { colors } from '../../lib/constants/colors';
import { useEventDetail } from '../../lib/hooks/useEventDetail';
import { useUpdateEvent, UpdateEventPayload } from '../../lib/hooks/useUpdateEvent';
import { getSportLabel } from '../../lib/utils/sports';

/** Screen for editing an existing event, pre-filled with current event data. */
export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading: eventLoading } = useEventDetail(id!);
  const updateMutation = useUpdateEvent(id!);

  // Tracks whether form has been initialized from event data
  const [initialized, setInitialized] = useState(false);

  // Synchronous guard to prevent double submission
  const submittingRef = useRef(false);

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('10');
  const [price, setPrice] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<{
    title?: string;
    date?: string;
    location?: string;
    maxParticipants?: string;
    price?: string;
  }>({});

  // Pre-fill form when event data loads (only once)
  useEffect(() => {
    if (event && !initialized) {
      setTitle(event.title);
      setDate(new Date(event.date));
      setLocation(event.location);
      setDescription(event.description ?? '');
      setMaxParticipants(String(event.max_participants));
      if (event.is_paid && event.price != null) {
        setPrice(event.price.toFixed(2));
      }
      setInitialized(true);
    }
  }, [event, initialized]);

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

  /** Formats a Date for user-friendly display. */
  function formatDisplayDateTime(d: Date): string {
    return d.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /** Handles the date portion selection from the native picker. */
  function handleDateChange(_event: any, selectedDate?: Date) {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const existing = date || new Date();
      selectedDate.setHours(existing.getHours(), existing.getMinutes());
      setDate(selectedDate);
      if (errors.date) setErrors(prev => ({ ...prev, date: undefined }));

      // On Android, chain to the time picker after date selection
      if (Platform.OS === 'android') {
        setTimeout(() => setShowTimePicker(true), 300);
      }
    }
  }

  /** Handles the time portion selection from the native picker. */
  function handleTimeChange(_event: any, selectedTime?: Date) {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime && date) {
      const updated = new Date(date);
      updated.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDate(updated);
    }
  }

  /** Validates all required fields and sets error messages. */
  function validate(): boolean {
    const newErrors: typeof errors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!date) {
      newErrors.date = 'Date and time are required';
    } else if (date <= new Date()) {
      newErrors.date = 'Event must be in the future';
    }

    if (!location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!maxParticipants.trim()) {
      newErrors.maxParticipants = 'Max participants is required';
    } else {
      const parsedMax = parseInt(maxParticipants, 10);
      if (isNaN(parsedMax) || parsedMax < 2 || parsedMax > 100) {
        newErrors.maxParticipants = 'Must be between 2 and 100';
      }
    }

    if (event?.is_paid) {
      const parsedPrice = parseFloat(price);
      if (!price.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
        newErrors.price = 'Enter a valid price';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  /** Validates the form, updates the event via mutation, and navigates back on success. */
  async function handleSave() {
    if (submittingRef.current) return;
    if (!validate()) return;

    submittingRef.current = true;

    const payload: UpdateEventPayload = {
      title: title.trim(),
      date: date!.toISOString(),
      location: location.trim(),
      description: description.trim() || null,
      max_participants: parseInt(maxParticipants, 10) || 10,
      price: event?.is_paid ? parseFloat(price) : null,
    };

    try {
      await updateMutation.mutateAsync(payload);
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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

          {/* Sport field (read-only) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Sport</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{getSportLabel(event.sport)}</Text>
            </View>
          </View>

          {/* Date & Time picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Date & Time</Text>
            <TouchableOpacity
              style={[
                styles.dateButton,
                errors.date && styles.dateButtonError,
              ]}
              onPress={() => {
                Keyboard.dismiss();
                setShowDatePicker(true);
              }}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  !date && styles.dateButtonPlaceholder,
                ]}
              >
                {date ? formatDisplayDateTime(date) : 'Select date and time'}
              </Text>
            </TouchableOpacity>
            {errors.date && (
              <Text style={styles.errorText}>{errors.date}</Text>
            )}
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={date || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}

          {/* iOS picker dismiss buttons */}
          {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
            <View style={styles.pickerActions}>
              {showDatePicker && (
                <Button
                  title="Pick Time"
                  variant="outline"
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(true);
                  }}
                  style={styles.pickerButton}
                />
              )}
              <Button
                title="Done"
                variant="outline"
                onPress={() => {
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                }}
                style={styles.pickerButton}
              />
            </View>
          )}

          <Input
            label="Location"
            placeholder="e.g. Central Park Court 3"
            value={location}
            onChangeText={(text) => {
              setLocation(text);
              if (errors.location) setErrors(prev => ({ ...prev, location: undefined }));
            }}
            maxLength={100}
            error={errors.location}
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

          {/* Paid event toggle — only shown for paid events, locked ON */}
          {event.is_paid && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Paid Event</Text>
                <Switch
                  value={true}
                  disabled
                  trackColor={{ false: colors.gray[200], true: colors.secondary }}
                  thumbColor={colors.primary}
                />
              </View>

              <Input
                label="Price ($)"
                placeholder="0.00"
                value={price}
                onChangeText={handlePriceChange}
                onBlur={handlePriceBlur}
                keyboardType="decimal-pad"
                error={errors.price}
              />
            </>
          )}

          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={updateMutation.isPending}
            style={styles.submitButton}
          />
        </View>
    </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textLight,
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
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    backgroundColor: colors.gray[50],
  },
  readOnlyText: {
    fontSize: 16,
    color: colors.textLight,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    backgroundColor: colors.background,
  },
  dateButtonError: {
    borderColor: colors.error,
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  dateButtonPlaceholder: {
    color: colors.textLight,
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
    color: colors.textLight,
    marginTop: -12,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 40,
  },
});
