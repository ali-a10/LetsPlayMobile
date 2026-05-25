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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { useEvents, EventWithHost } from '../../lib/hooks/useEvents';
import { useFilterStore } from '../../lib/stores/filterStore';
import { EventCard } from '../../components/events/EventCard';
import { SportChips } from '../../components/events/SportChips';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';

/** Height of the search bar row (bar itself + top margin). */
const SEARCH_BAR_HEIGHT = 48;
const SEARCH_BAR_MARGIN_TOP = 8;
const FILTER_PANEL_EXTRA = 130;
const ANIMATED_TOTAL_HEIGHT =
  SEARCH_BAR_HEIGHT + SEARCH_BAR_MARGIN_TOP + FILTER_PANEL_EXTRA;

/** Main event feed screen with search, sport filters, and scrollable event list. */
export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: events, isLoading, error, refetch } = useEvents();

  const sport = useFilterStore((s) => s.sport);
  const searchText = useFilterStore((s) => s.searchText);
  const setSearchText = useFilterStore((s) => s.setSearchText);

  const [searchVisible, setSearchVisible] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  /** Slides the search bar into or out of view and updates visibility state. */
  const toggleSearch = () => {
    const opening = !searchVisible;
    setSearchVisible(opening);
    Animated.timing(animatedHeight, {
      toValue: opening ? ANIMATED_TOTAL_HEIGHT : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    let result = events;

    if (sport) {
      result = result.filter((e) => e.sport === sport);
    }

    const query = searchText.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.sport.toLowerCase().includes(query) ||
          e.location.toLowerCase().includes(query)
      );
    }

    return result;
  }, [events, sport, searchText]);

  const renderItem = ({ item }: { item: EventWithHost }) => (
    <EventCard
      event={item}
      onPress={() => router.push(`/event/${item.id}`)}
    />
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

          {/* Date chips — visual only */}
          <View style={styles.dateChipsRow}>
            <Pressable style={styles.dateChip}>
              <Text style={styles.dateChipText}>Today</Text>
            </Pressable>
            <Pressable style={styles.dateChip}>
              <Text style={styles.dateChipText}>Tomorrow</Text>
            </Pressable>
            <Pressable style={[styles.dateChip, styles.dateChipActive]}>
              <Text style={[styles.dateChipText, styles.dateChipTextActive]}>May 27</Text>
              <Ionicons name="close" size={14} color={colors.header} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

          {/* Toggles row — visual only */}
          <View style={styles.togglesRow}>
            <View style={styles.toggleItem}>
              <View style={[styles.toggleTrack, styles.toggleTrackOn]}>
                <View style={[styles.toggleThumb, styles.toggleThumbOn]} />
              </View>
              <Text style={styles.toggleLabel}>Free only</Text>
            </View>
            <View style={styles.toggleItem}>
              <View style={styles.toggleTrack}>
                <View style={styles.toggleThumb} />
              </View>
              <Text style={styles.toggleLabel}>Has spots</Text>
            </View>
          </View>

          {/* Sort segmented control — visual only */}
          <View style={styles.sortRow}>
            <Text style={styles.sortLabel}>Sort</Text>
            <View style={styles.segmented}>
              <Pressable style={[styles.segment, styles.segmentActive]}>
                <Text style={[styles.segmentText, styles.segmentTextActive]}>Soonest</Text>
              </Pressable>
              <Pressable style={styles.segment}>
                <Text style={styles.segmentText}>Nearest</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <SportChips />

        {/* Active filter pills — visual only */}
        <View style={styles.activeFiltersRow}>
          <Text style={styles.activeFiltersLabel}>Active:</Text>
          <Pressable style={styles.activePill}>
            <Text style={styles.activePillText}>Free</Text>
            <Ionicons name="close" size={14} color={colors.header} style={{ marginLeft: 4 }} />
          </Pressable>
          <Pressable style={styles.activePill}>
            <Text style={styles.activePillText}>May 27</Text>
            <Ionicons name="close" size={14} color={colors.header} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.accent}
            style={styles.loader}
          />
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Failed to load events</Text>
            <Text style={styles.retryText} onPress={() => refetch()}>
              Tap to retry
            </Text>
          </View>
        ) : (
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
  });
}
