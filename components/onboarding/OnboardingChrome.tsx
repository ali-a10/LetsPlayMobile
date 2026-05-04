import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { sharedColors } from '../../lib/constants/colors';

interface OnboardingChromeProps {
  isWelcomeSlide: boolean;
  isLastSlide: boolean;
  onBack: () => void;
  onSkip: () => void;
}

/** Top-bar overlay with back chevron and skip button for the onboarding carousel. */
export function OnboardingChrome({
  isWelcomeSlide,
  isLastSlide,
  onBack,
  onSkip,
}: OnboardingChromeProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const iconColor = isWelcomeSlide ? sharedColors.white : colors.text;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        onPress={onBack}
        style={[
          styles.backButton,
          {
            backgroundColor: isWelcomeSlide
              ? 'rgba(255,255,255,0.18)'
              : 'rgba(255,255,255,0.85)',
          },
        ]}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={20} color={iconColor} />
      </TouchableOpacity>

      {!isLastSlide && (
        <TouchableOpacity
          onPress={onSkip}
          style={
            isWelcomeSlide
              ? [styles.skipPill, styles.skipPillOnHero]
              : styles.skipPlain
          }
          accessibilityLabel="Skip to last slide"
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.skipText,
              { color: isWelcomeSlide ? sharedColors.white : colors.textMuted },
            ]}
          >
            Skip
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 99,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
  },
  skipPillOnHero: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  skipPlain: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
