import { useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import PagerView from 'react-native-pager-view';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors } from '../../lib/constants/colors';
import { slides } from '../../components/onboarding/slideData';
import { WelcomeHero } from '../../components/onboarding/WelcomeHero';
import { SlideImagePlaceholder } from '../../components/onboarding/SlideImagePlaceholder';
import { SlideCaption } from '../../components/onboarding/SlideCaption';
import { PaginationDots } from '../../components/onboarding/PaginationDots';
import { OnboardingChrome } from '../../components/onboarding/OnboardingChrome';

/** Five-slide onboarding carousel explaining how the app works. */
export default function HowItWorksScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isWelcomeSlide = activeIndex === 0;
  const isLastSlide = activeIndex === slides.length - 1;

  const goToSlide = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
  }, []);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      router.back();
    } else {
      goToSlide(activeIndex + 1);
    }
  }, [activeIndex, isLastSlide, goToSlide, router]);

  const handleSkip = useCallback(() => {
    goToSlide(slides.length - 1);
  }, [goToSlide]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  /* Android hardware back: go to previous slide or exit. */
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (activeIndex > 0) {
          goToSlide(activeIndex - 1);
          return true;
        }
        return false;
      });

      return () => sub.remove();
    }, [activeIndex, goToSlide])
  );

  const currentSlide = slides[activeIndex];

  return (
    <View style={[styles.screen, { backgroundColor: isWelcomeSlide ? colors.header : colors.chipInactiveBg }]}>
      <StatusBar style={isWelcomeSlide ? 'light' : 'dark'} />

      <OnboardingChrome
        isWelcomeSlide={isWelcomeSlide}
        isLastSlide={isLastSlide}
        onBack={handleBack}
        onSkip={handleSkip}
      />

      {/* Full-screen pager — each page has top visual + bottom caption */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
      >
        {slides.map((slide, index) => (
          <View
            key={index}
            style={styles.page}
            accessibilityLabel={
              slide.kind === 'welcome'
                ? 'Welcome'
                : `Step ${slide.step} of 4: ${slide.headline}`
            }
          >
            {/* Top visual section */}
            <View
              style={[
                styles.slideTop,
                {
                  backgroundColor:
                    slide.kind === 'welcome' ? colors.header : colors.chipInactiveBg,
                },
              ]}
            >
              {slide.kind === 'welcome' ? (
                <WelcomeHero />
              ) : (
                <SlideImagePlaceholder image={slide.image} />
              )}
            </View>

            {/* Bottom caption — slides with the page */}
            <View style={[styles.captionSection, { backgroundColor: colors.background }]}>
              <SlideCaption
                eyebrow={slide.eyebrow}
                headline={slide.headline}
                body={slide.body}
              />
            </View>
          </View>
        ))}
      </PagerView>

      {/* Fixed overlay: dots + CTA — stays in place across slides */}
      <View style={styles.controls} pointerEvents="box-none">
        <PaginationDots
          total={slides.length}
          activeIndex={activeIndex}
          onDotPress={goToSlide}
        />

        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.9}
          style={[
            styles.ctaButton,
            {
              backgroundColor: isLastSlide
                ? colors.buttonSecondaryBg
                : colors.buttonPrimaryBg,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isLastSlide ? 'Get started' : 'Next slide'}
        >
          <Text style={[styles.ctaText, { color: isLastSlide ? colors.buttonSecondaryText : colors.buttonPrimaryText }]}>
            {isLastSlide ? 'Get started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    pager: {
      flex: 1,
    },
    page: {
      flex: 1,
    },
    slideTop: {
      flex: 1,
    },
    captionSection: {
      height: 280,
      paddingHorizontal: 22,
    },
    controls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 34,
      paddingHorizontal: 22,
    },
    ctaButton: {
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ctaText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
