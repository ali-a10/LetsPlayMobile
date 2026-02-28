import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/constants/colors';
import { useEventDetail } from '../../lib/hooks/useEventDetail';
import { useJoinEvent } from '../../lib/hooks/useJoinEvent';
import { ParticipantList } from '../../components/events/ParticipantList';
import { JoinConfirmModal } from '../../components/events/JoinConfirmModal';
import { getSportColor, getSportIcon, getSportLabel } from '../../lib/utils/sports';

/** Formats an ISO date string to "Wed, Dec 11". */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${month} ${d.getDate()}`;
}

/** Formats an ISO date string to "7:45 PM". */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading, error: fetchError } = useEventDetail(id);
  const joinMutation = useJoinEvent(id);

  const [modalVisible, setModalVisible] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoinPress = () => {
    setJoinError(null);
    setModalVisible(true);
  };

  const handleConfirm = () => {
    joinMutation.mutate(undefined, {
      onSuccess: () => setModalVisible(false),
      onError: (err) => setJoinError(err.message),
    });
  };

  const handleCancel = () => {
    if (!joinMutation.isPending) {
      setModalVisible(false);
      setJoinError(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (fetchError || !event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {fetchError ? 'Failed to load event.' : 'Event not found.'}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const sportColor = getSportColor(event.sport);
  const spotsLeft = event.max_participants - event.current_participants;
  const isFree = !event.is_paid || !event.price;
  const hostName = event.profiles
    ? `${event.profiles.first_name} ${event.profiles.last_name}`
    : 'Unknown';

  /** Renders the appropriate CTA button based on user/event state. */
  const renderCTA = () => {
    if (event.isUserHost) {
      return (
        <Pressable style={styles.hostBtn} disabled>
          <Text style={styles.hostBtnText}>You're the Host</Text>
        </Pressable>
      );
    }
    if (event.isUserJoined) {
      return (
        <Pressable
          style={styles.leaveBtn}
          onPress={() => Alert.alert('Coming Soon', 'Leave functionality is not yet available.')}
        >
          <Text style={styles.leaveBtnText}>Leave Event</Text>
        </Pressable>
      );
    }
    if (event.isFull) {
      return (
        <Pressable style={styles.fullBtn} disabled>
          <Text style={styles.fullBtnText}>Event Full</Text>
        </Pressable>
      );
    }
    return (
      <Pressable style={styles.joinBtn} onPress={handleJoinPress}>
        <Text style={styles.joinBtnText}>Join</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back button */}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        {/* Sport color accent strip */}
        <View style={[styles.accentStrip, { backgroundColor: sportColor }]} />

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Sport badge + price */}
        <View style={styles.badgeRow}>
          <View style={[styles.sportBadge, { borderColor: sportColor }]}>
            <Ionicons name={getSportIcon(event.sport)} size={14} color={sportColor} />
            <Text style={[styles.sportBadgeText, { color: sportColor }]}>
              {getSportLabel(event.sport)}
            </Text>
          </View>
          <Text style={styles.price}>{isFree ? 'Free' : `$${event.price?.toFixed(2)}`}</Text>
        </View>

        {/* Date + time */}
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textLight} />
          <Text style={styles.infoText}>
            {formatDate(event.date)} • {formatTime(event.date)}
          </Text>
        </View>

        {/* Location */}
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={colors.textLight} />
          <Text style={styles.infoText}>{event.location}</Text>
        </View>

        {/* Host */}
        <View style={styles.infoRow}>
          <View style={styles.avatarCircle} />
          <Text style={styles.infoText}>Hosted by {hostName}</Text>
        </View>

        {/* Spots left */}
        <View style={styles.infoRow}>
          <Ionicons
            name="people-outline"
            size={16}
            color={spotsLeft <= 3 ? colors.warning : colors.textLight}
          />
          <Text style={[styles.infoText, spotsLeft <= 3 && styles.warningText]}>
            {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Event full'}
          </Text>
        </View>

        {/* Description */}
        {event.description ? (
          <Text style={styles.description}>{event.description}</Text>
        ) : null}

        {/* Participants */}
        <ParticipantList
          participants={event.participants}
          maxParticipants={event.max_participants}
          hostId={event.host_id}
        />
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={styles.stickyBar}>
        {renderCTA()}
      </View>

      <JoinConfirmModal
        visible={modalVisible}
        isPending={joinMutation.isPending}
        error={joinError}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: colors.textLight,
    marginBottom: 12,
    textAlign: 'center',
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  backBtn: {
    paddingVertical: 12,
    paddingRight: 16,
    alignSelf: 'flex-start',
  },
  accentStrip: {
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 32,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  sportBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.textLight,
    flex: 1,
  },
  warningText: {
    color: colors.warning,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray[200],
  },
  description: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 16,
  },
  stickyBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  joinBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  hostBtn: {
    backgroundColor: colors.gray[100],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  hostBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray[500],
  },
  leaveBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  leaveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  fullBtn: {
    backgroundColor: colors.gray[200],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  fullBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray[500],
  },
});
