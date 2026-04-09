import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { SportsFieldBackground } from '../../components/ui/SportsFieldBackground';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';

/** Welcome/landing screen shown to unauthenticated users before login or signup. */
export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <SportsFieldBackground />

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.header,
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
      color: sharedColors.white,
    },
    tagline: {
      fontSize: 16,
      color: sharedColors.white,
      opacity: 0.8,
      marginTop: 8,
    },
    actions: {
      width: '100%',
      gap: 12,
    },
    button: {
      width: '85%',
      alignSelf: 'center',
    },
    outlineButton: {
      borderColor: sharedColors.white,
    },
    outlineButtonText: {
      color: sharedColors.white,
    },
    linkButton: {
      alignItems: 'center',
      paddingVertical: 8,
      marginTop: 4,
    },
    linkText: {
      color: sharedColors.white,
      opacity: 0.8,
      fontSize: 16,
      fontWeight: '500',
    },
  });
}
