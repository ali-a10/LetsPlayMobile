# Stripe Payments — Design Spec

**Status:** Approved design, ready for implementation planning
**Date:** 2026-05-12
**Scope:** Add paid-event payments to LetsPlay (Canadian marketplace, React Native + Expo + Supabase)

---

## 1. Goals & Constraints

**Goal:** Allow participants to pay to join paid events; collect a platform fee; pay hosts out automatically 24h after the event starts.

**Hard constraints:**
- Platform operates in Canada; currency is CAD only (Phase 1).
- Hosts are paid 24h after the event's start time.
- Participant refunds allowed up to 12h before event start; after that, no refunds.
- Host can cancel an event up to 48h before start (auto-refunds everyone); not allowed within 48h.
- Stripe fees and the platform's $0.30 floor for non-refundable Stripe flat fees are absorbed by the platform on refunds.
- No-shows: paying participant does not show up → host still gets paid in full.
- No waitlist.
- Once a paid event is posted, its price is immutable.

**Non-goals (Phase 1):**
- Multi-currency support
- Commission off the host's payout (platform fee currently comes entirely from participant)
- In-app dispute/chargeback workflow (Stripe dashboard only)
- Tax handling (deferred until platform crosses $30k/yr GST/HST threshold)
- IAP routing — events are real-world services, exempt from Apple/Google IAP rules

---

## 2. Fee Model

For a host-set price `P` (in CAD):

| Component | Formula | Example: P = $10.00 |
|---|---|---|
| Stripe processing | 2.9% × P + $0.30 | $0.59 |
| LetsPlay platform fee | 1% × P + $0.20 | $0.30 |
| **Participant pays total** | P + Stripe + LetsPlay | **$10.89** |
| Stripe deducts | 2.9% × P + $0.30 | −$0.59 |
| **Lands in platform balance** | P + LetsPlay fee | **$10.30** |
| Transferred to host (T+24h) | P | $10.00 |
| **LetsPlay net revenue** | LetsPlay fee | **$0.30** |

All amounts stored as integer cents.

---

## 3. Architecture

### 3.1 Payment flow — Separate Charges and Transfers

The participant's charge lands in the platform's Stripe balance. The platform later creates a `transfer` to the host's Connect account (24h after event start). This is the right pattern for delayed payouts in marketplaces.

```
Participant ──pays──> Platform Stripe balance ──24h after event──> Host Connect account
                              │
                              └─ $0.30 platform fee stays here
```

### 3.2 Connect account type

**Stripe Connect Express** for hosts.
- Stripe-hosted onboarding (~3 min form)
- Stripe handles KYC, identity, tax forms
- Platform controls in-app UX
- Hosts get a stripped-down Stripe dashboard for payouts

### 3.3 Backend

All Stripe-touching logic runs in **Supabase Edge Functions** (extends the pattern already used by `delete-account`). The mobile app never sees the Stripe secret key.

### 3.4 Scheduled jobs

Use **`pg_cron`** (already available via Supabase) to invoke an Edge Function hourly. The function queries pending payouts and creates Stripe transfers.

---

## 4. Database Schema

### 4.1 New columns on `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN stripe_account_id TEXT UNIQUE,
  ADD COLUMN stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

`stripe_payouts_enabled` mirrors Stripe's `charges_enabled && payouts_enabled` flag — gates the "create paid event" button.

### 4.2 New table `payments`

```sql
CREATE TYPE payment_status AS ENUM (
  'pending',       -- PaymentIntent created, awaiting confirmation
  'succeeded',     -- Charge confirmed, participant added to event
  'refunded',      -- Refunded back to participant
  'transferred',   -- Host has been paid out
  'failed'         -- PaymentIntent failed or canceled
);

CREATE TABLE payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  host_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  amount_host_cents           INT NOT NULL,    -- host's price
  amount_stripe_fee_cents     INT NOT NULL,    -- 2.9% + 30¢
  amount_platform_fee_cents   INT NOT NULL,    -- 1% + 20¢
  amount_total_cents          INT NOT NULL,    -- total participant charged
  currency                    TEXT NOT NULL DEFAULT 'cad',

  stripe_payment_intent_id    TEXT UNIQUE NOT NULL,
  stripe_charge_id            TEXT,
  stripe_transfer_id          TEXT UNIQUE,
  stripe_refund_id            TEXT,

  status                      payment_status NOT NULL DEFAULT 'pending',
  refunded_at                 TIMESTAMPTZ,
  transferred_at              TIMESTAMPTZ,
  failed_reason               TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: a user can have one active payment per event, but
-- refunded/failed rows don't block them from re-joining if they later change their mind. -Ali: this is so that someone can join, leave, then join again if they get refunded or failed the payment 
CREATE UNIQUE INDEX idx_payments_active_per_user_event
  ON payments (event_id, user_id)
  WHERE status IN ('pending', 'succeeded', 'transferred');


-- Ali: this indexes the status column, on rows where status = 'succeeded'. NOTE this is not unique - it's purely a performance index, since the hourly payout job in 8.2 runs a query every hour, so this makes that job more efficient
CREATE INDEX idx_payments_payout_pending
  ON payments (status)
  WHERE status = 'succeeded';
```

