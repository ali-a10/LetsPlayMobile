import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
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
import { useProfile, useInvalidateProfile } from '../lib/hooks/useProfile';
import { pickAndUploadAvatar } from '../lib/utils/uploadAvatar';
import { SPORT_OPTIONS } from '../lib/constants/sports';

/** Screen for editing the current user's profile information. */
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: profileData, isLoading: loading, error: profileError } = useProfile(user?.id);
  const invalidateProfile = useInvalidateProfile();

  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const [formReady, setFormReady] = useState(false);

  // Avatar state
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  /** Populates form fields when profile data loads from the useProfile hook. */
  useEffect(() => {
    if (!profileData || formReady) return;

    setFirstName(profileData.first_name);
    setLastName(profileData.last_name);
    setPhone(profileData.phone);
    setFavouriteSports(profileData.favourite_sports ?? []);
    setAboutMe(profileData.about_me ?? '');
    setCurrentAvatarUrl(profileData.avatar_url);
    setFormReady(true);
  }, [profileData, formReady]);

  /** Navigates back if the profile query fails. */
  useEffect(() => {
    if (profileError) {
      Alert.alert('Error', 'Could not load your profile.');
      router.back();
    }
  }, [profileError]);

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

  /** Opens the image picker, uploads immediately, and stores the URL for save. */
  async function handlePickAvatar() {
    if (!user) return;
    setUploadingAvatar(true);
    const result = await pickAndUploadAvatar(user.id);
    setUploadingAvatar(false);
    if ('cancelled' in result && result.cancelled) return;
    if (!result.success) { Alert.alert('Error', result.error); return; }
    setPendingAvatarUrl(result.publicUrl);
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
        avatar_url: pendingAvatarUrl ?? currentAvatarUrl,
      })
      .eq('id', user.id);

    setSaving(false);
    submittingRef.current = false;

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      invalidateProfile(user.id);
      Alert.alert('Success', 'Your profile has been updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }

  // Loading state
  if (loading || !formReady) {
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
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrapper}>
            {pendingAvatarUrl || currentAvatarUrl ? (
              <View>
                <Image source={{ uri: pendingAvatarUrl ?? currentAvatarUrl! }} style={styles.avatarImage} />
                {uploadingAvatar && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color={colors.white} />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.avatar}>
                {uploadingAvatar
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.avatarText}>{getInitials()}</Text>
                }
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          </TouchableOpacity>
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
                style={
                  favouriteSports.includes(sport.value)
                    ? [styles.sportButton, styles.sportButtonSelected]
                    : styles.sportButton
                }
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
          textStyle={styles.saveButtonText}
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
  avatarWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarOverlay: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
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
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.darkCyan,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
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
    borderWidth: 1,
  },
  sportButtonSelected: {
    backgroundColor: colors.darkCyan,
  },

  // Text area
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Save
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.green,
  },
  saveButtonText: {
    color: colors.white,
  },
});
