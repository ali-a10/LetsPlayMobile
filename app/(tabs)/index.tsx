import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../lib/constants/colors';
import { useEvents } from '../../lib/hooks/useEvents';
import { useFilterStore } from '../../lib/stores/filterStore';
import { EventCard } from '../../components/events/EventCard';
import { SportChips } from '../../components/events/SportChips';
import { Event } from '../../lib/types/database';

/** Main event feed screen with search, sport filters, and scrollable event list. */
export default function HomeScreen() {
  const router = useRouter();
  const { data: events, isLoading, error, refetch } = useEvents();

  const sport = useFilterStore((s) => s.sport);
  const searchText = useFilterStore((s) => s.searchText);
  const setSearchText = useFilterStore((s) => s.setSearchText);

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

  const renderItem = ({ item }: { item: Event }) => (
    <EventCard
      event={item}
      onPress={() => router.push(`/event/${item.id}`)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Find & Join</Text>
            <Text style={styles.headerSubtitle}>Local Sports Games Near You</Text>
          </View>
          <Ionicons name="filter-outline" size={24} color={colors.white} />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.gray[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search games, sports, locations..."
            placeholderTextColor={colors.gray[400]}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <SportChips />

        <View style={styles.separator} />

        <Text style={styles.sectionTitle}>Featured Events</Text>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.secondary}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.teal,
  },
  header: {
    backgroundColor: colors.teal,
    paddingTop: 25,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.8,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[800],
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.white,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  separator: {
    height: 3,
    backgroundColor: colors.secondary,
    marginHorizontal: 16,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
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
    color: colors.textLight,
  },
  retryText: {
    fontSize: 14,
    color: colors.secondary,
    marginTop: 8,
    fontWeight: '500',
  },
});
