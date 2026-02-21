import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/constants/colors';
import { EventWithHost } from '../../lib/hooks/useEvents';

interface EventCardProps {
  event: EventWithHost;
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

/** Returns the background hex color for a given sport name. */
function getSportColor(sport: string): string {
  switch (sport?.toLowerCase()) {
    case 'basketball': return '#F59E0B';
    case 'soccer':     return '#16A34A';
    case 'swimming':   return '#0284C7';
    case 'tennis':     return '#a3cb04ff';
    case 'volleyball': return '#DC2626';
    case 'running':    return '#7C3AED';
    case 'golf':       return '#15803D';
    default:           return colors.primary;
  }
}

/** Returns the Ionicons icon name for a given sport name. */
function getSportIcon(sport: string): keyof typeof Ionicons.glyphMap {
  switch (sport?.toLowerCase()) {
    case 'basketball': return 'basketball-outline';
    case 'soccer':     return 'football-outline';
    case 'swimming':   return 'water-outline';
    case 'tennis':     return 'tennisball-outline';
    case 'volleyball': return 'ellipse-outline';
    case 'running':    return 'body-outline';
    case 'golf':       return 'flag-outline';
    default:           return 'trophy-outline';
  }
}

/** Returns a human-readable display name for a given sport slug. */
function getSportLabel(sport: string): string {
  switch (sport?.toLowerCase()) {
    case 'basketball': return 'Basketball';
    case 'soccer':     return 'Soccer';
    case 'swimming':   return 'Swimming';
    case 'tennis':     return 'Tennis';
    case 'volleyball': return 'Volleyball';
    case 'running':    return 'Running';
    case 'golf':       return 'Golf';
    default:           return sport ?? 'Sport';
  }
}


/** Displays a single event as a pressable card with a two-section layout: title/sport badge on top, details on a gray body below. */
export function EventCard({ event, onPress }: EventCardProps) {
  const isFree = !event.is_paid || !event.price;
  const sportColor = getSportColor(event.sport);
  const hostName = event.profiles
    ? `${event.profiles.first_name} ${event.profiles.last_name}`
    : 'Unknown host';

  return (
    <Pressable style={styles.card} onPress={onPress}>
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
        {/* Row 1: date + price pill */}
        <View style={styles.bodyRow}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textLight} />
            <Text style={styles.bodyText}>{formatEventDate(event.date)}</Text>
          </View>
          <View style={[styles.pill, styles.pillWhite]}>
            <Text style={[styles.pillText, styles.pillTextDark]}>
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
            <View style={styles.avatarCircle} />
            <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
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
    borderColor: `${colors.teal}4D`,
    marginBottom: 12,
    // Shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: '#0080a413',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: colors.gray[50],
  },
  hostName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    flexShrink: 1,
  },
  // Shared pill style for participants and price
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // backgroundColor: colors.teal,
    borderWidth: 1,
    // borderColor: colors.teal,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexShrink: 0,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  pillWhite: {
    backgroundColor: colors.white, //'#0080a404',
    borderColor: colors.border,
  },
  pillTextDark: {
    color: colors.teal,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
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
    backgroundColor: colors.gray[50],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
});
