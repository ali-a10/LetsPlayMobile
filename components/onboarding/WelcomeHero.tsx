import { View, Text, StyleSheet } from 'react-native';
import { SportsFieldBackground } from '../ui/SportsFieldBackground';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { sharedColors } from '../../lib/constants/colors';

/** Teal hero section for the first onboarding slide. */
export function WelcomeHero() {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <SportsFieldBackground />
      <View style={styles.content}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowLine, { backgroundColor: colors.accent }]} />
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            WELCOME TO LETSPLAY
          </Text>
          <View style={[styles.eyebrowLine, { backgroundColor: colors.accent }]} />
        </View>
        <Text style={styles.headline}>How it works</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: '25%',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  eyebrowLine: {
    width: 20,
    height: 1.5,
    borderRadius: 1,
    opacity: 0.6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3.5,
  },
  headline: {
    fontSize: 38,
    fontWeight: '800',
    color: sharedColors.white,
    textAlign: 'center',
    lineHeight: 38 * 1.05,
    letterSpacing: -1.2,
  },
});
