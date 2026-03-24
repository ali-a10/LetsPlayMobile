import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { colors } from '../../lib/constants/colors';
import { supabase } from '../../lib/supabase';

/** Allows the user to set a new password after arriving via a reset email link. */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [sessionError, setSessionError] = useState('');

  function validate() {
    const newErrors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    setLoading(true);
    setSessionError('');

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      // Token expired or already used
      if (error.message.toLowerCase().includes('session') || error.message.toLowerCase().includes('token')) {
        setSessionError('This reset link has expired or already been used. Please request a new one.');
      } else {
        setSessionError(error.message);
      }
      return;
    }

    // Password updated — sign out so user logs in fresh with the new password
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Set new password</Text>
            <Text style={styles.subtitle}>Choose a new password for your account.</Text>
          </View>

          {sessionError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{sessionError}</Text>
              <Button
                title="Request a new link"
                onPress={() => router.replace('/(auth)/forgot-password')}
                style={styles.retryButton}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                label="New password"
                placeholder="At least 6 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                error={errors.password}
              />

              <Input
                label="Confirm new password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                error={errors.confirmPassword}
              />

              <Button
                title="Save new password"
                onPress={handleSave}
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
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorBoxText: {
    fontSize: 15,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    width: '100%',
  },
});