### 4.3 RLS policies on `payments`

- `SELECT`: a user can see rows where `user_id = auth.uid()` OR `host_id = auth.uid()`.
- `INSERT` / `UPDATE` / `DELETE`: blocked for all clients. Only the service-role (Edge Functions) writes to this table.

### 4.4 Changes to existing RPCs

`join_event` keeps working for free events. For paid events, the join path goes through Edge Functions instead of this RPC (see §6.2).

`leave_event` keeps working for free events. For paid events, leaving requires going through the refund Edge Function (see §7.1).

---

## 5. Host Onboarding (Stripe Connect Express)

### 5.1 UX

1. Host taps "Create paid event" or visits Profile → "Payouts".
2. If `stripe_payouts_enabled = false`: show a "Set up payouts" screen with a CTA button.
3. Tapping the CTA calls `create-connect-account` first if `profiles.stripe_account_id` is null (to create the Stripe account shell), then calls `create-connect-account-link` and opens the returned URL in an in-app browser (`expo-web-browser`).
4. Host completes Stripe-hosted onboarding (identity, business info, bank account, SIN).
5. Stripe redirects back to a deep link (`letsplay://payouts-complete`).
6. On returning to the app via deep link, refetch the profile (TanStack Query invalidate on `profile` key). The `account.updated` webhook (see §5.3) will have flipped `stripe_payouts_enabled` before the user lands back; if there's a race (webhook lands milliseconds late), the profile screen shows a "Verifying…" state and a `useEffect`-driven refetch every 2s up to 10s.

### 5.2 Edge Functions

- **`create-connect-account`**: idempotent. If `profiles.stripe_account_id` is null, create a Stripe Express account (country='CA', type='express', email=profile.email). Store the account id on the profile.
<!-- Ali: stripe requires a fresh URL. this will be loaded in the same browser as the previous function, then after this is done (or the user backs out), the user returns to the app
- if the user backs out, we wont need to call create-connect-account, only create-connect-account-link -->
- **`create-connect-account-link`**: creates a Stripe AccountLink with `type='account_onboarding'`, refresh + return URLs to deep links. Returns the URL.
- **`NOTE:`** i have comments in the .md file that don't show in the preview 
- **`ANOTHER NOTE:`** to access the claude chat where i asked about this doc, type /resume and select 'Understand stripe payment design file'


### 5.3 Webhook: `account.updated`

When fired, fetch the account, update `stripe_onboarding_complete` (details_submitted) and `stripe_payouts_enabled` (charges_enabled && payouts_enabled) on the profile. SEE section 9 for more details on the webhook
- **`NOTE:`** i have comments in the .md file that don't show in the preview 
<!-- ALI- what is a webhook: it's a way for one system (stripe in this case) to tell your server "hey, something happened" without your server having to keep asking. so in this case, i give stripe a URL ("when something happens, POST to this URL"). Then Stripe calls you (sends a POST event w/ data) the moment it happens -->


### 5.4 Event creation gate

The "Create event" screen must read `stripe_payouts_enabled` before allowing `is_paid = true`. Show an inline banner: "Set up payouts to create paid events." with a button to onboarding.

---

## 6. Participant Payment Flow

### 6.1 UX

1. Participant taps "Join" on a paid event.
2. Show a confirmation sheet with itemized breakdown (host price, Stripe fee, platform fee, total).
3. Tap "Pay $X.XX" → call `create-payment-intent` → receive `{ clientSecret, paymentIntentId, ephemeralKey, customer }` (see §6.2). The `clientSecret` feeds the Payment Sheet; the `paymentIntentId` is kept by the app to pass to `confirm-payment-join` in step 5.
4. Open Stripe Payment Sheet (`@stripe/stripe-react-native` `usePaymentSheet`).
5. On payment success in the sheet, call `confirm-payment-join`.
6. Backend confirms PaymentIntent status, inserts participant row, updates `current_participants`, marks payment `succeeded`.
7. App refreshes event detail; participant now shown as joined.

