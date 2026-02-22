import { ScrollView, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../../lib/constants/colors';
import { SPORT_OPTIONS } from '../../lib/constants/sports';
import { useFilterStore } from '../../lib/stores/filterStore';

/** Horizontal scrollable row of sport filter chips. */
export function SportChips() {
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.gray[100],
  },
  activeChip: {
    backgroundColor: colors.darkCyan,
  },
  chipText: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },
  activeChipText: {
    color: colors.white,
  },
});
