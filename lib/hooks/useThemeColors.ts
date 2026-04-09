import { useColorScheme } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import { lightTheme, darkTheme, ThemeColors } from '../constants/colors';

/** Returns the active theme palette based on the user's preference and system setting. */
export function useThemeColors(): ThemeColors {
  const preference = useThemeStore((s) => s.preference);
  const systemScheme = useColorScheme();

  if (preference === 'system') {
    return systemScheme === 'dark' ? darkTheme : lightTheme;
  }
  return preference === 'dark' ? darkTheme : lightTheme;
}

/** Returns true when the resolved theme is dark. */
export function useIsDark(): boolean {
  const preference = useThemeStore((s) => s.preference);
  const systemScheme = useColorScheme();

  if (preference === 'system') {
    return systemScheme === 'dark';
  }
  return preference === 'dark';
}
