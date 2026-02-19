import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/constants/colors';
import { Event } from '../../lib/types/database';

interface EventCardProps {
  event: Event;
  onPress: () => void;
}

/** Formats an ISO date string like "Wed, Dec 11 • 7:45PM". */
function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(' ', '');
  return `${weekday}, ${month} ${day} \u2022 ${time}`;
}

/** Displays a single event as a pressable card with image, details, and badge. */
export function EventCard({ event, onPress }: EventCardProps) {
  const isFree = !event.is_paid || !event.price;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imagePlaceholder} />

      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.dateText}>{formatEventDate(event.date)}</Text>

        <View style={styles.bottomRow}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color={colors.textLight} />
            <Text style={styles.infoText}>{event.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={14} color={colors.secondary} />
            <Text style={styles.participantText}>
              {event.current_participants}/{event.max_participants}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.badge, isFree ? styles.freeBadge : styles.paidBadge]}>
        <Text style={styles.badgeText}>
          {isFree ? 'Free' : `$${event.price?.toFixed(2)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.gray[200],
  },
  details: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: colors.textLight,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  infoText: {
    fontSize: 13,
    color: colors.textLight,
  },
  participantText: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  freeBadge: {
    backgroundColor: colors.accent,
  },
  paidBadge: {
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
});
