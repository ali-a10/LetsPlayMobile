import PostHog from 'posthog-react-native';
import { AnalyticsEvents } from './events';

let client: PostHog | null = null;

/** Initializes the PostHog client once; silently no-ops when the API key env var is missing (local dev, tests). */
export function initAnalytics(): void {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  if (!apiKey || client) return;
  client = new PostHog(apiKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    // Emits "Application Opened" / "Application Became Active" automatically,
    // which covers the app_opened metric — no custom event needed.
    captureAppLifecycleEvents: true,
  });
}

/** Records a typed analytics event; silently no-ops when analytics is disabled. */
export function track<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E]
): void {
  client?.capture(event, properties);
}

/** Ties subsequent events to the Supabase user id (never email or other PII). */
export function identifyUser(userId: string): void {
  client?.identify(userId);
}

/** Clears the identified user on logout so the next user's events aren't linked to them. */
export function resetAnalytics(): void {
  client?.reset();
}

/** Test seam: swaps the module-level client. Do not use in app code. */
export function _setClientForTesting(c: PostHog | null): void {
  client = c;
}
