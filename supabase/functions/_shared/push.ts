import type { SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface NotifyInput {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  url: string;
  eventId?: string | null;
  dedupeKey?: string | null;
}

/** Splits an array into consecutive chunks of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Logs one notification per user (deduped via the notifications unique key) and pushes it to
 * each user's registered devices through the Expo push API, pruning tokens Expo reports dead.
 * NEVER throws — a notification failure must never abort the payment/booking flow around it.
 */
export async function notifyUsers(admin: SupabaseClient, input: NotifyInput): Promise<void> {
  try {
    if (input.userIds.length === 0) return;

    // 1. Log — ON CONFLICT DO NOTHING via ignoreDuplicates; only rows actually inserted
    //    come back, so a deduped notification never reaches the send step.
    const rows = input.userIds.map((userId) => ({
      user_id: userId,
      type: input.type,
      event_id: input.eventId ?? null,
      title: input.title,
      body: input.body,
      url: input.url,
      ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}),
    }));
    const { data: inserted, error: insertError } = await admin
      .from('notifications')
      .upsert(rows, { onConflict: 'user_id,type,dedupe_key', ignoreDuplicates: true })
      .select('user_id');
    if (insertError) {
      console.error('notifyUsers: failed to log notifications:', insertError.message);
      return;
    }
    const targetIds = [...new Set((inserted ?? []).map((r) => r.user_id))];
    if (targetIds.length === 0) return; // everything was a duplicate

    // 2. Resolve device tokens.
    const { data: tokens, error: tokenError } = await admin
      .from('push_tokens')
      .select('token')
      .in('user_id', targetIds);
    if (tokenError) {
      console.error('notifyUsers: failed to load push tokens:', tokenError.message);
      return;
    }
    if (!tokens || tokens.length === 0) return; // logged but no device to push to

    // 3. Send in batches of 100 (Expo's per-request limit).
    const messages = tokens.map((t) => ({
      to: t.token,
      title: input.title,
      body: input.body,
      data: { url: input.url },
      sound: 'default' as const,
      channelId: 'default',
    }));
    for (const batch of chunk(messages, 100)) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      const payload = await res.json().catch(() => null);
      const tickets: Array<{ status?: string; details?: { error?: string } }> | undefined =
        payload?.data;
      if (!Array.isArray(tickets)) {
        console.error('notifyUsers: unexpected Expo push response:', JSON.stringify(payload));
        continue;
      }
      // 4. Prune tokens Expo says are dead (user uninstalled / token rotated).
      for (let i = 0; i < tickets.length; i++) {
        if (tickets[i]?.details?.error === 'DeviceNotRegistered') {
          await admin.from('push_tokens').delete().eq('token', batch[i].to);
        }
      }
    }
  } catch (err) {
    console.error('notifyUsers failed:', err instanceof Error ? err.message : err);
  }
}
