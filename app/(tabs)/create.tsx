import { useState, useRef } from 'react';
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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { colors } from '../../lib/constants/colors';
import { SPORT_OPTIONS } from '../../lib/constants/sports';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/hooks/useAuth';
import { friendlyErrorMessage } from '../../lib/utils/errors';

/** Screen for creating a new sports event. */
export default function CreateEventScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Synchronous guard to prevent double submission
  const submittingRef = useRef(false);

  // Form state
  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
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

    if (!sport) {
      newErrors.sport = 'Please select a sport';
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
      const { error } = await supabase.from('events').insert([
        {
          host_id: user.id,
          title: title.trim(),
          sport: sport!,
          date: date!.toISOString(),
          location: location.trim(),
          description: description.trim() || null,
          max_participants: parseInt(maxParticipants, 10) || 10,
          is_paid: isPaid,
          price: isPaid ? parseFloat(price) : null,
        },
      ]);

      if (error) {
        console.error('Event creation failed:', error);
        Alert.alert('Error', friendlyErrorMessage(error));
      } else {
        setTitle('');
        setSport(null);
        setDate(null);
        setLocation('');
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
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={20}
    >
        <View style={styles.header}>
          <Text style={styles.title}>Create Event</Text>
          <Text style={styles.subtitle}>Set up a new game or activity</Text>
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

          {/* Paid event toggle */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Paid Event</Text>
            <Switch
              value={isPaid}
              onValueChange={setIsPaid}
              trackColor={{ false: colors.gray[200], true: colors.secondary }}
              thumbColor={isPaid ? colors.primary : colors.gray[400]}
            />
          </View>

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
  );
}

const styles = StyleSheet.create({
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
