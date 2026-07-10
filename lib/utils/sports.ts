import { Ionicons } from '@expo/vector-icons';

/** Returns a sport-specific accent color (theme-invariant). */
export function getSportColor(sport: string): string {
  switch (sport?.toLowerCase()) {
    case 'basketball': return '#F59E0B';
    case 'soccer':     return '#16A34A';
    case 'swimming':   return '#0284C7';
    case 'tennis':     return '#a3cb04ff';
    case 'volleyball': return '#DC2626';
    case 'running':    return '#7C3AED';
    case 'golf':         return '#15803D';
    case 'hockey':       return '#64748B';
    case 'padel':        return '#0EA5E9';
    case 'pickleball':   return '#F97316';
    case 'football':     return '#92400E';
    case 'baseball':     return '#B45309';
    case 'table_tennis': return '#6366F1';
    case 'cricket':      return '#DC2626';
    case 'badminton':    return '#EC4899';
    case 'squash':       return '#0E7490';
    case 'cycling':      return '#059669';
    default:           return '#0D5C63';
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
    case 'golf':         return 'Golf';
    case 'hockey':       return 'Hockey';
    case 'padel':        return 'Padel';
    case 'pickleball':   return 'Pickleball';
    case 'football':     return 'Football';
    case 'baseball':     return 'Baseball';
    case 'table_tennis': return 'Table Tennis';
    case 'cricket':      return 'Cricket';
    case 'badminton':    return 'Badminton';
    case 'squash':       return 'Squash';
    case 'cycling':      return 'Cycling';
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
    case 'golf':         return 'flag-outline';
    case 'hockey':       return 'triangle-outline';
    case 'padel':        return 'tennisball-outline';
    case 'pickleball':   return 'tennisball-outline';
    case 'football':     return 'american-football-outline';
    case 'baseball':     return 'baseball-outline';
    case 'table_tennis': return 'ellipse-outline';
    case 'cricket':      return 'disc-outline';
    case 'badminton':    return 'tennisball-outline';
    case 'squash':       return 'tennisball-outline';
    case 'cycling':      return 'bicycle-outline';
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
