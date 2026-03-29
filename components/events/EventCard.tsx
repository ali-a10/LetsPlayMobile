import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/constants/colors';
import { EventWithHost } from '../../lib/hooks/useEvents';
import { getSportColor, getSportIcon, getSportLabel, formatEventDate } from '../../lib/utils/sports';

interface EventCardProps {
  event: EventWithHost;
  onPress: () => void;
}


/** Displays a single event as a pressable card with a two-section layout: title/sport badge on top, details on a gray body below. */
export function EventCard({ event, onPress }: EventCardProps) {
  const isFree = !event.is_paid || !event.price;
  const sportColor = getSportColor(event.sport);
  const hostFirstName = event.profiles?.first_name ?? 'Host';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Top section: title + sport badge */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={[styles.sportBadge, { borderColor: sportColor }]}>
          <Ionicons
            name={getSportIcon(event.sport)}
            size={14}
            color={sportColor}
          />
          <Text style={[styles.sportBadgeText, { color: sportColor }]}>
            {getSportLabel(event.sport)}
          </Text>
        </View>
      </View>

      {/* Bottom section: gray body with date, location, host, and pills */}
      <View style={styles.body}>
        {/* Row 1: date + price */}
        <View style={styles.bodyRow}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textLight} />
            <Text style={styles.bodyText}>{formatEventDate(event.date)}</Text>
          </View>
          {/* no price pill — price displayed as plain body text */}
          <View style={styles.priceRow}>
            <Text style={styles.bodyText}>
              {isFree ? 'Free' : `$${event.price?.toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Row 2: location + host */}
        <View style={styles.bodyRow}>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.textLight} />
            <Text style={styles.bodyText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
          <View style={styles.hostRow}>
            {event.profiles?.avatar_url ? (
              <Image source={{ uri: event.profiles.avatar_url }} style={styles.avatarCircle} />
            ) : (
              <View style={[styles.avatarCircle, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(event.profiles?.first_name?.[0] ?? '').toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.hostName} numberOfLines={1}>{hostFirstName}</Text>
          </View>
        </View>

        {/* Row 3: participants progress bar */}
        <View style={styles.capacityRow}>
          <Ionicons name="people-outline" size={14} color={colors.teal} />
          <Text style={styles.capacityText}>
            {event.current_participants}/{event.max_participants} players
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min((event.current_participants / event.max_participants) * 100, 100)}%` },
              ]}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: `${colors.teal}26`,
    marginBottom: 15,
    // Shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.75,
    backgroundColor: '#f0f0f0',
    borderColor: `${colors.teal}80`,
  },
  // -- Top section --
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 7,
    paddingBottom: 6,
    backgroundColor: colors.white,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: colors.white,
    flexShrink: 0,
  },
  sportBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // -- Bottom section --
  body: {
    backgroundColor: '#0080a408',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 8,
  },
  bodyText: {
    fontSize: 15,
    color: colors.teal,
    flexShrink: 1,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 0,
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
  },
  avatarFallback: {
    backgroundColor: colors.darkCyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  hostName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    flexShrink: 1,
  },
  // no price pill — price row matches date/location layout
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  capacityText: {
    fontSize: 13,
    color: colors.teal,
    fontWeight: '500',
    flexShrink: 0,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.white,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.darkCyan,
  },
});
