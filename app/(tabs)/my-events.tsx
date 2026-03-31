import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../lib/constants/colors';
import { useAuth } from '../../lib/hooks/useAuth';
import { useMyJoinedEvents } from '../../lib/hooks/useMyJoinedEvents';
import { useMyHostedEvents } from '../../lib/hooks/useMyHostedEvents';
import { EventCard } from '../../components/events/EventCard';
import { EventWithHost } from '../../lib/hooks/useEvents';

/** My Events screen showing events the user has joined or is hosting, separated by a segmented control. */
export default function MyEventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  const {
    data: joinedEvents,
    isLoading: joinedLoading,
    error: joinedError,
    refetch: refetchJoined,
  } = useMyJoinedEvents(userId);

  const {
    data: hostedEvents,
    isLoading: hostedLoading,
    error: hostedError,
    refetch: refetchHosted,
  } = useMyHostedEvents(userId);

  const renderItem = ({ item }: { item: EventWithHost }) => (
    <EventCard
      event={item}
      onPress={() => router.push(`/event/${item.id}`)}
    />
  );

  // Tracks whether a pull-to-refresh gesture is active (avoids showing the spinner for background refetches).
  const [manualRefreshing, setManualRefreshing] = useState(false);

  /** Wraps a refetch call so the refresh indicator only shows for user-initiated pulls. */
  const createPullRefresh = useCallback(
    (refetch: () => Promise<unknown>) => async () => {
      setManualRefreshing(true);
      try { await refetch(); } finally { setManualRefreshing(false); }
    },
    []
  );

  /** Renders loading, error, empty, or populated state for a tab. */
  const renderTabContent = (
    isLoading: boolean,
    error: Error | null,
    refetch: () => Promise<unknown>,
    events: EventWithHost[] | undefined,
    emptyText: string,
    emptyCta: React.ReactNode
  ) => {
    if (isLoading) {
      return (
        <ActivityIndicator
          size="large"
          color={colors.secondary}
          style={styles.loader}
        />
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Failed to load events</Text>
          <Pressable onPress={refetch} accessibilityRole="button">
            <Text style={styles.retryText}>Tap to retry</Text>
          </Pressable>
        </View>
      );
    }

    if (!events || events.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyText}</Text>
          {emptyCta}
        </View>
      );
    }

    return (
      <FlatList
        data={events}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={createPullRefresh(refetch)}
        refreshing={manualRefreshing}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Events</Text>
        <Text style={styles.headerSubtitle}>Your upcoming events</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segment, activeTab === 0 && styles.segmentActive]}
            onPress={() => setActiveTab(0)}
          >
            <Text style={[styles.segmentText, activeTab === 0 && styles.segmentTextActive]}>
              Joined
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, activeTab === 1 && styles.segmentActive]}
            onPress={() => setActiveTab(1)}
          >
            <Text style={[styles.segmentText, activeTab === 1 && styles.segmentTextActive]}>
              Hosting
            </Text>
          </Pressable>
        </View>

        {activeTab === 0
          ? renderTabContent(
              joinedLoading,
              joinedError,
              refetchJoined,
              joinedEvents,
              "You haven't joined any upcoming events.",
              <Pressable style={styles.ctaButton} onPress={() => router.push('/(tabs)')}>
                <Text style={styles.ctaText}>Browse Events</Text>
              </Pressable>
            )
          : renderTabContent(
              hostedLoading,
              hostedError,
              refetchHosted,
              hostedEvents,
              "You're not hosting any upcoming events.",
              <Pressable style={styles.ctaButton} onPress={() => router.push('/create-event')}>
                <Text style={styles.ctaText}>Create an Event</Text>
              </Pressable>
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
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.8,
    marginTop: 4,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.darkCyan,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  segmentActive: {
    backgroundColor: colors.darkCyan,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.teal,
  },
  segmentTextActive: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 17,
    color: colors.textLight,
    textAlign: 'center',
  },
  ctaButton: {
    marginTop: 16,
    backgroundColor: colors.darkCyan,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
  retryText: {
    fontSize: 14,
    color: colors.secondary,
    marginTop: 8,
    fontWeight: '500',
  },
});
