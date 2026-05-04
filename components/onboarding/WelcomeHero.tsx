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
      <Text style={[styles.eyebrow, { color: colors.accent }]}>
        WELCOME TO LETSPLAY
      </Text>
      <Text style={styles.headline}>{'How it\nworks'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
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
