import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../lib/hooks/useThemeColors';

interface SlideCaptionProps {
  eyebrow: string;
  headline: string;
  body: string;
}

/** Bottom caption strip displaying the eyebrow, headline, and body for a slide. */
export function SlideCaption({ eyebrow, headline, body }: SlideCaptionProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.eyebrow, { color: colors.header }]}>{eyebrow}</Text>
      <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 24 * 1.15,
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 14 * 1.5,
  },
});
