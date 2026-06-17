import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';
import { useAuth } from '../../lib/hooks/useAuth';
import { useEventDetail } from '../../lib/hooks/useEventDetail';
import { useJoinEvent } from '../../lib/hooks/useJoinEvent';
import { useLeaveEvent } from '../../lib/hooks/useLeaveEvent';
import { ParticipantList } from '../../components/events/ParticipantList';
import { ConfirmModal } from '../../components/events/ConfirmModal';
import { getSportColor, getSportIcon, getSportLabel } from '../../lib/utils/sports';
import { shareEvent } from '../../lib/utils/shareEvent';
import { isWithinLeaveCutoff } from '../../lib/utils/eventTiming';

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
  const { user } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: event, isLoading, error: fetchError } = useEventDetail(id);
  const joinMutation = useJoinEvent(id);

  const [modalVisible, setModalVisible] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const leaveMutation = useLeaveEvent(id);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

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

  const handleLeavePress = () => {
    setLeaveError(null);
    setLeaveModalVisible(true);
  };

  const handleLeaveConfirm = () => {
    leaveMutation.mutate(undefined, {
      onSuccess: () => setLeaveModalVisible(false),
      onError: (err) => setLeaveError(err.message),
    });
  };

  const handleLeaveCancel = () => {
    if (!leaveMutation.isPending) {
      setLeaveModalVisible(false);
      setLeaveError(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
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
  const within12h = isWithinLeaveCutoff(event.date);
  const spotsLeft = event.max_participants - event.current_participants;
  const isFree = !event.is_paid || !event.price;
  const hostName = event.profiles
    ? `${event.profiles.first_name} ${event.profiles.last_name}`
    : 'Unknown';
  const fillPercent = Math.min(
    (event.current_participants / event.max_participants) * 100,
    100
  );

  /** Renders the appropriate CTA button based on user/event state. */
  const renderCTA = () => {
    if (event.isUserHost) {
      return (
        <Pressable style={styles.editEventBtn} onPress={() => router.push(`/edit-event/${id}`)}>
          <Ionicons name="create-outline" size={18} color={sharedColors.white} />
          <Text style={styles.editEventBtnText}>Edit Event</Text>
        </Pressable>
      );
    }
    if (event.isUserJoined) {
      if (within12h) {
        return (
          <View>
            <Pressable style={[styles.leaveBtn, styles.leaveBtnDisabled]} disabled>
              <Text style={styles.leaveBtnText}>Leave Event</Text>
            </Pressable>
            <Text style={styles.ctaHelperText}>
              Spots can't be cancelled within 12 hours of the event start.
            </Text>
          </View>
        );
      }
      return (
        <Pressable
          style={styles.leaveBtn}
          onPress={handleLeavePress}
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Teal header section */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={sharedColors.white} />
          </Pressable>

          <Pressable
            style={styles.shareBtn}
            onPress={() => shareEvent(event)}
            accessibilityLabel="Share event"
            accessibilityRole="button"
          >
            <Ionicons name="share-outline" size={18} color={sharedColors.white} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <View style={styles.headerMeta}>
            <View style={[styles.sportBadge, { backgroundColor: `${sportColor}22`, borderColor: sportColor }]}>
              <Ionicons name={getSportIcon(event.sport)} size={12} color={sportColor} />
              <Text style={[styles.sportBadgeText, { color: sportColor }]}>
                {getSportLabel(event.sport)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Rounded content area */}
      <View style={styles.contentArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Details card */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={23} color={colors.accent} />
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {formatDate(event.date)} at {formatTime(event.date)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={23} color={colors.accent} />
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{event.location}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={23} color={colors.success} />
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Price</Text>
                <Text style={[styles.detailValue, { color: colors.success }]}>
                  {isFree ? 'Free' : `$${event.price?.toFixed(2)}`}
                </Text>
              </View>
            </View>

            {event.description ? (
              <>
                <View style={styles.divider} />
                <View style={styles.descriptionInner}>
                  <View style={styles.descriptionTitleRow}>
                    <Ionicons name="information-circle-outline" size={21} color={colors.accent} />
                    <Text style={styles.descriptionTitle}>About this event</Text>
                  </View>
                  <Text
                    style={styles.descriptionText}
                    numberOfLines={descriptionExpanded ? undefined : 4}
                  >
                    {event.description}
                  </Text>
                  <Pressable onPress={() => setDescriptionExpanded((v) => !v)}>
                    <Text style={styles.viewMoreText}>
                      {descriptionExpanded ? 'View less' : 'View more'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>

          {/* Host card */}
          <Pressable
            style={styles.hostCard}
            onPress={() => {
              if (event.host_id !== user?.id) {
                router.push(`/user/${event.host_id}`);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`View ${hostName}'s profile`}
          >
            {event.profiles?.avatar_url ? (
              <Image source={{ uri: event.profiles.avatar_url }} style={styles.hostAvatarImage} />
            ) : (
              <View style={styles.hostAvatar}>
                <Text style={styles.hostAvatarText}>
                  {event.profiles
                    ? `${event.profiles.first_name[0]}${event.profiles.last_name[0]}`
                    : '?'}
                </Text>
              </View>
            )}
            <View style={styles.detailTextGroup}>
              <Text style={styles.detailLabel}>Hosted by</Text>
              <Text style={styles.hostName}>{hostName}</Text>
            </View>
          </Pressable>

          {/* Capacity + Participants card */}
          <View style={styles.participantsCard}>
            <View style={styles.capacityHeader}>
              <Ionicons name="people-outline" size={16} color={colors.sectionTitle} />
              <Text style={styles.capacityTitle}>
                {event.current_participants}/{event.max_participants} players
              </Text>
              <Text
                style={[
                  styles.spotsText,
                  spotsLeft <= 3 && spotsLeft > 0 && styles.spotsWarning,
                  spotsLeft === 0 && styles.spotsFull,
                ]}
              >
                {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${fillPercent}%` },
                  spotsLeft <= 3 && spotsLeft > 0 && { backgroundColor: colors.warning },
                  spotsLeft === 0 && { backgroundColor: colors.error },
                ]}
              />
            </View>
            <View style={styles.capacityDivider} />
            <ParticipantList
              participants={event.participants}
              maxParticipants={event.max_participants}
              hostId={event.host_id}
            />
          </View>
        </ScrollView>

        {/* Sticky bottom CTA */}
        <View style={styles.stickyBar}>
          {renderCTA()}
        </View>
      </View>

      <ConfirmModal
        visible={modalVisible}
        isPending={joinMutation.isPending}
        error={joinError}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title="Join Event?"
        body={
          within12h
            ? "Are you sure you want to join this event? You won't be able to cancel this spot — it starts within 12 hours."
            : 'Are you sure you want to join this event?'
        }
        confirmLabel="Confirm"
        confirmColor={colors.header}
      />

      <ConfirmModal
        visible={leaveModalVisible}
        isPending={leaveMutation.isPending}
        error={leaveError}
        onConfirm={handleLeaveConfirm}
        onCancel={handleLeaveCancel}
        title="Leave Event?"
        body="Are you sure you want to leave this event?"
        confirmLabel="Leave"
        confirmColor={colors.error}
      />
    </SafeAreaView>
  );
}

/** Creates theme-aware styles for the EventDetailScreen. */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.header,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    errorText: {
      fontSize: 15,
      color: colors.textMuted,
      marginBottom: 12,
      textAlign: 'center',
    },
    backLink: {
      padding: 8,
    },
    backLinkText: {
      fontSize: 15,
      color: colors.sectionTitle,
      fontWeight: '600',
    },

    // -- Header --
    header: {
      backgroundColor: colors.header,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backBtn: {
      paddingVertical: 10,
      paddingRight: 16,
      alignSelf: 'flex-start',
    },
    shareBtn: {
      paddingVertical: 10,
      paddingLeft: 16,
      alignSelf: 'flex-end',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    shareBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: sharedColors.white,
    },
    editBtn: {
      paddingVertical: 10,
      paddingLeft: 16,
      alignSelf: 'flex-end',
    },
    headerContent: {
      gap: 8,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: sharedColors.white,
      lineHeight: 30,
    },
    headerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    },
    sportBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    sportBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    // -- Content area --
    contentArea: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 24,
    },

    // -- Description (inline in details card) --
    descriptionInner: {
      paddingVertical: 13,
      marginTop: 15,
    },
    descriptionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    descriptionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textMuted,
    },
    descriptionText: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    viewMoreText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 10,
    },

    // -- Host card --
    hostCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 22,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      shadowColor: sharedColors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    hostAvatarImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    hostAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.avatarBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hostAvatarText: {
      fontSize: 16,
      fontWeight: '700',
      color: sharedColors.white,
    },
    hostName: {
      fontSize: 18,
      fontWeight: '500',
      color: colors.text,
    },

    // -- Details card --
    detailsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: sharedColors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 13,
    },
    detailTextGroup: {
      flex: 1,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      marginBottom: 3,
    },
    detailValue: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.menuDivider,
      marginLeft: 54,
      marginVertical: 0,
    },

    // -- Capacity + Participants card --
    participantsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: sharedColors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    capacityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    capacityDivider: {
      height: 1,
      backgroundColor: colors.menuDivider,
      marginVertical: 18,
    },
    capacityTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.sectionTitle,
      flex: 1,
    },
    spotsText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.sectionTitle,
    },
    spotsWarning: {
      color: colors.warning,
    },
    spotsFull: {
      color: colors.error,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.progressTrack,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.progressFill,
    },


    // -- Sticky CTA bar --
    stickyBar: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 38,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    joinBtn: {
      backgroundColor: colors.buttonPrimaryBg,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    joinBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: sharedColors.white,
    },
    editEventBtn: {
      backgroundColor: colors.avatarBg,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    editEventBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: sharedColors.white,
    },
    leaveBtn: {
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: '#E53E3E',
    },
    leaveBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: sharedColors.white,
    },
    leaveBtnDisabled: {
      opacity: 0.5,
    },
    ctaHelperText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
    },
    fullBtn: {
      backgroundColor: colors.cardBorder,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    fullBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textMuted,
    },
  });
}
