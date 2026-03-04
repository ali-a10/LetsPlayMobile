import { useState } from 'react';
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
    isRefetching: joinedRefetching,
    error: joinedError,
    refetch: refetchJoined,
  } = useMyJoinedEvents(userId);

  const renderItem = ({ item }: { item: EventWithHost }) => (
    <EventCard
      event={item}
      onPress={() => router.push(`/event/${item.id}`)}
    />
  );

  const renderJoinedContent = () => {
    if (joinedLoading) {
      return (
        <ActivityIndicator
          size="large"
          color={colors.secondary}
          style={styles.loader}
        />
      );
    }

    if (joinedError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Failed to load events</Text>
          <Text style={styles.retryText} onPress={() => refetchJoined()}>
            Tap to retry
          </Text>
        </View>
      );
    }

    if (!joinedEvents || joinedEvents.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>You haven't joined any upcoming events.</Text>
          <Pressable onPress={() => router.push('/(tabs)')}>
            <Text style={styles.ctaText}>Browse Events</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        data={joinedEvents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refetchJoined}
        refreshing={joinedRefetching}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Events</Text>
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

        {activeTab === 0 ? (
          renderJoinedContent()
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>You're not hosting any upcoming events.</Text>
            <Pressable onPress={() => router.push('/(tabs)/create')}>
              <Text style={styles.ctaText}>Create an Event</Text>
            </Pressable>
          </View>
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
    borderColor: colors.teal,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  segmentActive: {
    backgroundColor: colors.teal,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.teal,
  },
  segmentTextActive: {
    color: colors.white,
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
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 14,
    color: colors.secondary,
    marginTop: 8,
    fontWeight: '600',
  },
  retryText: {
    fontSize: 14,
    color: colors.secondary,
    marginTop: 8,
    fontWeight: '500',
  },
});
