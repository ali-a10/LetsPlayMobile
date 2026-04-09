export interface ThemeColors {
  header: string;
  background: string;
  card: string;
  cardTint: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  chipInactiveBg: string;
  chipInactiveBorder: string;
  chipInactiveText: string;
  chipActiveBg: string;
  chipActiveText: string;
  accent: string;
  progressFill: string;
  progressTrack: string;
  avatarBg: string;
  avatarText: string;
  sectionTitle: string;
  menuDivider: string;
  chevron: string;
  error: string;
  statCardBg: string;
  statCardBorder: string;
  tabBarBg: string;
  tabBarActive: string;
  tabBarInactive: string;
  tabBarBorder: string;
  statusBarStyle: 'light-content' | 'dark-content';
  searchBg: string;
  searchText: string;
  searchPlaceholder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  overlay: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonOutlineBorder: string;
  buttonOutlineText: string;
  success: string;
  warning: string;
}

/** Light mode palette using the approved teal color scheme. */
export const lightTheme: ThemeColors = {
  header: '#0D5C63',
  background: '#F5F9FA',
  card: '#FFFFFF',
  cardTint: 'rgba(13,92,99,0.03)',
  cardBorder: '#D4E4E7',
  text: '#1C2E33',
  textMuted: '#5C7B82',
  chipInactiveBg: '#E8F2F3',
  chipInactiveBorder: '#E8F2F3',
  chipInactiveText: '#5C7B82',
  chipActiveBg: '#0D5C63',
  chipActiveText: '#FFFFFF',
  accent: '#00D4AA',
  progressFill: '#00B8A1',
  progressTrack: '#E0EDED',
  avatarBg: '#00B8A1',
  avatarText: '#FFFFFF',
  sectionTitle: '#0D5C63',
  menuDivider: '#E8F2F3',
  chevron: '#9CB5BB',
  error: '#E53E3E',
  statCardBg: 'rgba(255,255,255,0.12)',
  statCardBorder: 'rgba(255,255,255,0.15)',
  tabBarBg: '#FFFFFF',
  tabBarActive: '#0D5C63',
  tabBarInactive: '#9CB5BB',
  tabBarBorder: '#D4E4E7',
  statusBarStyle: 'light-content',
  searchBg: '#1A3038',
  searchText: '#FFFFFF',
  searchPlaceholder: '#9CB5BB',
  inputBg: '#FFFFFF',
  inputBorder: '#D4E4E7',
  inputText: '#1C2E33',
  inputPlaceholder: '#9CB5BB',
  overlay: 'rgba(0, 0, 0, 0.5)',
  buttonPrimaryBg: '#0D5C63',
  buttonPrimaryText: '#FFFFFF',
  buttonSecondaryBg: '#00D4AA',
  buttonSecondaryText: '#FFFFFF',
  buttonOutlineBorder: '#D4E4E7',
  buttonOutlineText: '#0D5C63',
  success: '#0ed385',
  warning: '#f59e0b',
};

/** Dark mode palette using the approved dark teal color scheme. */
export const darkTheme: ThemeColors = {
  header: '#0B2227',
  background: '#111B1E',
  card: '#182830',
  cardTint: 'rgba(0,212,170,0.04)',
  cardBorder: 'rgba(0,212,170,0.1)',
  text: '#E4EDEE',
  textMuted: '#7FA0A7',
  chipInactiveBg: '#182830',
  chipInactiveBorder: '#334A52',
  chipInactiveText: '#7FA0A7',
  chipActiveBg: '#00D4AA',
  chipActiveText: '#111B1E',
  accent: '#00D4AA',
  progressFill: '#00B8A1',
  progressTrack: '#2A3D44',
  avatarBg: '#00B8A1',
  avatarText: '#111B1E',
  sectionTitle: '#00D4AA',
  menuDivider: '#243740',
  chevron: '#4A6A73',
  error: '#F87171',
  statCardBg: 'rgba(0,212,170,0.07)',
  statCardBorder: 'rgba(0,212,170,0.12)',
  tabBarBg: '#0B2227',
  tabBarActive: '#00D4AA',
  tabBarInactive: '#4A6A73',
  tabBarBorder: '#243740',
  statusBarStyle: 'light-content',
  searchBg: '#182830',
  searchText: '#E4EDEE',
  searchPlaceholder: '#4A6A73',
  inputBg: '#182830',
  inputBorder: '#334A52',
  inputText: '#E4EDEE',
  inputPlaceholder: '#4A6A73',
  overlay: 'rgba(0, 0, 0, 0.7)',
  buttonPrimaryBg: '#0D5C63',
  buttonPrimaryText: '#FFFFFF',
  buttonSecondaryBg: '#00D4AA',
  buttonSecondaryText: '#111B1E',
  buttonOutlineBorder: '#334A52',
  buttonOutlineText: '#E4EDEE',
  success: '#0ed385',
  warning: '#f59e0b',
};

/** Theme-invariant colors that don't change between light and dark mode. */
export const sharedColors = {
  white: '#FFFFFF',
  black: '#000000',
  fab: '#00D4AA',
  progressFill: '#00B8A1',
};
