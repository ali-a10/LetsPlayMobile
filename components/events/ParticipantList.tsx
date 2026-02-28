import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/constants/colors';
import { ParticipantWithProfile } from '../../lib/hooks/useEventDetail';

const AVATAR_COLORS = [
  '#F59E0B', '#16A34A', '#0284C7', '#DC2626',
  '#7C3AED', '#15803D', '#DB2777', '#D97706',
];

interface ParticipantListProps {
  participants: ParticipantWithProfile[];
  maxParticipants: number;
  hostId: string;
}

/** Collapsible list of event participants showing a colored avatar circle, full name, and "Host" badge per row. Always starts collapsed. */
export function ParticipantList({ participants, maxParticipants, hostId }: ParticipantListProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.headerText}>
          Participants ({participants.length}/{maxParticipants})
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textLight}
        />
      </Pressable>

      {expanded && (
        <View style={styles.list}>
          {participants.length === 0 ? (
            <Text style={styles.empty}>No participants yet.</Text>
          ) : (
            participants.map((p, index) => {
              const firstName = p.profiles?.first_name ?? '';
              const lastName = p.profiles?.last_name ?? '';
              const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
              const isHost = p.user_id === hostId;
              return (
                <View key={p.user_id} style={styles.row}>
                  <View style={[styles.avatar, { backgroundColor: avatarColor }]} />
                  <Text style={styles.name}>{firstName} {lastName}</Text>
                  {isHost && (
                    <View style={styles.hostBadge}>
                      <Text style={styles.hostBadgeText}>Host</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  headerText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  list: {
    gap: 12,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  name: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  hostBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  hostBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },
  empty: {
    fontSize: 14,
    color: colors.textLight,
  },
});
