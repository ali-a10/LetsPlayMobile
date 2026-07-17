import { Payment } from '../types/database';

/** How a host's money for one payment/event is currently disposed. */
export type EarningStatus = 'paid' | 'pending' | 'held';

/** The subset of a payments row (plus its event join) that earnings math needs. */
export type EarningsPayment = Pick<
  Payment,
  'event_id' | 'amount_host_cents' | 'status' | 'disputed_at' | 'payout_failed_reason'
> & {
  events: { title: string; date: string; payout_held_at: string | null } | null;
};

/** A host's aggregated earnings for a single event. */
export type EventEarnings = {
  eventId: string;
  title: string;
  date: string;
  paidCents: number;
  pendingCents: number;
  heldCents: number;
  netCents: number;
  status: EarningStatus;
};

/** A host's total earnings picture across all their paid events. */
export type EarningsSummary = {
  totalPaidCents: number;
  totalPendingCents: number;
  totalHeldCents: number;
  events: EventEarnings[];
};

/** Classifies one payment row into the paid/pending/held bucket its host-share currently sits in. */
function classify(p: EarningsPayment): EarningStatus | null {
  // Only succeeded (not yet paid out) and transferred (paid out) money is the host's; refunded/failed/pending never reaches them.
  if (p.status !== 'transferred' && p.status !== 'succeeded') return null;
  // A hold flag wins over the paid/pending split — e.g. a reversed transfer keeps status='transferred' but sets payout_failed_reason.
  if (p.disputed_at || p.payout_failed_reason || p.events?.payout_held_at) return 'held';
  return p.status === 'transferred' ? 'paid' : 'pending';
}

/**
 * Groups a host's payment rows by event and computes per-event and overall
 * paid/pending/held totals, events sorted newest-first. Pure — no I/O.
 */
export function buildEarningsSummary(payments: EarningsPayment[]): EarningsSummary {
  const byEvent = new Map<string, EventEarnings>();

  for (const p of payments) {
    const bucket = classify(p);
    if (!bucket) continue;

    let entry = byEvent.get(p.event_id);
    if (!entry) {
      entry = {
        eventId: p.event_id,
        title: p.events?.title ?? 'Event',
        date: p.events?.date ?? '',
        paidCents: 0,
        pendingCents: 0,
        heldCents: 0,
        netCents: 0,
        status: 'paid',
      };
      byEvent.set(p.event_id, entry);
    }

    if (bucket === 'paid') entry.paidCents += p.amount_host_cents;
    else if (bucket === 'pending') entry.pendingCents += p.amount_host_cents;
    else entry.heldCents += p.amount_host_cents;
    entry.netCents += p.amount_host_cents;
  }

  const events = [...byEvent.values()]
    .map((e) => ({
      ...e,
      // Precedence: any held money needs attention; else any pending; else fully paid.
      status: (e.heldCents > 0 ? 'held' : e.pendingCents > 0 ? 'pending' : 'paid') as EarningStatus,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    totalPaidCents: events.reduce((s, e) => s + e.paidCents, 0),
    totalPendingCents: events.reduce((s, e) => s + e.pendingCents, 0),
    totalHeldCents: events.reduce((s, e) => s + e.heldCents, 0),
    events,
  };
}
