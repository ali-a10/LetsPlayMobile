/** Base URL for share links. Path matches the in-app Expo Router route so Universal Links can route straight into the app later. */
export const SHARE_BASE_URL = 'https://letsplayapp.ca';

/** Builds the public share URL for an event. */
export function buildEventShareUrl(eventId: string): string {
  return `${SHARE_BASE_URL}/event/${eventId}`;
}
