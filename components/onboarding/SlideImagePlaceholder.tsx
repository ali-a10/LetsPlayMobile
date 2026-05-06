import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { useThemeColors } from '../../lib/hooks/useThemeColors';

interface SlideImagePlaceholderProps {
  image?: ImageSourcePropType;
}

/** Stage area for onboarding slides 2-5, showing a screenshot or empty placeholder. */
export function SlideImagePlaceholder({ image }: SlideImagePlaceholderProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.stage, { backgroundColor: colors.chipInactiveBg }]}>
      {image ? (
        <Image source={image} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={styles.imageContainer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 85,
    paddingBottom: 0,
  },
  image: {
    width: '77%',
    aspectRatio: 9 / 16,
    maxHeight: '92%',
  },
  imageContainer: {
    width: '80%',
    aspectRatio: 9 / 16,
    maxHeight: '90%',
  },
});
