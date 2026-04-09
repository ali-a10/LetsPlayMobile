import { ScrollView, Text, StyleSheet, Pressable } from 'react-native';
import { useMemo } from 'react';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors } from '../../lib/constants/colors';
import { SPORT_OPTIONS } from '../../lib/constants/sports';
import { useFilterStore } from '../../lib/stores/filterStore';

/** Horizontal scrollable row of sport filter chips. */
export function SportChips() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sport = useFilterStore((s) => s.sport);
  const setSport = useFilterStore((s) => s.setSport);

  const chips = [{ label: 'All Sports', value: null }, ...SPORT_OPTIONS];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scrollView}
    >
      {chips.map((chip) => {
        const isActive = sport === chip.value;
        return (
          <Pressable
            key={chip.label}
            style={[styles.chip, isActive && styles.activeChip]}
            onPress={() => setSport(chip.value)}
          >
            <Text style={[styles.chipText, isActive && styles.activeChipText]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrollView: {
      flexGrow: 0,
      flexShrink: 0,
      marginVertical: 8,
    },
    container: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      alignItems: 'center',
    },
    chip: {
      paddingHorizontal: 16,
      marginVertical: 0,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.chipInactiveBg,
      borderWidth: 1,
      borderColor: colors.chipInactiveBorder,
    },
    activeChip: {
      backgroundColor: colors.chipActiveBg,
      borderColor: colors.chipActiveBg,
    },
    chipText: {
      fontSize: 14,
      color: colors.chipInactiveText,
      fontWeight: '500',
    },
    activeChipText: {
      color: colors.chipActiveText,
    },
  });
}
