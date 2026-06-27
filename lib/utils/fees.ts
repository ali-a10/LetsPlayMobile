export interface FeeBreakdown {
  amount_host_cents: number;
  amount_platform_fee_cents: number;
  amount_stripe_fee_cents: number;
  amount_total_cents: number;
}

/**
 * Computes the four payment amounts (host price, platform fee, Stripe-fee estimate, total charged)
 * from a host price in integer cents, per spec §2. PREVIEW ONLY — the server recomputes
 * authoritatively in create-payment-intent; this must match supabase/functions/_shared/fees.ts exactly.
 */
export function computeFees(priceCents: number): FeeBreakdown {
  const P = priceCents;
  const platformFee = Math.round(P * 0.01) + 20;                 // F = 1% × P + $0.20
  const total = Math.ceil((P + platformFee + 30) / (1 - 0.029)); // T = (P+F+$0.30) ÷ (1−2.9%), rounded up
  const stripeFee = Math.round(total * 0.029) + 30;              // 2.9% × T + $0.30 (estimate)
  return {
    amount_host_cents: P,
    amount_platform_fee_cents: platformFee,
    amount_stripe_fee_cents: stripeFee,
    amount_total_cents: total,
  };
}

/** Formats integer cents as a CAD dollar string (1092 → "$10.92"). */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
