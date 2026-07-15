import { json, fail } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { stripe } from '../_shared/stripe.ts';
import { notifyUsers } from '../_shared/push.ts';
import { payoutSentCopy } from '../_shared/messages.ts';

/**
 * Hourly payout worker (§8.2). Invoked only by the pg_cron job, which passes the service-role key as a
 * Bearer token: this verifies that token, asks get_due_payouts for every payment whose event is ≥26h past
 * its start and still safe to pay, and creates a Stripe transfer of the host's share to their connected
 * account — marking each row transferred, or recording payout_failed_reason on a hard failure (an
 * insufficient-balance error is left untouched so the next run retries it).
 */
Deno.serve(async (req: Request) => {
  try {
    // 1. Only the cron may run this: the x-cron-secret header must equal our dedicated shared secret
    //    (§8.2). A leaked URL otherwise lets anyone force money movement — there's no per-user backstop.
    const cronSecret = Deno.env.get('PAYOUTS_CRON_SECRET') ?? '';
    const provided = req.headers.get('x-cron-secret') ?? '';
    if (!cronSecret || provided !== cronSecret) {
      return fail('FORBIDDEN', 'This endpoint is internal.', 403);
    }

    const admin = createAdminClient();

    // 2. Ask Postgres for the due payouts. All time math (event.date + 26h ≤ now()) runs in SQL against
    //    the DB clock, and the query mirrors idx_payments_payout_pending exactly.
    const { data: due, error: dueErr } = await admin.rpc('get_due_payouts');
    if (dueErr) throw new Error(`get_due_payouts failed: ${dueErr.message}`);

    let transferred = 0;
    let skipped = 0; // insufficient balance — untouched, retries next run
    let failed = 0; // flagged with payout_failed_reason — needs review

    // Notify each host once per event, not once per participant-payment (a 10-person event
    // creates 10 transfers in this loop). The dedupe key also suppresses re-notification if
    // later transfers for the same event land in a subsequent hourly run.
    const notifiedEvents = new Set<string>();

    // 3. Pay each host their share. One bad transfer must not abort the batch (§8.3).
    for (const row of due ?? []) {
      // Tracks whether Stripe created the transfer before a later step failed — see the catch below.
      let createdTransferId: string | null = null;
      try {
        const transfer = await stripe.transfers.create(
          {
            amount: row.amount_host_cents,
            currency: 'cad',
            destination: row.host_stripe_account_id,
            source_transaction: row.stripe_charge_id ?? undefined,
            transfer_group: `event_${row.event_id}`,
            metadata: { payment_id: row.payment_id, event_id: row.event_id },
          },
          { idempotencyKey: `transfer_${row.payment_id}` }
        );
        createdTransferId = transfer.id;

        const { error: updErr } = await admin
          .from('payments')
          .update({
            status: 'transferred',
            stripe_transfer_id: transfer.id,
            transferred_at: new Date().toISOString(),
          })
          .eq('id', row.payment_id);
        if (updErr) throw new Error(`failed to mark payment transferred: ${updErr.message}`);
        transferred++;

        if (!notifiedEvents.has(row.event_id)) {
          notifiedEvents.add(row.event_id);
          const { data: ev } = await admin
            .from('events')
            .select('title, host_id')
            .eq('id', row.event_id)
            .maybeSingle();
          if (ev) {
            const copy = payoutSentCopy(ev.title);
            await notifyUsers(admin, {
              userIds: [ev.host_id],
              type: 'payout_sent',
              title: copy.title,
              body: copy.body,
              url: '/payouts',
              eventId: row.event_id,
              dedupeKey: `payout:${row.event_id}`,
            });
          }
        }
      } catch (err) {
        const code = (err as any)?.code ?? (err as any)?.raw?.code;
        const message = err instanceof Error ? err.message : 'Transfer failed';

        // Insufficient available balance is transient — leave the row untouched so the next hourly run
        // retries once the platform balance / source charge has cleared. Largely prevented by
        // source_transaction, but possible for edge cases (§8.3).
        if (code === 'balance_insufficient') {
          skipped++;
          console.warn(`process-payouts: insufficient balance for payment ${row.payment_id}, will retry`);
          continue;
        }

        // Anything else (destination disabled, or an unexpected Stripe error) → flag it so the job stops
        // re-attempting a doomed transfer, and surface the detail in the logs (Option 2a). Left for a
        // human to clear (UPDATE payments SET payout_failed_reason = NULL) once the host account is fixed.
        //
        // payout_failed_reason is readable by the participant and host under the payments RLS, so it gets
        // a short controlled label — never the raw Stripe/DB message (that stays in the logs above). And
        // if the transfer WAS created but recording it failed, embed the transfer id: the reviewer must
        // reconcile it manually, NOT clear-to-retry — the idempotency key expires after ~24h, after which
        // a retry would create a second transfer and pay the host twice.
        failed++;
        console.error(`process-payouts: transfer failed for payment ${row.payment_id}:`, message);
        const reason = createdTransferId
          ? `transfer_created_unrecorded:${createdTransferId}`
          : `transfer_failed:${code ?? 'stripe_error'}`;
        await admin
          .from('payments')
          .update({ payout_failed_reason: reason })
          .eq('id', row.payment_id);
      }
    }

    return json({ transferred, skipped, failed }, 200);
  } catch (err) {
    console.error('process-payouts error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return json({ code: 'INTERNAL', message }, 500);
  }
});
