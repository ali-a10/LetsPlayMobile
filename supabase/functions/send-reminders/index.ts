import { json, fail } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { notifyUsers } from '../_shared/push.ts';
import {
  reminder24Copy,
  hostReminder24Copy,
  reminder2Copy,
  postEventNudgeCopy,
} from '../_shared/messages.ts';

const HOUR_MS = 3_600_000;

/** Loads the user ids of every participant of an event. */
async function participantIdsFor(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string
): Promise<string[]> {
  const { data } = await admin.from('participants').select('user_id').eq('event_id', eventId);
  return (data ?? []).map((row) => row.user_id);
}

/**
 * Cron worker (every 15 min): sends 24h and 2h event reminders plus the post-event nudge.
 * Windows are wide (2h) so a missed tick can't skip anyone; the notifications dedupe key
 * (one per event per type) makes re-scans of the same window at-most-once.
 */
Deno.serve(async (req: Request) => {
  // Only the cron may run this — same shared-secret pattern as process-payouts.
  const cronSecret = Deno.env.get('REMINDERS_CRON_SECRET') ?? '';
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!cronSecret || provided !== cronSecret) {
    return fail('FORBIDDEN', 'This endpoint is internal.', 403);
  }

  try {
    const admin = createAdminClient();
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    let events24 = 0;
    let events2 = 0;
    let nudged = 0;

    // 24-hour reminders: participants + host.
    const { data: e24, error: err24 } = await admin
      .from('events')
      .select('id, host_id, title, location, current_participants')
      .is('cancelled_at', null)
      .gt('date', iso(now + 22 * HOUR_MS))
      .lte('date', iso(now + 24 * HOUR_MS));
    if (err24) throw new Error(`24h query failed: ${err24.message}`);
    for (const ev of e24 ?? []) {
      const participantIds = await participantIdsFor(admin, ev.id);
      // The host gets the dedicated "You're hosting" reminder below, so exclude them from
      // the participant reminder — otherwise a host who joined their own event gets both.
      const attendeeIds = participantIds.filter((id) => id !== ev.host_id);
      const pCopy = reminder24Copy(ev.title, ev.location);
      await notifyUsers(admin, {
        userIds: attendeeIds,
        type: 'reminder_24h',
        title: pCopy.title,
        body: pCopy.body,
        url: `/event/${ev.id}`,
        eventId: ev.id,
        dedupeKey: `r24:${ev.id}`,
      });
      const hCopy = hostReminder24Copy(ev.title, ev.current_participants);
      await notifyUsers(admin, {
        userIds: [ev.host_id],
        type: 'host_reminder_24h',
        title: hCopy.title,
        body: hCopy.body,
        url: `/event/${ev.id}`,
        eventId: ev.id,
        dedupeKey: `h24:${ev.id}`,
      });
      events24++;
    }

    // 2-hour reminders: participants only.
    const { data: e2, error: err2 } = await admin
      .from('events')
      .select('id, title')
      .is('cancelled_at', null)
      .gt('date', iso(now + 1 * HOUR_MS))
      .lte('date', iso(now + 2 * HOUR_MS));
    if (err2) throw new Error(`2h query failed: ${err2.message}`);
    for (const ev of e2 ?? []) {
      const participantIds = await participantIdsFor(admin, ev.id);
      const copy = reminder2Copy(ev.title);
      await notifyUsers(admin, {
        userIds: participantIds,
        type: 'reminder_2h',
        title: copy.title,
        body: copy.body,
        url: `/event/${ev.id}`,
        eventId: ev.id,
        dedupeKey: `r2:${ev.id}`,
      });
      events2++;
    }

    // Post-event nudge: events that started 2–4 hours ago. The lower bound stops the
    // feature's first deploy from nudging every historical event.
    const { data: ended, error: errEnded } = await admin
      .from('events')
      .select('id, title')
      .is('cancelled_at', null)
      .gte('date', iso(now - 4 * HOUR_MS))
      .lt('date', iso(now - 2 * HOUR_MS));
    if (errEnded) throw new Error(`nudge query failed: ${errEnded.message}`);
    for (const ev of ended ?? []) {
      const participantIds = await participantIdsFor(admin, ev.id);
      const copy = postEventNudgeCopy(ev.title);
      await notifyUsers(admin, {
        userIds: participantIds,
        type: 'post_event_nudge',
        title: copy.title,
        body: copy.body,
        url: '/(tabs)/my-events',
        eventId: ev.id,
        dedupeKey: `nudge:${ev.id}`,
      });
      nudged++;
    }

    return json({ events24, events2, nudged }, 200);
  } catch (err) {
    console.error('send-reminders error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return json({ code: 'INTERNAL', message }, 500);
  }
});
