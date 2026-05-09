import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';
import { useAuth } from '../../lib/hooks/useAuth';
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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  return (
    <View>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.headerText}>
          Participants ({participants.length}/{maxParticipants})
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
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
              const isSelf = p.user_id === user?.id;
              return (
                <Pressable
                  key={p.user_id}
                  style={styles.row}
                  onPress={() => {
                    if (!isSelf) router.push(`/user/${p.user_id}`);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${firstName} ${lastName}'s profile`}
                >
                  {p.profiles?.avatar_url ? (
                    <Image source={{ uri: p.profiles.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: avatarColor }]} />
                  )}
                  <Text style={styles.name}>{firstName} {lastName}</Text>
                  {isHost && (
                    <View style={styles.hostBadge}>
                      <Text style={styles.hostBadgeText}>Host</Text>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    avatarImage: {
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
      backgroundColor: colors.header,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    hostBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: sharedColors.white,
    },
    empty: {
      fontSize: 14,
      color: colors.textMuted,
    },
  });
}
