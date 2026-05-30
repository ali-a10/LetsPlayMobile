import { Share } from 'react-native';
import { buildEventShareUrl } from '../constants/sharing';
import { getSportLabel } from './sports';

type ShareableEvent = { id: string; title: string; sport: string };

/** Opens the native share sheet with a pre-formatted invite message and a link to the event. Errors are swallowed silently — the OS share sheet provides its own feedback. */
export async function shareEvent(event: ShareableEvent): Promise<void> {
  const url = buildEventShareUrl(event.id);
  const message = `Join ${event.title} - ${getSportLabel(event.sport)} on the LetsPlay App!\n\n${url}`;
  try {
    await Share.share({ message });
  } catch {
    // Intentional: sharing is fire-and-forget.
  }
}
