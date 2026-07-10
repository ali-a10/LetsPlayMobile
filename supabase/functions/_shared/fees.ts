export interface FeeBreakdown {
  amount_host_cents: number;
  amount_platform_fee_cents: number;
  amount_stripe_fee_cents: number;
  amount_total_cents: number;
}

/**
 * Computes the four payment amounts (host price, platform fee, Stripe-fee estimate, total charged)
 * from a host price in integer cents, per spec §2. This is the authoritative server-side computation;
 * the mobile preview must match it exactly.
 */
export function computeFees(priceCents: number): FeeBreakdown {
  const P = priceCents;
  // F = 1% × P + $0.20
  const platformFee = Math.round(P * 0.01) + 20;
  // T = (P + F + $0.30) ÷ (1 − 0.029), rounded UP so rounding always favors the platform by ≤1¢
  const total = Math.ceil((P + platformFee + 30) / (1 - 0.029));
  // Stripe estimate = 2.9% × T + $0.30 (domestic-card estimate; actual fee lives on the balance transaction)
  const stripeFee = Math.round(total * 0.029) + 30;
  return {
    amount_host_cents: P,
    amount_platform_fee_cents: platformFee,
    amount_stripe_fee_cents: stripeFee,
    amount_total_cents: total,
  };
}
