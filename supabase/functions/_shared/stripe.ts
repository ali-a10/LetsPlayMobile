import Stripe from 'stripe';

/** The Stripe API version this backend pins. Reused for ephemeral keys so the mobile Payment Sheet matches. */
export const STRIPE_API_VERSION = '2024-06-20';

/** Shared Stripe client for Edge Functions; reads the secret key from env and uses Deno's fetch HTTP client. */
export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: STRIPE_API_VERSION,
  httpClient: Stripe.createFetchHttpClient(),
});
