import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { colors } from '../../lib/constants/colors';
import { useOnboardingStore } from '../../lib/stores/onboardingStore';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

/** Step 2 of signup: collects phone, date of birth, and gender. */
export default function OnboardingDetailsScreen() {
  const router = useRouter();
  const store = useOnboardingStore();
  const [phone, setPhone] = useState(store.phone);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(
    store.dateOfBirth ? new Date(store.dateOfBirth) : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<string | null>(store.gender);
  const [errors, setErrors] = useState<{
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
  }>({});

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function validate() {
    const newErrors: typeof errors = {};

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }

    if (!gender) {
      newErrors.gender = 'Please select your gender';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleDateChange(event: any, selectedDate?: Date) {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDateOfBirth(selectedDate);
    }
  }

  function handleContinue() {
    if (!validate()) return;
    if (!dateOfBirth || !gender) return;

    store.setDetails(phone.trim(), formatDate(dateOfBirth), gender);
    router.push('/(auth)/onboarding-profile');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Details</Text>
          <Text style={styles.subtitle}>Step 2 of 3</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Phone Number"
            placeholder="+1 555 123 4567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={errors.phone}
          />

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity
              style={[
                styles.dateButton,
                errors.dateOfBirth && styles.dateButtonError,
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text
                style={[
                  styles.dateButtonText,
                  !dateOfBirth && styles.dateButtonPlaceholder,
                ]}
              >
                {dateOfBirth ? formatDisplayDate(dateOfBirth) : 'Select your date of birth'}
              </Text>
            </TouchableOpacity>
            {errors.dateOfBirth && (
              <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
            )}
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={dateOfBirth || new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
            />
          )}

          <Select
            label="Gender"
            placeholder="Select your gender"
            value={gender}
            options={GENDER_OPTIONS}
            onSelect={setGender}
            error={errors.gender}
          />

          <Button
            title="Continue"
            onPress={handleContinue}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
  button: {
    marginTop: 16,
  },
});
