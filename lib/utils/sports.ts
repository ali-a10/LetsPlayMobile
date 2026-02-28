import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

/** Returns a sport-specific accent color. */
export function getSportColor(sport: string): string {
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

/** Returns a human-readable label for a sport slug. */
export function getSportLabel(sport: string): string {
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

/** Returns the Ionicons icon name for a sport slug. */
export function getSportIcon(sport: string): keyof typeof Ionicons.glyphMap {
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

/** Formats an ISO date string to "Wed, Dec 11 • 7:45 PM". */
export function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday}, ${month} ${day} • ${time}`;
}
