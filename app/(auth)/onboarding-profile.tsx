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
import { colors } from '../../lib/constants/colors';
import { supabase } from '../../lib/supabase';
import { useOnboardingStore } from '../../lib/stores/onboardingStore';

const SPORT_OPTIONS = [
  { label: 'Basketball', value: 'basketball' },
  { label: 'Soccer', value: 'soccer' },
  { label: 'Tennis', value: 'tennis' },
  { label: 'Volleyball', value: 'volleyball' },
  { label: 'Running', value: 'running' },
  { label: 'Swimming', value: 'swimming' },
  { label: 'Cycling', value: 'cycling' },
  { label: 'Golf', value: 'golf' },
];

/** Step 3 of signup: collects optional profile details and inserts the profile row. */
export default function OnboardingProfileScreen() {
  const router = useRouter();
  const store = useOnboardingStore();
  const [favouriteSports, setFavouriteSports] = useState<string[]>(
    store.favouriteSports
  );
  const [aboutMe, setAboutMe] = useState(store.aboutMe);
  const [loading, setLoading] = useState(false);

  function toggleSport(sport: string) {
    setFavouriteSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  }

  async function handleComplete() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      Alert.alert('Error', 'No user found. Please sign up again.');
      setLoading(false);
      return;
    }

    if (!store.gender) {
      Alert.alert('Error', 'Missing profile data. Please go back and complete all steps.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('profiles').insert([
      {
        id: user.id,
        first_name: store.firstName,
        last_name: store.lastName,
        email: user.email,
        phone: store.phone,
        date_of_birth: store.dateOfBirth,
        gender: store.gender,
        favourite_sports: favouriteSports,
        about_me: aboutMe.trim() || null,
        avatar_url: store.avatarUrl,
      },
    ]);

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      store.reset();
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
          <Text style={styles.title}>Your Profile</Text>
          <Text style={styles.subtitle}>Step 3 of 3</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionLabel}>Favourite Sports (optional)</Text>
          <View style={styles.sportsContainer}>
            {SPORT_OPTIONS.map((sport) => (
              <Button
                key={sport.value}
                title={sport.label}
                variant={
                  favouriteSports.includes(sport.value) ? 'primary' : 'outline'
                }
                onPress={() => toggleSport(sport.value)}
                style={styles.sportButton}
              />
            ))}
          </View>

          <Input
            label="About Me (optional)"
            placeholder="Tell us about yourself..."
            value={aboutMe}
            onChangeText={setAboutMe}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />

          <Button
            title="Complete Profile"
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
    padding: 24,
    paddingTop: 80,
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 12,
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  sportButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 24,
  },
});
