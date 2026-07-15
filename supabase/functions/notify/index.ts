import { json, fail } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { notifyUsers } from '../_shared/push.ts';
import { joinedCopy, leftCopy } from '../_shared/messages.ts';

/**
 * Internal endpoint hit by the participants-table trigger (via pg_net): tells an event's host
 * that someone joined or left. Gated by x-notify-secret — never called by clients directly.
 */
Deno.serve(async (req: Request) => {
  // Only the DB trigger may call this (same internal-secret pattern as process-payouts).
  const secret = Deno.env.get('NOTIFY_SECRET') ?? '';
  const provided = req.headers.get('x-notify-secret') ?? '';
  if (!secret || provided !== secret) {
    return fail('FORBIDDEN', 'This endpoint is internal.', 403);
  }

  try {
    const { kind, event_id, actor_id } = await req.json().catch(() => ({}));
    if ((kind !== 'joined' && kind !== 'left') || !event_id || !actor_id) {
      return fail('BAD_REQUEST', 'Invalid payload.', 400);
    }

    const admin = createAdminClient();

    const { data: event } = await admin
      .from('events')
      .select('id, host_id, title, date, cancelled_at, current_participants, max_participants')
      .eq('id', event_id)
      .maybeSingle();
    // Skip quietly for cancelled/past/missing events — e.g. the row-delete cascade of an
    // account deletion, or bookkeeping around a cancelled event, must not ping hosts.
    if (!event || event.cancelled_at || new Date(event.date).getTime() <= Date.now()) {
      return json({ skipped: true }, 200);
    }
    if (event.host_id === actor_id) {
      return json({ skipped: true }, 200);
    }

    const { data: actor } = await admin
      .from('profiles')
      .select('first_name')
      .eq('id', actor_id)
      .maybeSingle();
    if (!actor) {
      // Actor profile already gone (account-deletion cascade) — nothing meaningful to say.
      return json({ skipped: true }, 200);
    }

    const copy =
      kind === 'joined'
        ? joinedCopy(actor.first_name, event.title, event.current_participants, event.max_participants)
        : leftCopy(actor.first_name, event.title, event.current_participants, event.max_participants);

    await notifyUsers(admin, {
      userIds: [event.host_id],
      type: kind === 'joined' ? 'participant_joined' : 'participant_left',
      title: copy.title,
      body: copy.body,
      url: `/event/${event.id}`,
      eventId: event.id,
    });

    return json({ sent: true }, 200);
  } catch (err) {
    console.error('notify error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return json({ code: 'INTERNAL', message }, 500);
  }
});