### 6.2 Edge Functions

**`create-payment-intent`**:
- Verify event exists, `is_paid = true`, not full, not in the past, user not already a participant.
- Verify user is not blocked-by or blocking the host (existing blocks logic).
- Calculate the four amounts from §2.
- Create Stripe PaymentIntent with:
  - `amount = amount_total_cents`
  - `currency = 'cad'`
  - `customer` (create-or-fetch Stripe customer for the user; store on a `profiles.stripe_customer_id` column we should add)
  - `transfer_group = 'event_<event_id>'`
  - `metadata` = { event_id, user_id, host_id, amount_host_cents }
  - `receipt_email = user.email`
  - `setup_future_usage` is **omitted**, so the Payment Sheet shows a "Save this card for future payments" checkbox; saving is opt-in per purchase. (Setting `'on_session'` would force-save without asking; `'off_session'` is wrong for LetsPlay since we only charge with the user present.)
- Mint a Stripe ephemeral key scoped to the Customer (`stripe.ephemeralKeys.create({ customer })`). This is a short-lived (~60 min), customer-scoped API credential the Payment Sheet uses to fetch the user's saved cards directly from Stripe — the platform's secret key never leaves the Edge Function.
- Insert `payments` row with status `pending`.
- Return `{ clientSecret, paymentIntentId, ephemeralKey, customer }` for the Payment Sheet. `paymentIntentId` is returned explicitly so the app can pass it to `confirm-payment-join` without parsing the clientSecret.
  - **`ALI:`** i think that stripe returns something that has the intent id and the secret in one string, so that's why it says 'without parsing the clientSecret' 


**`confirm-payment-join`**:
- Receive `payment_intent_id`.
- Fetch PI from Stripe; verify status `succeeded` and metadata matches DB row.
- In a transaction:
  - Insert into `participants`.
  - Increment `events.current_participants`.
  - Update payment: status `succeeded`, store `stripe_charge_id`.
- Idempotent on `(event_id, user_id, payment_intent_id)`.

### 6.3 Profile addition

```sql
ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT UNIQUE;
```
- **ALI**: this is different than stripe_account_id in 4.1. Stripe uses 'Connect account' for the sellers/hosts, this is what stripe_account_id is for. And Stripe uses 'customer' for a buyer/participant, this is what stripe_customer_id is for. 
  - this is stored so returning participants see their saved cards and billing email instead of re-typing every time.  
  - the cards and billing email are stored on Stripe's servers

### 6.4 Webhook: `payment_intent.succeeded`

Safety net only — if the client crashes between Payment Sheet success and `confirm-payment-join`, this webhook still finalizes the join. Logic is the same idempotent flow as `confirm-payment-join`.
  - **ALI**: this says safety net only because the happy path is still the app calling `confirm-payment-join` above, but this webhook is used if the app creashed, or phone loses connection, etc. **IMPORTANT**: this is idempotent, because the normal path is that `confirm-payment-join` runs at T+0.1s, then this webhook arrives at T+0.5s and tries to run the same logic again. but the `(event_id, user_id, payment_intent_id)` check from the last bullet point in 6.2 makes the second run not do anything

### 6.5 Webhook: `payment_intent.payment_failed`

Mark the `payments` row `failed`, store `failed_reason`. No participant row was inserted.

> **Note:** Unlike §6.4, this is **not** a safety net — it's the **only** path. `confirm-payment-join` is never called on failure (the app only calls it after the Payment Sheet reports success), so this webhook is the sole mechanism for recording a failed payment in the DB.

### 6.6 Race & edge cases

- **Event fills during checkout**: `confirm-payment-join` runs the capacity check again; if full, refund immediately (full refund — platform eats the $0.30 Stripe flat fee per §1).
- **User leaves Payment Sheet without paying**: PI stays as `requires_payment_method` / `canceled`; nothing happens. PaymentIntents auto-expire after 24h.
- **Duplicate join attempts**: partial unique index on `payments` prevents two `pending`/`succeeded` rows for the same `(event_id, user_id)`.

---

## 7. Refund Flows

