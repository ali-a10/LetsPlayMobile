import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Pressable,
  Animated,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { useEvents, EventWithHost } from '../../lib/hooks/useEvents';
import { useFilterStore } from '../../lib/stores/filterStore';
import { useLocationStore } from '../../lib/stores/useLocationStore';
import { haversineKm } from '../../lib/utils/distance';
import { toDayKey } from '../../lib/utils/dateRange';
import { EventCard } from '../../components/events/EventCard';
import { SportChips } from '../../components/events/SportChips';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';

/** Height of the search bar row (bar itself + top margin). */
const SEARCH_BAR_HEIGHT = 48;
const SEARCH_BAR_MARGIN_TOP = 8;
const FILTER_PANEL_EXTRA = 130;
const ANIMATED_TOTAL_HEIGHT =
  SEARCH_BAR_HEIGHT + SEARCH_BAR_MARGIN_TOP + FILTER_PANEL_EXTRA;

/** Formats a 'YYYY-MM-DD' day key as a short 'MMM D' label. */
function formatDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Main event feed screen with search, sport filters, and scrollable event list. */
export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: events, isLoading, isFetching, error, refetch } = useEvents();

  const searchText = useFilterStore((s) => s.searchText);
  const setSearchText = useFilterStore((s) => s.setSearchText);
  const date = useFilterStore((s) => s.date);
  const setDate = useFilterStore((s) => s.setDate);
  const freeOnly = useFilterStore((s) => s.freeOnly);
  const setFreeOnly = useFilterStore((s) => s.setFreeOnly);
  const hasSpots = useFilterStore((s) => s.hasSpots);
  const setHasSpots = useFilterStore((s) => s.setHasSpots);
  const sortBy = useFilterStore((s) => s.sortBy);
  const setSortBy = useFilterStore((s) => s.setSortBy);

  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);

  const [searchVisible, setSearchVisible] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  // Date picker state — iOS buffers the spinner value until "Done" is pressed.
  const [showDatePicker, setShowDatePicker] = useState(false);
  const pendingDateRef = useRef<Date | null>(null);

  const todayKey = toDayKey(new Date());
  const tomorrowKey = useMemo(() => {
    const t = new Date();
    return toDayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1));
  }, []);
  const isToday = date === todayKey;
  const isTomorrow = date === tomorrowKey;
  const isCustomDate = date != null && !isToday && !isTomorrow;

  // Nearest sort is wired in commit 2 (location permission flow); inert for now.
  const nearestDisabled = true;
  const handleNearestPress = () => {};

  /** Slides the search/filter panel into or out of view and updates visibility state. */
  const toggleSearch = () => {
    const opening = !searchVisible;
    setSearchVisible(opening);
    Animated.timing(animatedHeight, {
      toValue: opening ? ANIMATED_TOTAL_HEIGHT : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  /** Opens the calendar picker to choose a single custom day. */
  const openDatePicker = () => {
    pendingDateRef.current = null;
    setShowDatePicker(true);
  };

  /** Handles a day selection from the native calendar picker. */
  const handleDayChange = (_event: unknown, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selected) setDate(toDayKey(selected));
      return;
    }
    // iOS: buffer the value until the user confirms with "Done".
    if (selected) pendingDateRef.current = selected;
  };

  /** Confirms the buffered iOS date selection and closes the picker. */
  const confirmDatePicker = () => {
    if (pendingDateRef.current) setDate(toDayKey(pendingDateRef.current));
    setShowDatePicker(false);
  };

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    let result = events;

    // Server already applied sport/free/date/search; "Has spots" is computed here.
    if (hasSpots) {
      result = result.filter(
        (e) => e.max_participants - e.current_participants >= 1
      );
    }

    if (sortBy === 'nearest' && latitude != null && longitude != null) {
      result = [...result].sort((a, b) => {
        const da =
          a.latitude != null && a.longitude != null
            ? haversineKm(latitude, longitude, a.latitude, a.longitude)
            : Infinity;
        const db =
          b.latitude != null && b.longitude != null
            ? haversineKm(latitude, longitude, b.latitude, b.longitude)
            : Infinity;
        return da - db;
      });
    }

    return result;
  }, [events, hasSpots, sortBy, latitude, longitude]);

  const activePills = useMemo(() => {
    const pills: { key: string; label: string; onClear: () => void }[] = [];
    if (date) {
      const label = isToday
        ? 'Today'
        : isTomorrow
          ? 'Tomorrow'
          : formatDayLabel(date);
      pills.push({ key: 'date', label, onClear: () => setDate(null) });
    }
    if (freeOnly) {
      pills.push({ key: 'free', label: 'Free', onClear: () => setFreeOnly(false) });
    }
    if (hasSpots) {
      pills.push({
        key: 'spots',
        label: 'Has spots',
        onClear: () => setHasSpots(false),
      });
    }
    const q = searchText.trim();
    if (q) {
      pills.push({
        key: 'search',
        label: `"${q}"`,
        onClear: () => setSearchText(''),
      });
    }
    return pills;
  }, [
    date,
    isToday,
    isTomorrow,
    freeOnly,
    hasSpots,
    searchText,
    setDate,
    setFreeOnly,
    setHasSpots,
    setSearchText,
  ]);

  const renderItem = ({ item }: { item: EventWithHost }) => (
    <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Find & Join</Text>
            <Text style={styles.headerSubtitle}>Local Sports Games Near You</Text>
          </View>
          <Pressable
            onPress={toggleSearch}
            hitSlop={8}
            accessibilityLabel="Toggle search bar"
            accessibilityRole="button"
          >
            <Ionicons name="filter-outline" size={24} color={sharedColors.white} />
          </Pressable>
        </View>

        {/* Animated wrapper collapses to height 0 when search is hidden */}
        <Animated.View style={[styles.searchWrapper, { height: animatedHeight }]}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color={colors.searchPlaceholder} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search games, sports, locations..."
              placeholderTextColor={colors.searchPlaceholder}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {/* Date chips */}
          <View style={styles.dateChipsRow}>
            <Pressable
              style={[styles.dateChip, isToday && styles.dateChipActive]}
              onPress={() => setDate(isToday ? null : todayKey)}
            >
              <Text style={[styles.dateChipText, isToday && styles.dateChipTextActive]}>
                Today
              </Text>
            </Pressable>
            <Pressable
              style={[styles.dateChip, isTomorrow && styles.dateChipActive]}
              onPress={() => setDate(isTomorrow ? null : tomorrowKey)}
            >
              <Text style={[styles.dateChipText, isTomorrow && styles.dateChipTextActive]}>
                Tomorrow
              </Text>
            </Pressable>
            {isCustomDate ? (
              <Pressable
                style={[styles.dateChip, styles.dateChipActive]}
                onPress={() => setDate(null)}
              >
                <Text style={[styles.dateChipText, styles.dateChipTextActive]}>
                  {formatDayLabel(date!)}
                </Text>
                <Ionicons name="close" size={14} color={colors.header} style={{ marginLeft: 4 }} />
              </Pressable>
            ) : (
              <Pressable style={styles.dateChip} onPress={openDatePicker}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={sharedColors.white}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.dateChipText}>Pick date</Text>
              </Pressable>
            )}
          </View>

          {/* Toggles row */}
          <View style={styles.togglesRow}>
            <Pressable
              style={styles.toggleItem}
              onPress={() => setFreeOnly(!freeOnly)}
              accessibilityRole="switch"
              accessibilityState={{ checked: freeOnly }}
            >
              <View style={[styles.toggleTrack, freeOnly && styles.toggleTrackOn]}>
                <View style={[styles.toggleThumb, freeOnly && styles.toggleThumbOn]} />
              </View>
              <Text style={styles.toggleLabel}>Free only</Text>
            </Pressable>
            <Pressable
              style={styles.toggleItem}
              onPress={() => setHasSpots(!hasSpots)}
              accessibilityRole="switch"
              accessibilityState={{ checked: hasSpots }}
            >
              <View style={[styles.toggleTrack, hasSpots && styles.toggleTrackOn]}>
                <View style={[styles.toggleThumb, hasSpots && styles.toggleThumbOn]} />
              </View>
              <Text style={styles.toggleLabel}>Has spots</Text>
            </Pressable>
          </View>

          {/* Sort segmented control */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort</Text>
            <View style={styles.segmented}>
              <Pressable
                style={[styles.segment, sortBy === 'soonest' && styles.segmentActive]}
                onPress={() => setSortBy('soonest')}
              >
                <Text
                  style={[styles.segmentText, sortBy === 'soonest' && styles.segmentTextActive]}
                >
                  Soonest
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.segment,
                  sortBy === 'nearest' && styles.segmentActive,
                  nearestDisabled && styles.segmentDisabled,
                ]}
                onPress={handleNearestPress}
                disabled={nearestDisabled}
              >
                <Text
                  style={[styles.segmentText, sortBy === 'nearest' && styles.segmentTextActive]}
                >
                  Nearest
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <SportChips />

        {/* Active filter pills */}
        {activePills.length > 0 && (
          <View style={styles.activeFiltersRow}>
            <Text style={styles.activeFiltersLabel}>Active:</Text>
            {activePills.map((pill) => (
              <Pressable key={pill.key} style={styles.activePill} onPress={pill.onClear}>
                <Text style={styles.activePillText}>{pill.label}</Text>
                <Ionicons name="close" size={14} color={colors.header} style={{ marginLeft: 4 }} />
              </Pressable>
            ))}
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Failed to load events</Text>
            <Text style={styles.retryText} onPress={() => refetch()}>
              Tap to retry
            </Text>
          </View>
        ) : (
          <View style={styles.listWrapper}>
            {/* Small spinner while a filter refetch is in flight (list stays visible) */}
            {isFetching && (
              <View style={styles.fetchingOverlay} pointerEvents="none">
                <View style={styles.fetchingBadge}>
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              </View>
            )}
            <FlatList
              data={filteredEvents}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              onRefresh={refetch}
              refreshing={isLoading}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No events found</Text>
                </View>
              }
            />
          </View>
        )}
      </View>

      {/* Floating Action Button — navigates to the create-event screen */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => router.push('/create-event')}
        accessibilityLabel="Create event"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={sharedColors.white} />
      </TouchableOpacity>

      {/* Date picker — Android shows a native dialog; iOS uses a bottom-sheet modal */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={date ? new Date(`${date}T00:00:00`) : new Date()}
          mode="date"
          display="default"
          onChange={handleDayChange}
          minimumDate={new Date()}
        />
      )}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalActions}>
                <Text style={styles.modalCancel} onPress={() => setShowDatePicker(false)}>
                  Cancel
                </Text>
                <Text style={styles.modalDone} onPress={confirmDatePicker}>
                  Done
                </Text>
              </View>
              <DateTimePicker
                value={date ? new Date(`${date}T00:00:00`) : new Date()}
                mode="date"
                display="spinner"
                onChange={handleDayChange}
                minimumDate={new Date()}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.header,
    },
    header: {
      backgroundColor: colors.header,
      paddingTop: 25,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: sharedColors.white,
    },
    headerSubtitle: {
      fontSize: 14,
      color: sharedColors.white,
      opacity: 0.8,
      marginTop: 2,
      marginBottom: 5,
    },
    searchWrapper: {
      overflow: 'hidden',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.searchBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      height: SEARCH_BAR_HEIGHT,
      marginTop: SEARCH_BAR_MARGIN_TOP,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.searchText,
    },
    dateChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    dateChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: colors.searchBg,
    },
    dateChipText: {
      fontSize: 13,
      color: sharedColors.white,
      fontWeight: '500',
    },
    dateChipActive: {
      backgroundColor: colors.accent,
    },
    dateChipTextActive: {
      color: colors.header,
      fontWeight: '600',
    },
    togglesRow: {
      flexDirection: 'row',
      gap: 24,
      marginTop: 14,
    },
    toggleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toggleTrack: {
      width: 36,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.searchBg,
      padding: 2,
      justifyContent: 'center',
    },
    toggleTrackOn: {
      backgroundColor: colors.accent,
    },
    toggleThumb: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: sharedColors.white,
    },
    toggleThumbOn: {
      alignSelf: 'flex-end',
    },
    toggleLabel: {
      fontSize: 14,
      color: sharedColors.white,
      fontWeight: '500',
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 14,
    },
    sortLabel: {
      fontSize: 13,
      color: sharedColors.white,
      opacity: 0.8,
      fontWeight: '500',
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.searchBg,
      borderRadius: 8,
      padding: 3,
      flex: 1,
    },
    segment: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 6,
    },
    segmentActive: {
      backgroundColor: colors.accent,
    },
    segmentDisabled: {
      opacity: 0.4,
    },
    segmentText: {
      fontSize: 13,
      color: sharedColors.white,
      fontWeight: '500',
    },
    segmentTextActive: {
      color: colors.header,
      fontWeight: '600',
    },
    activeFiltersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
    },
    activeFiltersLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: colors.accent,
    },
    activePillText: {
      fontSize: 12,
      color: colors.header,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    listWrapper: {
      flex: 1,
    },
    fetchingOverlay: {
      position: 'absolute',
      top: 8,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 10,
    },
    fetchingBadge: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 6,
      shadowColor: sharedColors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 4,
    },
    loader: {
      marginTop: 40,
    },
    emptyState: {
      alignItems: 'center',
      marginTop: 40,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textMuted,
    },
    retryText: {
      fontSize: 14,
      color: colors.accent,
      marginTop: 8,
      fontWeight: '500',
    },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: sharedColors.fab,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: sharedColors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 24,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    modalCancel: {
      fontSize: 16,
      color: colors.textMuted,
      fontWeight: '500',
    },
    modalDone: {
      fontSize: 16,
      color: colors.accent,
      fontWeight: '700',
    },
  });
}
