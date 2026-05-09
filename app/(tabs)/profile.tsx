import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/hooks/useProfile';
import { useUserStats } from '../../lib/hooks/useUserStats';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';

/** Displays the user's profile with stats, account settings, and activity links. */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { data: stats, isLoading: statsLoading } = useUserStats(user?.id);

  if (profileLoading || statsLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.header} />
      </View>
    );
  }

  /** Returns the user's initials from their first and last name. */
  const getInitials = () => {
    const first = profile?.first_name?.[0] ?? '';
    const last = profile?.last_name?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Teal background that extends behind status bar */}
      <View style={[styles.headerBg, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerContent}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.name}>
              {profile?.first_name} {profile?.last_name}
            </Text>
          </View>
          <View style={{ width: 22 }} />
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.joined ?? 0}</Text>
            <Text style={styles.statLabel}>Events Joined</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats?.hosted ?? 0}</Text>
            <Text style={styles.statLabel}>Events Hosted</Text>
          </View>
        </View>
      </View>

      {/* Content area with rounded top corners */}
      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuItem colors={colors} icon="create-outline" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
        {/* <MenuItem colors={colors} icon="mail-outline" label="Email Preferences" /> */}
        <MenuItem colors={colors} icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      {/* Social Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social</Text>
        <MenuItem colors={colors} icon="people-outline" label="Invite Friends" />
        <MenuItem colors={colors} icon="chatbubble-outline" label="Send Us Feedback" />
      </View>

      {/* Support & Legal Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support & Legal</Text>
        <MenuItem colors={colors} icon="help-circle-outline" label="Help / FAQ" />
        <MenuItem colors={colors} icon="close-circle-outline" label="Cancellation Policy" />
        <MenuItem colors={colors} icon="document-text-outline" label="Terms of Service" />
        <MenuItem colors={colors} icon="shield-checkmark-outline" label="Privacy Policy" />
      </View>

      {/* Log Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={() => supabase.auth.signOut()}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.menuLabel, { color: colors.error }]}>Log Out</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <MenuItem colors={colors} icon="trash-outline" label="Delete Account" onPress={() => router.push('/delete-account')} danger />
      </View>
      </ScrollView>
    </View>
  );
}

/** Renders a single menu row with an icon, label, and chevron. Pass danger=true for destructive actions. */
function MenuItem({ icon, label, onPress, danger, colors }: { icon: string; label: string; onPress?: () => void; danger?: boolean; colors: ThemeColors }) {
  const color = danger ? colors.error : colors.textMuted;
  const chevronColor = danger ? colors.error : colors.chevron;
  return (
    <TouchableOpacity style={menuItemStyles.menuItem} activeOpacity={0.6} onPress={onPress}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={[menuItemStyles.menuLabel, { color: danger ? colors.error : colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={chevronColor} />
    </TouchableOpacity>
  );
}

const menuItemStyles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.header,
    },
    headerBg: {
      backgroundColor: colors.header,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    avatarImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
      marginRight: 14,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.avatarBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    avatarText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.avatarText,
    },
    headerInfo: {
      flex: 1,
    },
    name: {
      fontSize: 20,
      fontWeight: '700',
      color: sharedColors.white,
      marginBottom: 2,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.statCardBg,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.statCardBorder,
    },
    statNumber: {
      fontSize: 22,
      fontWeight: '700',
      color: sharedColors.white,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '500',
    },
    contentArea: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      marginTop: -4,
    },
    section: {
      marginTop: 8,
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.sectionTitle,
      marginTop: 8,
      marginBottom: 4,
      marginLeft: 4,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 14,
    },
    menuLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
  });
}
