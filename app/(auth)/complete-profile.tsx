import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { colors } from '../../lib/constants/colors';
import { supabase } from '../../lib/supabase';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
  }>({});

  function validate() {
    const newErrors: typeof errors = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!dateOfBirth.trim()) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      newErrors.dateOfBirth = 'Use format YYYY-MM-DD';
    }

    if (!gender) {
      newErrors.gender = 'Please select your gender';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleComplete() {
    if (!validate()) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      Alert.alert('Error', 'No user found. Please sign up again.');
      setLoading(false);
      return;
    }

    if (!gender) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('profiles').insert([
      {
        id: user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: user.email,
        phone: phone.trim(),
        date_of_birth: dateOfBirth,
        gender: gender,
      },
    ]);

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/(tabs)');
    }
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
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Tell us a bit about yourself</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="First Name"
            placeholder="John"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
            error={errors.firstName}
          />

          <Input
            label="Last Name"
            placeholder="Doe"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoComplete="family-name"
            error={errors.lastName}
          />

          <Input
            label="Phone Number"
            placeholder="+1 555 123 4567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={errors.phone}
          />

          <Input
            label="Date of Birth"
            placeholder="YYYY-MM-DD"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numbers-and-punctuation"
            error={errors.dateOfBirth}
          />

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
            onPress={handleComplete}
            loading={loading}
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
  button: {
    marginTop: 16,
  },
});
