import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '../../lib/hooks/useThemeColors';

/** Placeholder stage area for onboarding slides 2–5; images will be added later. */
export function SlideImagePlaceholder() {
  const colors = useThemeColors();

  return (
    <View style={[styles.stage, { backgroundColor: colors.chipInactiveBg }]}>
      <View style={styles.imageContainer} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  imageContainer: {
    width: '80%',
    aspectRatio: 9 / 16,
    maxHeight: '90%',
    borderRadius: 16,
  },
});