### 7.1 Participant cancels their spot

UX: "Cancel my spot" button on event detail, only shown when user is joined and event is paid.

**Edge Function `refund-participant`**:
- Lookup the `payments` row for `(event_id, auth.uid())` with status `succeeded`.
- If event start − now < 12 hours: reject with `REFUND_WINDOW_CLOSED`.
- Else: Stripe Refund API with full amount (`amount_total_cents`). Stripe refunds the 2.9% but keeps the $0.30 flat fee — platform absorbs that.
- In a transaction:
  - Remove from `participants`.
  - Decrement `current_participants`.
  - Update payment: status `refunded`, store `stripe_refund_id`, set `refunded_at`.

### 7.2 Host cancels event

UX: "Cancel event" button on event detail, only visible to host when event is paid and >48h before start.

**Edge Function `cancel-event`**:
- Verify caller is host. Verify event is paid. Verify event start − now ≥ 48 hours.
- Mark event as cancelled (add an `events.cancelled_at` column).
- Loop all `payments` for event with status `succeeded`:
  - Issue Stripe refund (full amount).
  - Update payment row, decrement participants.
- Atomicity: if any refund fails, log to a `failed_refunds` table for manual handling but proceed with the others.

### 7.3 Schema additions for cancellations

```sql
ALTER TABLE events ADD COLUMN cancelled_at TIMESTAMPTZ;
CREATE INDEX idx_events_cancelled ON events (cancelled_at) WHERE cancelled_at IS NOT NULL;
```

Cancelled events:
- Hidden from search/feed
- Visible to participants who joined (with a "Cancelled" banner) for 7 days, then archived
- Excluded from payout job

### 7.4 Webhook: `charge.refunded`

Safety net — confirms the refund actually completed. If a `payments` row is marked `refunded` but Stripe says it didn't refund (e.g., async failure), flag it for review.

---

## 8. Delayed Payouts

### 8.1 Schedule

`pg_cron` job runs every hour:
```sql
SELECT cron.schedule('process-payouts', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/process-payouts',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')
  );
$$);
```

> **Summary:** Two Postgres extensions cooperate here. **`pg_cron`** registers a recurring job named `process-payouts` on the schedule `'0 * * * *'` (minute 0 of every hour → fires at 00:00, 01:00, 02:00…). On each tick it executes the dollar-quoted (`$$ … $$`) SQL block, which calls **`pg_net`**'s `net.http_post` to fire an async HTTP POST at the `process-payouts` Edge Function. The `Authorization: Bearer <service-role-key>` header tells the function "this is a privileged internal call, bypass RLS." The Edge Function then does the actual payout work in §8.2. The whole schedule lives inside the database — no external cron service needed.

### 8.2 Edge Function `process-payouts`

For each `payments` row where:
- `status = 'succeeded'`
- `transferred_at IS NULL`
- Event's start time + 24h ≤ NOW()
- Event's `cancelled_at IS NULL`

Create a Stripe Transfer:
- `amount = amount_host_cents`
- `currency = 'cad'`
- `destination = host.stripe_account_id`
- `transfer_group = 'event_<event_id>'`
- `metadata = { payment_id, event_id }`

These fields are sent to Stripe via `stripe.transfers.create(...)`. Stripe performs the actual money movement and returns a `Transfer` object; the Edge Function uses `transfer.id` from that response in the next step.

Mark payment `transferred`, store `stripe_transfer_id` and `transferred_at`.

Idempotency: enforced by `stripe_transfer_id UNIQUE` and a guard query before transfer creation.

### 8.3 Webhook: `transfer.paid` / `transfer.failed`

**`transfer.paid`** — no-op. The `payments` row was already updated to `transferred` in §8.2 using the synchronous response from `stripe.transfers.create()`, so this webhook just confirms what's already true. The slot exists in the handler so the webhook router doesn't error on the event and so we can react to it later if needed (e.g., notifying the host their payout settled).

