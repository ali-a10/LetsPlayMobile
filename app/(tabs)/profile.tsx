import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../lib/types/database';
import { colors } from '../../lib/constants/colors';

/** Displays the user's profile with stats, account settings, and activity links. */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ joined: 0, hosted: 0 });

  /** Fetches the user's profile and computed stats from Supabase. */
  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      const fetchData = async () => {
        const [profileRes, joinedRes, hostedRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase
            .from('participants')
            .select('event_id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('host_id', user.id),
        ]);

        if (profileRes.data) setProfile(profileRes.data);
        setStats({
          joined: joinedRes.count ?? 0,
          hosted: hostedRes.count ?? 0,
        });
        setLoading(false);
      };

      fetchData();
    }, [user])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>
              {profile?.first_name} {profile?.last_name}
            </Text>
          </View>
          <Ionicons name="settings-outline" size={22} color={colors.white} />
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.joined}</Text>
            <Text style={styles.statLabel}>Events Joined</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.hosted}</Text>
            <Text style={styles.statLabel}>Events Hosted</Text>
          </View>
        </View>
      </View>

      {/* White content area with rounded top corners */}
      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuItem icon="create-outline" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
        <MenuItem icon="mail-outline" label="Email Preferences" />
        <MenuItem icon="settings-outline" label="Settings" />
        <MenuItem icon="shield-checkmark-outline" label="Privacy Policy" />
      </View>

      {/* Activity Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <MenuItem icon="calendar-outline" label="My Events" />
        <MenuItem icon="trophy-outline" label="Favorite Sports" />
      </View>

      {/* Social Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social</Text>
        <MenuItem icon="people-outline" label="Invite Friends" />
        <MenuItem icon="chatbubble-outline" label="Send Us Feedback" />
      </View>

      {/* Support & Legal Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support & Legal</Text>
        <MenuItem icon="help-circle-outline" label="Help / FAQ" />
        <MenuItem icon="document-text-outline" label="Terms of Service" />
      </View>

      {/* Log Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={() => supabase.auth.signOut()}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.menuLabel, { color: colors.error }]}>Log Out</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
}

/** Renders a single menu row with an icon, label, and chevron. */
function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={onPress}>
      <Ionicons name={icon as any} size={22} color={colors.gray[500]} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.gray[400]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  // Header
  headerBg: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.darkCyan,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray[300],
    fontWeight: '500',
  },
  // Content area
  contentArea: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -4,
  },

  // Sections
  section: {
    marginTop: 8,
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 4,
  },

  // Menu Items
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
