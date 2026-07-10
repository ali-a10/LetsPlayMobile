import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';
import { SPORT_OPTIONS } from '../../lib/constants/sports';

interface SportsPickerProps {
  label: string;
  value: string[];
  onChange: (sports: string[]) => void;
}

const MAX_VISIBLE_CHIPS = 3;

/** Compact multi-select field for favourite sports; taps open a bottom-sheet picker with search. */
export function SportsPicker({ label, value, onChange }: SportsPickerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  /** Look up a sport's display label from its value; falls back to the raw value if unknown. */
  const labelFor = (val: string) =>
    SPORT_OPTIONS.find((s) => s.value === val)?.label ?? val;

  const visible = value.slice(0, MAX_VISIBLE_CHIPS);
  const extraCount = Math.max(0, value.length - MAX_VISIBLE_CHIPS);

  /** Toggles a sport in the current selection. Sheet stays open. */
  const toggle = (sportValue: string) => {
    onChange(
      value.includes(sportValue)
        ? value.filter((s) => s !== sportValue)
        : [...value, sportValue]
    );
  };

  /** Closes the picker sheet and resets the search query. */
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? SPORT_OPTIONS.filter((s) => s.label.toLowerCase().includes(q))
    : SPORT_OPTIONS;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value.length} selected`}
      >
        <View style={styles.chipsRow}>
          {value.length === 0 ? (
            <Text style={styles.placeholder}>Add sports</Text>
          ) : (
            <>
              {visible.map((sportValue) => (
                <View key={sportValue} style={styles.chip}>
                  <Text style={styles.chipText}>{labelFor(sportValue)}</Text>
                </View>
              ))}
              {extraCount > 0 && (
                <View style={styles.morePill}>
                  <Text style={styles.moreText}>+{extraCount}</Text>
                </View>
              )}
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Sheet: stop propagation so taps inside don't dismiss. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={close} hitSlop={8} accessibilityRole="button">
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={16} color={colors.inputPlaceholder} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search sports"
                placeholderTextColor={colors.inputPlaceholder}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.chevron} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filtered.length === 0 ? (
                <Text style={styles.emptyText}>No sports found</Text>
              ) : (
                filtered.map((sport) => {
                  const selected = value.includes(sport.value);
                  return (
                    <TouchableOpacity
                      key={sport.value}
                      style={styles.row}
                      onPress={() => toggle(sport.value)}
                      activeOpacity={0.6}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={styles.rowLabel}>{sport.label}</Text>
                      {selected && (
                        <Ionicons name="checkmark" size={22} color={colors.tabBarActive} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 6,
    },
    field: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    chipsRow: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    placeholder: {
      fontSize: 16,
      color: colors.inputPlaceholder,
    },
    chip: {
      backgroundColor: colors.chipActiveBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.chipActiveText,
    },
    morePill: {
      backgroundColor: colors.chipInactiveBg,
      borderWidth: 1,
      borderColor: colors.chipInactiveBorder,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    moreText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.chipInactiveText,
    },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      height: '80%',
      paddingBottom: 24,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.menuDivider,
      marginTop: 10,
      marginBottom: 8,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.menuDivider,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    doneText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.tabBarActive,
    },
    searchWrapper: {
      marginHorizontal: 20,
      marginTop: 12,
      marginBottom: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 40,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.inputText,
      padding: 0,
    },
    list: {
      flex: 1,
      marginTop: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.menuDivider,
    },
    rowLabel: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingVertical: 32,
      fontSize: 14,
    },
  });
}
