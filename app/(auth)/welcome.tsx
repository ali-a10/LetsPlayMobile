import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { colors } from '../../lib/constants/colors';

/** Welcome/landing screen shown to unauthenticated users before login or signup. */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>LetsPlay</Text>
        <Text style={styles.tagline}>Find your next game</Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Sign Up"
          onPress={() => router.push('/(auth)/signup')}
          variant="secondary"
          style={styles.button}
        />

        <Button
          title="Log In"
          onPress={() => router.push('/(auth)/login')}
          variant="outline"
          style={[styles.button, styles.outlineButton]}
          textStyle={styles.outlineButtonText}
        />

        <TouchableOpacity
          onPress={() => router.push('/(auth)/how-it-works')}
          style={styles.linkButton}
          accessibilityLabel="How it works"
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>How it works →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  tagline: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.8,
    marginTop: 8,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
  },
  outlineButton: {
    borderColor: colors.white,
  },
  outlineButtonText: {
    color: colors.white,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  linkText: {
    color: colors.white,
    opacity: 0.8,
    fontSize: 14,
    fontWeight: '500',
  },
});
