import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { colors } from '../lib/constants/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/hooks/useAuth';
import { SPORT_OPTIONS } from '../lib/constants/sports';

/** Screen for editing the current user's profile information. */
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [favouriteSports, setFavouriteSports] = useState<string[]>([]);
  const [aboutMe, setAboutMe] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
  }>({});

  /** Fetches the current user's profile and pre-fills form fields. */
  useEffect(() => {
    if (!user) return;

    async function fetchProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) {
        Alert.alert('Error', 'Could not load your profile.');
        router.back();
        return;
      }

      setFirstName(data.first_name);
      setLastName(data.last_name);
      setPhone(data.phone);
      setFavouriteSports(data.favourite_sports ?? []);
      setAboutMe(data.about_me ?? '');
      setLoading(false);
    }

    fetchProfile();
  }, [user]);

  /** Returns the user's initials from current form values. */
  function getInitials(): string {
    const first = firstName?.[0] ?? '';
    const last = lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  }

  /** Toggles a sport in the favourite sports selection. */
  function toggleSport(sport: string) {
    setFavouriteSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  }

  /** Validates required fields and returns true if all pass. */
  function validate(): boolean {
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  /** Validates, saves the profile update to Supabase, and navigates back on success. */
  async function handleSave() {
    if (submittingRef.current) return;
    if (!validate()) return;
    if (!user) return;

    submittingRef.current = true;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        favourite_sports: favouriteSports.length > 0 ? favouriteSports : null,
        about_me: aboutMe.trim() || null,
      })
      .eq('id', user.id);

    setSaving(false);
    submittingRef.current = false;

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Your profile has been updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBg, { paddingTop: insets.top + 12 }]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Teal header */}
      <View style={[styles.headerBg, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
        </View>
      </View>

      {/* Form area */}
      <KeyboardAwareScrollView
        style={styles.formArea}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <Input
          label="First Name"
          placeholder="Your first name"
          value={firstName}
          onChangeText={(text) => {
            setFirstName(text);
            if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
          }}
          maxLength={50}
          error={errors.firstName}
        />

        <Input
          label="Last Name"
          placeholder="Your last name"
          value={lastName}
          onChangeText={(text) => {
            setLastName(text);
            if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }));
          }}
          maxLength={50}
          error={errors.lastName}
        />

        <Input
          label="Phone"
          placeholder="+1 555 123 4567"
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          error={errors.phone}
        />

        {/* Favourite Sports */}
        <View style={styles.sportsSection}>
          <Text style={styles.sportsLabel}>Favourite Sports</Text>
          <View style={styles.sportsContainer}>
            {SPORT_OPTIONS.map((sport) => (
              <Button
                key={sport.value}
                title={sport.label}
                variant={favouriteSports.includes(sport.value) ? 'primary' : 'outline'}
                onPress={() => toggleSport(sport.value)}
                style={styles.sportButton}
              />
            ))}
          </View>
        </View>

        <Input
          label="About Me"
          placeholder="Tell us about yourself..."
          value={aboutMe}
          onChangeText={setAboutMe}
          multiline
          numberOfLines={4}
          style={styles.textArea}
          maxLength={300}
        />

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  // Header
  headerBg: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  avatarRow: {
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.darkCyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
  },

  // Form
  formArea: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  formContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // Sports
  sportsSection: {
    marginBottom: 16,
  },
  sportsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 10,
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Text area
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Save
  saveButton: {
    marginTop: 24,
  },
});