**`transfer.failed`** — flag for review; do not retry automatically (usually indicates the host's Connect account got disabled or had `transfers_enabled` flipped off). This is the **sole detection path** for transfer failures, not a safety net: `stripe.transfers.create()` returns synchronously with `status: 'pending'` even when the underlying ledger move later fails. The actual failure is reported asynchronously — sometimes within seconds, sometimes longer — long after the Edge Function call has ended, so this webhook is the only channel through which failure information arrives. (Note: this fires on the Stripe-internal ledger move from platform balance to the host's Connect balance, not on the separate bank payout — bank-rail failures are reported as `payout.*` events on the Connect account itself and are outside this spec's scope.)

---

## 9. Webhooks Summary

Single Edge Function `stripe-webhook` routes events:

| Event | Action |
|---|---|
| `account.updated` | Refresh host's payout-enabled flags on profile |
| `payment_intent.succeeded` | Idempotent finalize-join (safety net) |
| `payment_intent.payment_failed` | Mark payment row failed |
| `charge.refunded` | Confirm refund completed |
| `transfer.paid` | No-op |
| `transfer.failed` | Flag for review |

All handlers verify the Stripe signature with `STRIPE_WEBHOOK_SECRET` from Edge Function env.

---

## 10. Mobile App Changes

### 10.1 New dependencies

- `@stripe/stripe-react-native` (Expo-compatible via config plugin)
- `expo-web-browser` (already in Expo SDK; used for Connect onboarding redirect)

### 10.2 Screens / components

- `app/(tabs)/profile/payouts.tsx` — host payouts screen (onboarding CTA or earnings list)
- `components/payments/PaymentBreakdown.tsx` — itemized fee display
- `components/payments/JoinPaidEventSheet.tsx` — confirmation + pay action
- Modify `app/event/[id].tsx`:
  - For paid events: replace direct join with paid-join flow
  - Add "Cancel my spot" (refund) for participants
  - Add "Cancel event" (auto-refund all) for hosts (gated on ≥48h before start)
- Modify `app/create-event.tsx`:
  - Block `is_paid = true` selection when `stripe_payouts_enabled = false`, show banner + CTA
- Modify event list/feed queries (search, home, profile):
  - Filter out `cancelled_at IS NOT NULL` events from public feed
  - Show cancelled events only on event detail (with "Cancelled" banner) for participants who had joined, and only for 7 days after cancellation

### 10.3 Hooks

- `lib/hooks/useStripePayouts.ts` — fetch payout status, trigger onboarding
- `lib/hooks/usePayPaidEvent.ts` — orchestrate PaymentSheet + confirm-join
- `lib/hooks/useRefundParticipant.ts`
- `lib/hooks/useCancelEvent.ts`

### 10.4 Stripe key

Publishable key (`pk_test_...` / `pk_live_...`) added to `.env.local` and `app.config.ts` extras. Never the secret key.

---

## 11. Implementation Phases

Each phase is independently testable and shippable behind a feature flag (`paid_events_enabled` boolean read from a remote config or hardcoded constant during dev).

- **Phase A — Host onboarding** (Connect Express + profile state). Behind flag.
- **Phase B — Participant payment** (PaymentSheet + payments table + webhook).
- **Phase C — Refunds** (participant cancel + host cancel event).
- **Phase D — Delayed payouts** (pg_cron + process-payouts function).
- **Phase E — Polish** (payouts screen, payment history, receipts).

---

## 12. Testing Strategy

### 12.1 Stripe test mode

- All Phase A–E development against test mode keys.
- Use Stripe test cards (`4242 4242 4242 4242` etc.).
- Use Stripe CLI's `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook` for local webhook testing.

### 12.2 Test scenarios

| Scenario | Expected |
|---|---|
| Host with no Stripe account creates paid event | Blocked, banner shown |
| Host completes onboarding | `stripe_payouts_enabled` flips to true |
| Participant pays for event | Joined, payment row created, charge in platform balance |
| Event fills during checkout | Refund issued, user notified |
| Participant cancels 13h before start | Refund issued |
| Participant cancels 11h before start | Blocked |
| Host cancels 49h before start | All participants refunded |
| Host cancels 47h before start | Blocked |
| 24h after event start | Payout job transfers funds to host |
| Host's bank rejects transfer | Flagged for review |
| Webhook arrives twice | Idempotent, no double-action |

### 12.3 Go-live checklist (separate from this spec; tracked at release time)

- Switch to live keys
- Real bank account verified on platform Stripe
- Terms of Service + Privacy Policy published
- Stripe Connect Platform Profile completed
- Real Canadian business documentation submitted to Stripe

---

## 13. Open questions deferred to later phases

- GST/HST registration once approaching $30k threshold
- Commission off host payouts (currently 0%)
- In-app dispute response workflow
- Multi-currency
- Apple Pay / Google Pay (Stripe Payment Sheet supports these out of the box; can enable later with negligible code change)
