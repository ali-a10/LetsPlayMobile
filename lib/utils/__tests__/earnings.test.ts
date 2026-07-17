import { buildEarningsSummary, EarningsPayment } from '../earnings';

/** Builds a minimal EarningsPayment row with overridable fields for test cases. */
function row(overrides: Partial<EarningsPayment> = {}): EarningsPayment {
  return {
    event_id: 'e1',
    amount_host_cents: 1000,
    status: 'succeeded',
    disputed_at: null,
    payout_failed_reason: null,
    events: { title: 'Sunday Soccer', date: '2026-07-01T18:00:00Z', payout_held_at: null },
    ...overrides,
  };
}

describe('buildEarningsSummary', () => {
  it('returns zero totals and no events for an empty list', () => {
    const s = buildEarningsSummary([]);
    expect(s).toEqual({ totalPaidCents: 0, totalPendingCents: 0, totalHeldCents: 0, events: [] });
  });

  it('classifies a transferred payment as paid', () => {
    const s = buildEarningsSummary([row({ status: 'transferred' })]);
    expect(s.totalPaidCents).toBe(1000);
    expect(s.events[0].status).toBe('paid');
    expect(s.events[0].netCents).toBe(1000);
  });

  it('classifies a succeeded payment as pending', () => {
    const s = buildEarningsSummary([row()]);
    expect(s.totalPendingCents).toBe(1000);
    expect(s.events[0].status).toBe('pending');
  });

  it('classifies a disputed payment as held', () => {
    const s = buildEarningsSummary([row({ disputed_at: '2026-07-02T00:00:00Z' })]);
    expect(s.totalHeldCents).toBe(1000);
    expect(s.events[0].status).toBe('held');
  });

  it('classifies a payout-failed payment as held', () => {
    const s = buildEarningsSummary([row({ payout_failed_reason: 'transfer_failed:x' })]);
    expect(s.totalHeldCents).toBe(1000);
    expect(s.events[0].status).toBe('held');
  });

  it('classifies a transferred payment that was later reversed as held, not paid', () => {
    // A transfer reversal sets payout_failed_reason but leaves status = 'transferred';
    // the flag must win over the transferred=paid classification.
    const s = buildEarningsSummary([
      row({ status: 'transferred', payout_failed_reason: 'transfer_failed:x' }),
    ]);
    expect(s.totalHeldCents).toBe(1000);
    expect(s.totalPaidCents).toBe(0);
    expect(s.events[0].status).toBe('held');
  });

  it('classifies payments on a payout-held event as held', () => {
    const s = buildEarningsSummary([
      row({ events: { title: 'T', date: '2026-07-01T18:00:00Z', payout_held_at: '2026-07-01T20:00:00Z' } }),
    ]);
    expect(s.events[0].status).toBe('held');
  });

  it('sums mixed payments per event and applies held > pending > paid precedence', () => {
    const s = buildEarningsSummary([
      row({ status: 'transferred', amount_host_cents: 500 }),
      row({ amount_host_cents: 300 }),
      row({ amount_host_cents: 200, disputed_at: '2026-07-02T00:00:00Z' }),
    ]);
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({
      paidCents: 500, pendingCents: 300, heldCents: 200, netCents: 1000, status: 'held',
    });
  });

  it('groups by event and sorts events newest-first', () => {
    const s = buildEarningsSummary([
      row({ event_id: 'old', events: { title: 'Old', date: '2026-06-01T18:00:00Z', payout_held_at: null } }),
      row({ event_id: 'new', events: { title: 'New', date: '2026-07-01T18:00:00Z', payout_held_at: null } }),
    ]);
    expect(s.events.map((e) => e.eventId)).toEqual(['new', 'old']);
  });

  it('ignores rows with statuses other than succeeded/transferred (defensive)', () => {
    const s = buildEarningsSummary([row({ status: 'refunded' })]);
    expect(s).toEqual({ totalPaidCents: 0, totalPendingCents: 0, totalHeldCents: 0, events: [] });
  });

  it('tolerates a missing events join with placeholder title/date', () => {
    const s = buildEarningsSummary([row({ events: null })]);
    expect(s.events[0].title).toBe('Event');
    expect(s.events[0].status).toBe('pending');
  });
});
