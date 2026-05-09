import { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../lib/hooks/useThemeColors';
import { ThemeColors, sharedColors } from '../../lib/constants/colors';
import { useAuth } from '../../lib/hooks/useAuth';
import { useProfile } from '../../lib/hooks/useProfile';
import { useUserStats } from '../../lib/hooks/useUserStats';
import { getSportColor, getSportIcon, getSportLabel } from '../../lib/utils/sports';

/** Public read-only profile screen for viewing another user's identity, stats, bio, and favorite sports. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isSelf = !!user && user.id === id;

  /** Defensive guard: if a user ends up here for their own ID, redirect to the My Profile tab. */
  useEffect(() => {
    if (isSelf) {
      router.replace('/(tabs)/profile');
    }
  }, [isSelf]);

  const { data: profile, isLoading, error } = useProfile(isSelf ? undefined : id);
  const { data: stats } = useUserStats(isSelf ? undefined : id);

  if (isSelf) {
    return null;
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load profile.</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  /** Returns the user's initials from their first and last name. */
  const getInitials = () => {
    const first = profile.first_name?.[0] ?? '';
    const last = profile.last_name?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  };

  const favoriteSports = profile.favourite_sports ?? [];

  return (
    <View style={styles.container}>
      {/* Teal header with back arrow, avatar, name, and stats */}
      <View style={[styles.headerBg, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={sharedColors.white} />
          </Pressable>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.identity}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          )}
          <Text style={styles.name}>
            {profile.first_name} {profile.last_name}
          </Text>
        </View>

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

      {/* Rounded white content area */}
      <ScrollView
        style={styles.contentArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* About Me */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About Me</Text>
          {profile.about_me ? (
            <Text style={styles.bodyText}>{profile.about_me}</Text>
          ) : (
            <Text style={styles.placeholderText}>This user hasn't added a bio yet.</Text>
          )}
        </View>

        {/* Favorite Sports */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Favorite Sports</Text>
          {favoriteSports.length > 0 ? (
            <View style={styles.sportsRow}>
              {favoriteSports.map((sport) => {
                const color = getSportColor(sport);
                return (
                  <View
                    key={sport}
                    style={[
                      styles.sportPill,
                      { backgroundColor: `${color}22`, borderColor: color },
                    ]}
                  >
                    <Ionicons name={getSportIcon(sport)} size={12} color={color} />
                    <Text style={[styles.sportPillText, { color }]}>
                      {getSportLabel(sport)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.placeholderText}>No favorite sports listed.</Text>
          )}
        </View>

        {/* Block / Report actions */}
        <View style={styles.card}>
          <Pressable style={styles.actionBtn} accessibilityRole="button" accessibilityLabel="Block user">
            <Ionicons name="ban-outline" size={18} color={colors.error} />
            <Text style={styles.actionBtnText}>Block User</Text>
          </Pressable>
          <View style={styles.actionDivider} />
          <Pressable style={styles.actionBtn} accessibilityRole="button" accessibilityLabel="Report user">
            <Ionicons name="flag-outline" size={18} color={colors.error} />
            <Text style={styles.actionBtnText}>Report User</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/** Creates theme-aware styles for the UserProfileScreen. */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
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
    headerBg: {
      backgroundColor: colors.header,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    identity: {
      alignItems: 'center',
      marginBottom: 20,
    },
    avatarImage: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginBottom: 12,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.avatarBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarText: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.avatarText,
    },
    name: {
      fontSize: 22,
      fontWeight: '700',
      color: sharedColors.white,
      textAlign: 'center',
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

    // -- Content area --
    contentArea: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    scrollContent: {
      padding: 20,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 16,
      shadowColor: sharedColors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.sectionTitle,
      marginBottom: 10,
    },
    bodyText: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    placeholderText: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: 'italic',
    },

    // -- Favorite sports chips --
    sportsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    sportPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    sportPillText: {
      fontSize: 12,
      fontWeight: '600',
    },

    // -- Block / Report actions --
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    actionBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.error,
    },
    actionDivider: {
      height: 1,
      backgroundColor: colors.menuDivider,
    },
  });
}
