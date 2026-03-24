import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { colors } from '../../lib/constants/colors';
import { supabase } from '../../lib/supabase';

/** Sends a password reset email to the user with a deep link back to the app. */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  function validate() {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Enter a valid email');
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSend() {
    if (!validate()) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'letsplay://auth/reset-password',
    });
    setLoading(false);

    if (error) {
      setEmailError(error.message);
    } else {
      setSent(true);
    }
  }

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Forgot password?</Text>
            <Text style={styles.subtitle}>
              Enter the email you signed up with and we'll send you a reset link.
            </Text>
          </View>

          {sent ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successText}>
                We sent a reset link to {email}. Tap the link in the email to set a new password.
              </Text>
              <Button
                title="Back to login"
                onPress={() => router.replace('/(auth)/login')}
                style={styles.backButton}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={emailError}
              />

              <Button
                title="Send reset link"
                onPress={handleSend}
                loading={loading}
                style={styles.button}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textLight,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: 8,
  },
  successBox: {
    alignItems: 'center',
    gap: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  successText: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    marginTop: 8,
    width: '100%',
  },
});
