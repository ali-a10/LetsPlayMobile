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
const SEARCH_BAR_MARGIN_TOP = 16;
const ANIMATED_TOTAL_HEIGHT = SEARCH_BAR_HEIGHT + SEARCH_BAR_MARGIN_TOP;

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
        </Animated.View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <SportChips />

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
      justifyContent: 'flex-end',
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
