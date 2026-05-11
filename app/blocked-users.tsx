import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../lib/hooks/useThemeColors';
import { ThemeColors } from '../lib/constants/colors';
import { useAuth } from '../lib/hooks/useAuth';
import { useBlockedUsers, BlockedUser } from '../lib/hooks/useBlockedUsers';
import { useUnblockUser } from '../lib/hooks/useUnblockUser';

/** Settings sub-screen listing the viewer's blocked users with per-row Unblock buttons. */
export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const { data: blockedUsers, isLoading, error } = useBlockedUsers(user?.id);
  const unblockMutation = useUnblockUser();

  /** Triggers the unblock mutation for the given user, surfacing failures via an Alert. */
  const handleUnblock = (blockedId: string, name: string) => {
    unblockMutation.mutate(blockedId, {
      onError: (err) => {
        Alert.alert(`Couldn't unblock ${name}`, err.message);
      },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.statusBarStyle} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Couldn't load your blocked users.</Text>
        </View>
      ) : !blockedUsers || blockedUsers.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyCard}>
            <Ionicons name="ban-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
          </View>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          data={blockedUsers}
          keyExtractor={(item) => item.blocked_id}
          renderItem={({ item }) => (
            <BlockedRow
              colors={colors}
              styles={styles}
              item={item}
              isPending={
                unblockMutation.isPending && unblockMutation.variables === item.blocked_id
              }
              onUnblock={handleUnblock}
            />
          )}
        />
      )}
    </View>
  );
}

interface BlockedRowProps {
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  item: BlockedUser;
  isPending: boolean;
  onUnblock: (blockedId: string, name: string) => void;
}

/** Renders one blocked-user row with avatar/initials, name, and an Unblock button. */
function BlockedRow({ colors, styles, item, isPending, onUnblock }: BlockedRowProps) {
  const first = item.profiles?.first_name ?? '';
  const last = item.profiles?.last_name ?? '';
  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '?';
  const fullName = `${first} ${last}`.trim() || 'Unknown user';

  return (
    <View style={styles.row}>
      {item.profiles?.avatar_url ? (
        <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {fullName}
      </Text>
      <TouchableOpacity
        style={[styles.unblockBtn, isPending && styles.unblockBtnDisabled]}
        onPress={() => onUnblock(item.blocked_id, first || fullName)}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel={`Unblock ${fullName}`}
      >
        {isPending ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <Text style={styles.unblockText}>Unblock</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingVertical: 32,
      paddingHorizontal: 24,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      width: '100%',
    },
    emptyText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    avatarImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.avatarBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.avatarText,
    },
    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    unblockBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.error,
      minWidth: 84,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unblockBtnDisabled: {
      opacity: 0.6,
    },
    unblockText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.error,
    },
  });
}
