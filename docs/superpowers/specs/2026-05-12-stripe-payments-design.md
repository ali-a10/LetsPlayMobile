# Stripe Payments — Design Spec

**Status:** Approved design, ready for implementation planning
**Date:** 2026-05-12
**Scope:** Add paid-event payments to LetsPlay (Canadian marketplace, React Native + Expo + Supabase)

---

## 1. Goals & Constraints

**Goal:** Allow participants to pay to join paid events; collect a platform fee; pay hosts out automatically 24h after the event starts.

**Hard constraints:**
- Platform operates in Canada; currency is CAD only (Phase 1).
- Hosts are paid 26h after the event's start time — the 24h host-no-show report window (§7.5) plus a 2h buffer so a last-minute report can never race the payout job.
- Participant refunds allowed up to 12h before event start; after that, no refunds.
- Host can cancel an event up to 12h before start (auto-refunds everyone); not allowed within 12h. Cancellations in the 48h–12h band are allowed but tracked as **late cancellations** — derived from existing columns (`event start − cancelled_at < 48h`), no extra flag column.
- **All time-window comparisons are computed server-side in SQL against `now()`, never in client or Edge-Function JS.** Every deadline in this spec — the 12h refund/leave cutoff (§4.6, §7.1), the 48h late-cancellation boundary (§7.2), and the 26h payout delay (§8.2) — is `event.date ± interval 'N hours' vs now()`. `events.date` is `timestamptz`, so SQL math is zone-correct everywhere; doing it in JS would inherit the device's (or server's) timezone and give two users different deadlines for the same event.
- Stripe keeps the **entire** original processing fee on refunds (the 2.9% *and* the $0.30 — [Stripe refund policy](https://support.stripe.com/questions/understanding-fees-for-refunded-payments)). Who bears it depends on who triggered the refund:
  - **Participant self-cancellation** (§7.1): partial refund of `amount_total_cents − amount_stripe_fee_cents` — the participant bears the Stripe fee, the platform breaks even out of pocket (it forfeits its own platform fee by refunding it).
  - **Host cancellation and platform-initiated refunds** (§7.2, event-full §6.6, cancelled-event slip-through §6.2, host no-show): 100% refund — the platform absorbs the Stripe fee (~$0.62 per $10 event).
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

> **Why a gross-up formula:** Stripe charges 2.9% of the **total amount charged**, not 2.9% of `P`. If we naively charged `P + (2.9%×P + $0.30) + fee`, Stripe's actual cut (2.9% of the bigger total) would exceed what we collected for it, and the platform would silently eat ~3¢ per $10 transaction. Solving `T − (2.9%×T + $0.30) = P + F` for `T` gives the formula below.

| Component | Formula | Example: P = $10.00 |
|---|---|---|
| LetsPlay platform fee `F` | 1% × P + $0.20 | $0.30 |
| **Participant pays total `T`** | (P + F + $0.30) ÷ (1 − 0.029), rounded **up** to the cent | **$10.92** |
| Stripe deducts | 2.9% × T + $0.30 | −$0.62 |
| **Lands in platform balance** | P + F (± rounding) | **$10.30** |
| Transferred to host (T+26h) | P | $10.00 |
| **LetsPlay net revenue** | F | **$0.30** |

All amounts stored as integer cents. Round `T` up so any rounding error favors the platform by ≤1¢, never against it.

> **Note — the Stripe fee column is an estimate:** Stripe Canada adds +0.8% for international cards and more for currency conversion. `amount_stripe_fee_cents` records the *domestic-card estimate* used to price the charge; the actual fee lives on the charge's balance transaction. Phase 1 accepts this drift (platform absorbs the difference on international cards).

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

> **CORRECTION:** see §5.3 — this formula holds only while the `card_payments` capability stays active; otherwise gate on `payouts_enabled` + `transfers` capability instead.

### 4.2 New table `payments`

```sql
CREATE TYPE payment_status AS ENUM (
  'pending',       -- PaymentIntent created, awaiting confirmation
  'succeeded',     -- Charge confirmed, participant added to event
  'refunded',      -- Refunded back to participant
  'transferred',   -- Host has been paid out
  'failed'         -- PaymentIntent failed or canceled
);
```

**Legal status transitions:**

```
pending     → succeeded   (confirm-payment-join / payment_intent.succeeded webhook)
pending     → failed      (payment_intent.payment_failed webhook, §6.5)
failed      → succeeded   (card declined, user retries on the SAME PI, §6.2)
succeeded   → refunded    (participant cancel §7.1, host cancel §7.2, event-full §6.6,
                           cancelled-event slip-through §6.2, no-show confirmed §7.5)
succeeded   → transferred (payout job, §8.2)
transferred → refunded    (post-payout reversal — see below)
```

- **`transferred → refunded` is legal but rare.** It represents a payment that was paid out to the host and *then* unwound — driven by the dispute / `transfer.reversed` path (§8.2–§8.3), e.g. a card chargeback that lands days after payout. Unlike every other refund, it requires **both** a Stripe refund on the charge **and** a transfer reversal on the host's Connect account (clawing the money back) — a plain refund alone would leave the platform out of pocket. Handled manually in Phase 1 per the §1 dispute non-goal; without this state the row would be stuck at `transferred`, falsely reporting the host as paid.
- **No-show never reaches `transferred`.** The §7.5 `payout_held_at` hold blocks the payout job indefinitely until the investigation clears, and payout only happens at start + 26h — so a no-show is always resolved while the payment is still `succeeded`. No-show resolution is therefore `succeeded → refunded`, **not** `transferred → refunded`.

```sql
CREATE TABLE payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  host_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,

  amount_host_cents           INT NOT NULL,    -- host's price
  amount_stripe_fee_cents     INT NOT NULL,    -- 2.9% × total + 30¢ (domestic-card estimate, see §2)
  amount_platform_fee_cents   INT NOT NULL,    -- 1% + 20¢
  amount_total_cents          INT NOT NULL,    -- total participant charged
  currency                    TEXT NOT NULL DEFAULT 'cad',

  stripe_payment_intent_id    TEXT UNIQUE NOT NULL,
  stripe_charge_id            TEXT UNIQUE,     -- one charge = one payment; UNIQUE blocks a webhook replay linking it to two rows
  stripe_transfer_id          TEXT UNIQUE,
  stripe_refund_id            TEXT UNIQUE,

  status                      payment_status NOT NULL DEFAULT 'pending',
  refunded_at                 TIMESTAMPTZ,
  transferred_at              TIMESTAMPTZ,
  disputed_at                 TIMESTAMPTZ,    -- set by charge.dispute.created webhook; holds the payment out of the payout job (§8.2)
  failed_reason               TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- bumped on every UPDATE by a BEFORE UPDATE trigger; "last touched" for a financial ledger (CRA ~6yr retention, §4.5)

  -- value guards: no negative money, total covers host + platform fee, CAD-only (Phase 1)
  CONSTRAINT amounts_non_negative CHECK (
    amount_host_cents >= 0
    AND amount_stripe_fee_cents >= 0
    AND amount_platform_fee_cents >= 0
    AND amount_total_cents >= 0
  ),
  CONSTRAINT total_covers_host_plus_platform CHECK (
    amount_total_cents >= amount_host_cents + amount_platform_fee_cents
  ),
  CONSTRAINT currency_cad_only CHECK (currency = 'cad')
);

-- updated_at bumped on every row change:
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();   -- standard "SET NEW.updated_at = NOW()" helper

-- Partial unique index: a user can have one active payment per event, but
-- refunded/failed rows don't block them from re-joining if they later change their mind. -Ali: this is so that someone can join, leave, then join again if they get refunded or failed the payment 
CREATE UNIQUE INDEX idx_payments_active_per_user_event
  ON payments (event_id, user_id)
  WHERE status IN ('pending', 'succeeded', 'transferred');


-- Performance index for the hourly payout job (§8.2). NOT unique.
-- Indexes event_id (the column the job joins on to check the event's time window /
-- cancelled_at / payout_held_at), and the partial predicate matches the job's
-- "still needs payout" definition exactly: succeeded, not yet transferred, not disputed.
-- This keeps the index tiny (only genuinely payout-eligible rows) and also covers the
-- disputed_at filter. (An earlier draft indexed (status) WHERE status='succeeded' — useless,
-- since every key in that index is the identical value 'succeeded', so it can't seek.)
CREATE INDEX idx_payments_payout_pending
  ON payments (event_id)
  WHERE status = 'succeeded' AND transferred_at IS NULL AND disputed_at IS NULL;
```

### 4.3 RLS policies on `payments`

- `SELECT`: a user can see rows where `user_id = auth.uid()` OR `host_id = auth.uid()`.
- `INSERT` / `UPDATE` / `DELETE`: blocked for all clients. Only the service-role (Edge Functions) writes to this table.

> **Host visibility is column-scoped via a view (built with the §10.2 earnings screen).** The `host_id = auth.uid()` clause grants the host the *whole row* — including the participant's raw Stripe handles (`stripe_payment_intent_id`, `stripe_charge_id`, `stripe_refund_id`, `stripe_transfer_id`), the full fee breakdown (`amount_stripe_fee_cents`, `amount_platform_fee_cents`), and `failed_reason` — none of which the host needs. A host should see only *that* a participant paid and *what the host will receive*. The host-facing earnings screen reads a column-subset view (e.g. `host_event_payments` selecting `event_id, user_id, amount_host_cents, status, created_at`), not the raw table. Participants keep full visibility of their **own** rows. Not a launch blocker (data only ever reaches the event's own host, never the public), so it's documented here and built when the §10.2 earnings screen lands — the only feature that needs host-side payment visibility.

### 4.4 The existing `events.price` column

`events` already has `is_paid BOOLEAN` and `price` (bare numeric — dollars). Three things to pin down so it plugs into the integer-cents world of this spec:

1. **Migrate to `price_cents INT`.** Floating-point dollars are exactly what the "integer cents" rule exists to avoid. No real paid events exist yet — this is the cheapest moment to do it. See **Migration order** below.

2. **Bounds — tied to `is_paid`.** A plain `price_cents IS NULL OR (… BETWEEN 100 AND 50000)` would still allow a paid event with a NULL price, which the fee math (§2) and `create-payment-intent` (§6.2) would then compute against NULL (NULL/failed/$0 charge). Use a cross-column CHECK so *paid ⟺ has-price* is impossible to violate at the DB level:

   ```sql
   CHECK (
     (is_paid = false AND price_cents IS NULL)
     OR
     (is_paid = true  AND price_cents BETWEEN 100 AND 50000)
   )
   ```

   Min $1.00 (Stripe rejects CAD charges under $0.50; $1 keeps margin), max $500.00. Free events store `price_cents = NULL` (never `0`) — the create flow must write NULL for free events. Also enforced in `create-payment-intent`; the create screen validates too, but client validation isn't enforcement.

3. **Immutability — from the moment the event is created.** Per `cancellationAndRefund.md`, everything except title and description is locked after creation. Enforce at the DB: a trigger rejects any UPDATE that changes `sport`, `price_cents`, `is_paid`, `date`, `location`, `latitude`, `longitude`, or `max_participants` (simple `OLD` vs `NEW` comparison, no payments lookup). The edit screen already locks these fields — the trigger enforces it without trusting the client; `date` is the one that matters financially, since shifting it would move the 12h refund cutoff, the 48h late-cancellation boundary, and the 26h payout time. Immutable-from-insert rather than "once payments exist" — simpler trigger, and it closes the race where a host changes a field while a participant is mid-checkout. A host who typos the price deletes and reposts the event.
   - **Use `IS DISTINCT FROM`, not `<>`, for every comparison.** `latitude` and `longitude` are nullable, and `<>` against NULL evaluates to NULL (not TRUE) — so a `NULL → value` or `value → NULL` change on coordinates would silently pass the trigger and slip through, defeating the lock. `OLD.col IS DISTINCT FROM NEW.col` is NULL-safe (TRUE for NULL↔value and value↔different-value, FALSE only when genuinely equal incl. both NULL). Use it for all locked columns so there's one rule and no per-column reasoning.
   - **The trigger fires `BEFORE UPDATE` only — never on INSERT** — so the create-event path can set these fields, and the §7.2/§7.5 writes to the *non-locked* columns (`cancelled_at`, `payout_held_at`, `current_participants`) still pass.

**Migration order.** The `events` table is emptied of test data first — as a **manual one-off in the SQL editor, not in the committed migration** (a blanket `DELETE` baked into a migration would wipe real data if it ever ran against production later). Because `participants.event_id` is a foreign key to `events`, clear the child rows first: `DELETE FROM participants;` then `DELETE FROM events;` (no `payments` rows exist yet). With the table empty there's nothing to backfill and no `ROUND(price*100)` step. The migration is then purely structural and order-independent: add `price_cents INT`, add the bounds CHECK (step 2), drop `price`, create the `BEFORE UPDATE` immutability trigger, update `lib/types/database.ts`.

### 4.5 Account deletion interplay (`delete-account`)

The existing `delete-account` Edge Function hard-deletes participants → hosted events → profile → auth user. The `ON DELETE RESTRICT` FKs on `payments` are intentional — financial records must outlive accounts (CRA expects business records kept ~6 years) — but they mean `delete-account` will throw a 500 for anyone with payment history unless it's updated:

1. **Block deletion while money is in motion.** Refuse (with a clear message in the app) while the user:
   - hosts any upcoming, non-cancelled paid event (deleting would vaporize the event and everyone's money with no refund — account deletion must not bypass §7), or
   - has payments awaiting payout (`succeeded`, not yet `transferred`).

   The host's path to deletion is: cancel their paid events (normal §7.2 refund loop runs), wait for pending payouts, then delete.

   **The guard and the anonymize/delete must run in a single transaction** (cleanest as one `SECURITY DEFINER` RPC the Edge Function calls). If the check is a separate statement from the mutation, a payment created in between — e.g. a participant's `confirm-payment-join` landing while the host is mid-deletion — slips past the guard and leaves money in motion against a deleted/anonymized host. Lock the rows the check reads (`SELECT … FOR UPDATE` on the host's upcoming events / the rows a concurrent `confirm-payment-join` would touch) so a payment can't be inserted between the check and the commit; if one appears mid-transaction, the whole thing rolls back and deletion is safely refused.

2. **Anonymize instead of delete for users with payment history.** Keep the profile row so `payments` FKs stay intact, but scrub every personal field; delete the auth user as today. The books still say "someone paid $10.92 on March 3rd" — they just no longer say who. Users with zero payment rows keep the current full-delete path.

   The scrub must respect the columns' NOT NULL and UNIQUE constraints (a naive "set everything to NULL" throws — `first_name`, `last_name`, `email`, `phone`, `date_of_birth`, `gender` are all NOT NULL; `email`, `stripe_customer_id`, `stripe_account_id` are UNIQUE):

   - **NOT NULL text PII** (`first_name`, `last_name`, `phone`, `date_of_birth`, `gender`) → non-null sentinels, e.g. `first_name='deleted'`, `last_name='user'`, `phone=''`, `gender='unspecified'`, `date_of_birth='1900-01-01'` (each must satisfy its column's type/format).
   - **`email`** (NOT NULL *and* UNIQUE → can't be NULL, can't be a shared constant) → per-row unique sentinel: `email = 'deleted+' || id || '@deleted.invalid'`.
   - **`stripe_customer_id`, `stripe_account_id`** (UNIQUE, nullable) → **set to NULL.** Multiple NULLs are fine past a UNIQUE constraint, and NULLing removes a re-identification vector (a live `stripe_customer_id` could be looked up in Stripe to recover the name/email we just scrubbed). The financial trail lives on `payments` (`stripe_*_id` columns) + Stripe's own objects, and §4.5 step 1 guarantees no payout still needs `stripe_account_id` by the time we anonymize — so nothing is lost.
   - **Stripe account flags** (`stripe_onboarding_complete`, `stripe_payouts_enabled`) → `FALSE`.
   - **Nullable PII** (`avatar_url`, `about_me`, `favourite_sports`) → NULL.

### 4.6 Changes to existing RPCs

`join_event` keeps working for free events. For paid events, the join path goes through Edge Functions instead of this RPC (see §6.2).

`leave_event` keeps working for free events, **with two new rules**:

1. (per `cancellationAndRefund.md`) reject if `event start − now < 12 hours` — same window as the paid refund cutoff, so the rule is one sentence everywhere: *nobody un-joins an event inside 12 hours*. UI mirrors the paid flow: cancel-spot button disabled inside 12h, and a within-12h join confirmation states "you won't be able to cancel this spot."
2. **reject if `user_id = host_id`** (error `HOST_CANNOT_LEAVE`). The host is an auto-participant in their own event (§6.2), but a host leaving isn't a "leave" — it's a cancellation. Without this guard, `leave_event` would delete the host's participant row and decrement `current_participants` *without cancelling the event*, leaving a live event the host has silently dropped out of and bypassing the §7.2 refund loop, 12h gate, and late-cancellation tracking. The host's only exit is the §7.2 cancel-event flow.

For paid events, leaving requires going through the refund Edge Function (see §7.1).

> Note: the `leave_event` change alters an existing live feature (free leave currently works at any time), so it ships as its own small migration + UI pass, independent of the Stripe phases.

### 4.7 TypeScript type updates (`lib/types/database.ts`)

`database.ts` is **hand-maintained, not generated**, so it drifts from the schema unless every migration in this spec is paired with its type edit in the same change. The complete set of edits this spec requires (a single checklist to work against):

- **`profiles`** (across `Row` / `Insert` / `Update`) — add `stripe_account_id: string | null`, `stripe_onboarding_complete: boolean`, `stripe_payouts_enabled: boolean` (§4.1), and `stripe_customer_id: string | null` (§6.3).
- **`events`** — **drop** `price`; **add** `price_cents: number | null` (§4.4), `cancelled_at: string | null`, `payout_held_at: string | null` (§7.3).
- **New `payments` table** type (`Row` / `Insert` / `Update`) + a `payment_status` union type matching the enum (§4.2).
- **New `failed_refunds` table** type (§4.8).
- **New `stripe_events` table** type (§9 webhook dedup).
- **`host_event_payments` view** — read-only Row type for the host earnings query (§4.3 / §10.2).

(A future `payment_status_history` table is deferred — see §13.)

### 4.8 Table `failed_refunds`

Written whenever a Stripe refund throws — the host-cancel loop (§7.2), and any other refund site. The cancel loop proceeds with the remaining refunds and records each failure here so no participant's money is silently stranded.

```sql
CREATE TABLE failed_refunds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  event_id      UUID NOT NULL REFERENCES events(id)   ON DELETE RESTRICT,
  error_message TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,                          -- set by the operator when cleared (§7.6)
  resolved_by   UUID REFERENCES profiles(id)
);

-- The operator's discovery query reads unresolved rows; index keeps it cheap.
CREATE INDEX idx_failed_refunds_unresolved
  ON failed_refunds (created_at)
  WHERE resolved_at IS NULL;
```

RLS: service-role writes only; no client access (it's operator-facing). Recovery is **manual in Phase 1** — see the runbook in §7.6.

---

## 5. Host Onboarding (Stripe Connect Express)

### 5.1 UX

1. Host taps "Create paid event" or visits Profile → "Payouts".
2. If `stripe_payouts_enabled = false`: show a "Set up payouts" screen with a CTA button.
   - **CORRECTION:** `stripe_payouts_enabled = false` is not one state but two, and the Payouts screen must distinguish them — otherwise a host who already completed onboarding but still owes identity verification is dropped back on the full "Set up payouts" screen and thinks their work was discarded. Stripe's onboarding link only renders requirements that are *currently due* when it opens; the identity document/selfie step is frequently generated **reactively** after the host submits their basic info (Stripe couldn't verify them from data alone), so it cannot appear in the first session and forces a second trip. The screen therefore branches on **both** flags:
     - `stripe_payouts_enabled` → "You're all set."
     - `stripe_onboarding_complete && !stripe_payouts_enabled` (Stripe's `details_submitted` true, payouts not yet enabled) → an **"Almost there — Continue verification"** state whose CTA re-mints an AccountLink and reopens Stripe at the now-due verification step.
     - neither → first-time "Set up payouts."

     This state can't be skipped: whether verification is required at all is *conditional* (a host whose typed info verifies cleanly finishes in one pass), but some real hosts always hit it, so it must be handled. Setting the AccountLink's `collection_options.fields = 'eventually_due'` front-loads *some* requirements into the first session but **cannot guarantee** a single pass, because reactively-generated document requirements don't exist at link-creation time.
3. Tapping the CTA calls `create-connect-account` first if `profiles.stripe_account_id` is null (to create the Stripe account shell), then calls `create-connect-account-link` and opens the returned URL in an in-app browser (`expo-web-browser`).
   - **CORRECTION:** opened with `expo-web-browser`'s `openBrowserAsync` (a plain in-app browser the user closes manually), not the auto-closing `openAuthSessionAsync` — see step 6 for why.
4. Host completes Stripe-hosted onboarding (identity, business info, bank account, SIN).
5. Stripe redirects back to a deep link (`letsplay://payouts-complete`).
   - **CORRECTION:** Stripe redirects to an **https** return URL (`https://letsplayapp.ca/payouts-complete`), not a custom scheme. Stripe rejects `letsplay://` ("not a valid URL"), so the return URL must be http(s).
6. On returning to the app via deep link, refetch the profile (TanStack Query invalidate on `profile` key). The `account.updated` webhook (see §5.3) will have flipped `stripe_payouts_enabled` before the user lands back; if there's a race (webhook lands milliseconds late), the profile screen shows a "Verifying…" state and **polls via TanStack Query's `refetchInterval`** on `['profile', userId]` (every ~2s, stop once `stripe_payouts_enabled` flips true or after a ~10s cap) — preferred over a hand-rolled `useEffect` loop: less custom code, automatic cleanup, same effect.
   - **CORRECTION:** because Stripe returns to an https page (not a custom scheme), there is **no automatic deep-link return** in Expo Go: the user closes the in-app browser manually, and the Payouts screen refetches profile / `['payouts', userId]`. The "Verifying…" poll (~2s, ~10s cap) still covers webhook lag. A *seamless* auto-return (browser self-closes and lands the user back on the screen) requires **Universal Links / App Links** on `letsplayapp.ca` plus an EAS dev build — deferred to Phase B/polish.

### 5.2 Edge Functions

- **`create-connect-account`**: idempotent. If `profiles.stripe_account_id` is null, create a Stripe Express account (country='CA', type='express', email=profile.email). Store the account id on the profile.
<!-- Ali: stripe requires a fresh URL. this will be loaded in the same browser as the previous function, then after this is done (or the user backs out), the user returns to the app
- if the user backs out, we wont need to call create-connect-account, only create-connect-account-link -->
- **`create-connect-account-link`**: creates a Stripe AccountLink with `type='account_onboarding'`, refresh + return URLs to deep links. Returns the URL.
  - **CORRECTION:** `refresh_url` + `return_url` must be **https** (`https://letsplayapp.ca/payouts-complete`), not deep links — Stripe rejects custom app schemes (`letsplay://`) with "not a valid URL".
- **`NOTE:`** i have comments in the .md file that don't show in the preview 
- **`ANOTHER NOTE:`** to access the claude chat where i asked about this doc, type /resume and select 'Understand stripe payment design file'


### 5.3 Webhook: `account.updated`

When fired, fetch the account, update `stripe_onboarding_complete` (details_submitted) and `stripe_payouts_enabled` (charges_enabled && payouts_enabled) on the profile. SEE section 9 for more details on the webhook
- **CORRECTION:** the `charges_enabled && payouts_enabled` formula only works because we request the `card_payments` capability (§5.2) and it activates on full verification. Hosts never charge cards (separate charges & transfers), so `charges_enabled` isn't truly required for them — if `card_payments` ever stops activating, this formula would stay false forever and lock out valid hosts. If that happens, switch the gate to `payouts_enabled && capabilities.transfers === 'active'`.
- **`NOTE:`** i have comments in the .md file that don't show in the preview 
<!-- ALI- what is a webhook: it's a way for one system (stripe in this case) to tell your server "hey, something happened" without your server having to keep asking. so in this case, i give stripe a URL ("when something happens, POST to this URL"). Then Stripe calls you (sends a POST event w/ data) the moment it happens -->


### 5.4 Event creation gate

The "Create event" screen must read `stripe_payouts_enabled` before allowing `is_paid = true`. Show an inline banner: "Set up payouts to create paid events." with a button to onboarding.

---

## 6. Participant Payment Flow

### 6.1 UX

1. Participant taps "Join" on a paid event.
2. Show a confirmation sheet with itemized breakdown (host price, Stripe fee, platform fee, total).
3. Tap "Pay $X.XX" → call `create-payment-intent`, which returns a **discriminated union** (see §6.2), not always a clientSecret:
   - `{ kind: 'new' | 'reused', clientSecret, paymentIntentId, ephemeralKey, customer }` → open the Payment Sheet. (`new` vs `reused` is for logging only; client handling is identical. `reused` = an existing `pending` PI was reopened, per the §6.2 lookup.) The `clientSecret` feeds the sheet; `paymentIntentId` is kept to pass to `confirm-payment-join` in step 5.
   - `{ kind: 'already_joined' }` → **treat as success, not an error**: skip the sheet, refetch the event/participation, show "you're in." This is the common double-tap / return-after-webhook case (the user already became a participant, possibly via the §6.4 webhook, so §6.2's "not already a participant" check means no clientSecret can be issued). Surfacing it as a failure would show a scary "payment failed" toast to someone who already paid and joined.
4. Open Stripe Payment Sheet (`@stripe/stripe-react-native` `usePaymentSheet`).
5. On payment success in the sheet, call `confirm-payment-join`.
6. Backend confirms PaymentIntent status, inserts participant row, updates `current_participants`, marks payment `succeeded`.
7. App refreshes event detail; participant now shown as joined.

> This happy path is one branch of a resumable saga — steps 3–5 can be interrupted (sheet cancelled, app backgrounded, crash) after the card is charged but before step 5 runs, in which case the §6.4 webhook finalizes the join asynchronously. See §10.3 (`usePayPaidEvent`) for the state-machine contract: discrete states, a persisted PI that resumes on re-entry, and **server (not hook) state as the source of truth for "did I join."**

### 6.2 Edge Functions

**`create-payment-intent`**:
- Verify event exists, `is_paid = true`, not full, not in the past, user not already a participant.
  - The already-a-participant check is also what guarantees a host can never pay for their own event: hosts are auto-participants in their own events per `cancellationAndRefund.md`. Load-bearing — don't relax it.
  - If the user **is** already a participant, return `{ kind: 'already_joined' }` (a success branch, not an error) — see the response contract below. This is the double-tap / return-after-webhook case.
- Verify user is not blocked-by or blocking the host (existing blocks logic).
- **Pending-row lookup**: check for an existing `payments` row for `(event_id, user_id)` with status `pending` (e.g., the user opened the Payment Sheet earlier and backed out — see §6.6):
  - If found and its PI is still usable (`requires_payment_method` / `requires_confirmation`): return that PI's `clientSecret` — reopen the sheet on the same intent instead of creating a duplicate (which would violate the partial unique index).
  - If found but the PI is canceled/unusable: cancel it on Stripe for hygiene, mark the row `failed`, and continue below with a fresh PI + row.
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
- Insert `payments` row with status `pending` — but **conflict-aware**, never a bare INSERT. A concurrent attempt (two rapid "Join" taps, or the "mark old row `failed` → insert fresh" branch above racing a §6.4 webhook that just flipped the old row to `succeeded`) can leave an active row in place, and a plain insert would trip `idx_payments_active_per_user_event` and bubble up as a 500 on what should be a smooth retry. Use:

  ```sql
  INSERT INTO payments (...) VALUES (...)
  ON CONFLICT (event_id, user_id) WHERE status IN ('pending','succeeded','transferred')
  DO NOTHING
  RETURNING *;
  ```

  (The `WHERE` clause must repeat the partial unique index's predicate exactly — that's how `ON CONFLICT` targets a partial index.) If the insert returns **no row** (conflict hit), re-fetch the existing active row and reuse its PI — the same "reuse the pending PI" resolution as the lookup above. Net: a duplicate/concurrent attempt always resolves to "reuse the one active payment," never an error.
- Return a **discriminated union**, not always a clientSecret, so the client can branch without treating expected states as errors:

  ```ts
  | { kind: 'new';           clientSecret; paymentIntentId; ephemeralKey; customer }   // fresh PI + row
  | { kind: 'reused';        clientSecret; paymentIntentId; ephemeralKey; customer }   // reopened an existing pending PI
  | { kind: 'already_joined' }                                                         // user is already a participant — no PI
  ```

  `new`/`reused` carry the Payment Sheet payload (`paymentIntentId` is returned explicitly so the app passes it to `confirm-payment-join` without parsing the clientSecret). `already_joined` is returned by the "not already a participant" check above instead of erroring — the client maps it to success (skip sheet, refetch, "you're in"), per §6.1 step 3.
  - **`ALI:`** i think that stripe returns something that has the intent id and the secret in one string, so that's why it says 'without parsing the clientSecret' 


**`confirm-payment-join`**:
- Receive `payment_intent_id`.
- Verify the caller: `auth.uid()` must match the payment row's `user_id` (skip when invoked from the webhook path, which is service-role) — otherwise any authenticated user who learns someone else's PI id could trigger the finalize.
- Fetch PI from Stripe; verify status `succeeded` and metadata matches DB row.
- Verify the event's `cancelled_at IS NULL` — the host may have cancelled while the user was inside the Payment Sheet; the §7.2 refund loop only covers already-`succeeded` payments, so this one would slip through. If cancelled: refund immediately instead of joining (same pattern as the event-full case in §6.6).
- Then call the shared finalize function (see below) to do the transactional join.
- Idempotent on `(event_id, user_id, payment_intent_id)`.
- The status transition `failed → succeeded` is **legal** for the same PI: a declined card marks the row `failed` via §6.5, but the user is still in the Payment Sheet and can retry with another card on the same PI — don't treat `failed` as terminal.

> **Shared finalize logic — one implementation, two callers.** The "finish the join" work is needed by *both* `confirm-payment-join` (happy path) and the `payment_intent.succeeded` webhook (§6.4, crash-recovery safety net). Writing it twice guarantees the two copies drift apart over time — a fix added to one path silently skips the other, and the gap only surfaces in the rare crash case that's hardest to test. So implement it **once as a Postgres function `finalize_paid_join(payment_intent_id)`** that both Edge Functions invoke. It runs in a single transaction:
> - `SELECT … FOR UPDATE` the events row, then re-check capacity — a plain re-read isn't race-safe when two payments finalize concurrently for the last spot (both checks pass before either insert); the row lock makes the second transaction wait and see the updated count. If full: refund (§6.6).
> - Insert into `participants`.
> - Increment `events.current_participants`.
> - Update payment: status `succeeded`, store `stripe_charge_id`.
> - Idempotent on `(event_id, user_id, payment_intent_id)` so a second call (webhook after the app already finalized) is a no-op.
>
> Keeping the whole transaction inside one Postgres function means the lock + insert + increment + update can't be split across round-trips. (Shared *TypeScript* boilerplate that doesn't belong in SQL — CORS, auth, Stripe client setup — should live in a new `supabase/functions/_shared/` directory; **not created yet**, established when Phase B implementation starts.)

### 6.3 Profile addition

```sql
ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT UNIQUE;
```
- **ALI**: this is different than stripe_account_id in 4.1. Stripe uses 'Connect account' for the sellers/hosts, this is what stripe_account_id is for. And Stripe uses 'customer' for a buyer/participant, this is what stripe_customer_id is for. 
  - this is stored so returning participants see their saved cards and billing email instead of re-typing every time.  
  - the cards and billing email are stored on Stripe's servers

### 6.4 Webhook: `payment_intent.succeeded`

Safety net only — if the client crashes between Payment Sheet success and `confirm-payment-join`, this webhook still finalizes the join. It calls the **same `finalize_paid_join(payment_intent_id)` Postgres function** as `confirm-payment-join` (§6.2) — one shared implementation, so the two paths can never drift apart — and relies on that function's idempotency so a duplicate finalize is a no-op.
  - **ALI**: this says safety net only because the happy path is still the app calling `confirm-payment-join` above, but this webhook is used if the app creashed, or phone loses connection, etc. **IMPORTANT**: this is idempotent, because the normal path is that `confirm-payment-join` runs at T+0.1s, then this webhook arrives at T+0.5s and tries to run the same logic again. but the `(event_id, user_id, payment_intent_id)` check from the last bullet point in 6.2 makes the second run not do anything

### 6.5 Webhook: `payment_intent.payment_failed`

Mark the `payments` row `failed`, store `failed_reason`. No participant row was inserted.

> **Note:** Unlike §6.4, this is **not** a safety net — it's the **only** path. `confirm-payment-join` is never called on failure (the app only calls it after the Payment Sheet reports success), so this webhook is the sole mechanism for recording a failed payment in the DB.

### 6.6 Race & edge cases

- **Event fills during checkout**: `confirm-payment-join` runs the capacity check again; if full, refund immediately (full refund — platform eats the $0.30 Stripe flat fee per §1).
- **User leaves Payment Sheet without paying**: the PI stays in `requires_payment_method` **indefinitely** — unconfirmed PaymentIntents do *not* auto-expire (that's Checkout Sessions; the ~7-day expiry is for authorized holds). The `payments` row stays `pending`, and since `pending` counts as active in the partial unique index (§4.2), a naive re-join attempt would hit a unique violation and lock the user out of the event forever. Handled by the pending-row lookup in `create-payment-intent` (§6.2): the retry reuses the same PI instead of inserting a new row.
- **Duplicate join attempts**: partial unique index on `payments` prevents two `pending`/`succeeded` rows for the same `(event_id, user_id)`.

---

## 7. Refund Flows

### 7.1 Participant cancels their spot

UX: "Cancel my spot" button on event detail, only shown when user is joined and event is paid.

**Edge Function `refund-participant`**:
- Lookup the `payments` row for `(event_id, auth.uid())` with status `succeeded`.
- If event start − now < 12 hours: reject with `REFUND_WINDOW_CLOSED`.
- Else: Stripe Refund API with **partial amount `amount_total_cents − amount_stripe_fee_cents`** (the participant bears the Stripe fee; the platform fee is refunded — see §1), with idempotency key `refund_<payment_id>`. Example: $10.00 event → paid $10.92 → refunded $10.30.
  - The deducted amount is the *domestic-card estimate* from §2 — for an international card Stripe actually kept more (+0.8%); the platform absorbs that sliver rather than computing exact per-card fees (same Phase-1 stance as the §2 estimate note).
  - User-facing copy: "payment processing fees are non-refundable" (shown at checkout alongside the 12-hour rule).
- In a transaction:
  - Remove from `participants`.
  - Decrement `current_participants`.
  - Update payment: status `refunded`, store `stripe_refund_id`, set `refunded_at`.

### 7.2 Host cancels event

Applies to **free and paid events** (per `cancellationAndRefund.md`) — same flow, the refund loop just only runs when there's money.

UX: "Cancel event" button on event detail, only visible to host, enabled until 12h before start.
- **Paid event, start − now < 48h**: show the late-cancellation warning first (verbatim from the cancellation policy): *"This is a late cancellation. All participants will be refunded in full. Late cancellations are tracked and repeated ones may pause your hosting. Continue?"*
- **Free event**: plain confirm ("Cancel this event for all participants?") — no late-cancellation warning; the refund sentence would be nonsense and there's no money to protect.

**Edge Function `cancel-event`**:
- Verify caller is host. Verify event start − now ≥ 12 hours.
- Mark event as cancelled (add an `events.cancelled_at` column). Late cancellations (48h–12h band) need no extra flag — derivable as `event start − cancelled_at < 48h`, which can't drift out of sync with the data. (Tracked for paid events only, per policy.)
- **If `is_paid`**: loop all `payments` for event with status `succeeded`:
  - Issue Stripe refund (full amount).
  - Update payment row, decrement participants.
- Atomicity: if any refund fails, insert a row into `failed_refunds` (§4.8) and **proceed with the others** — one bad refund must not abort the rest. Recovery is a manual operator procedure (Phase 1), defined as a named deliverable in **§7.6**.
- Push notification to all participants that the event was cancelled (free and paid).

### 7.3 Schema additions for cancellations

```sql
ALTER TABLE events ADD COLUMN cancelled_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN payout_held_at TIMESTAMPTZ;  -- set when a host no-show report is filed (§7.5); payout job skips events where this is set

-- Serves the public feed's hot query (useEvents.ts): date >= now() + ORDER BY date,
-- restricted to non-cancelled rows. NOT an index on cancelled rows — an earlier draft
-- indexed WHERE cancelled_at IS NOT NULL, the opposite half, which the feed never reads.
CREATE INDEX idx_events_active_by_date ON events (date) WHERE cancelled_at IS NULL;
```

Cancelled events:
- Hidden from search/feed
- Visible to participants who joined (with a "Cancelled" banner) for 7 days, then archived
- Excluded from payout job

### 7.4 Webhook: `charge.refunded`

Safety net — confirms the refund actually completed. If a `payments` row is marked `refunded` but Stripe says it didn't refund (e.g., async failure), flag it for review.

### 7.5 Host no-show reports

Policy source: `cancellationAndRefund.md`. Participants can report a host no-show within **24h of event start**; payout is held during investigation; a confirmed no-show means full refunds and no payout.

- **Automatic hold**: when any participant files a "Host no-show" report (existing report-user modal), set `events.payout_held_at = NOW()` immediately — the investigation is manual (Phase 1: personally contacting participants and the host), but the hold cannot afford to wait for a human.
- **No race with the payout job**: the job (§8.2) only pays out at start + **26h** (24h report window + 2h buffer ≥ one cron cycle), and skips events where `payout_held_at IS NOT NULL`. A report filed at hour 23:59 can never lose to a cron tick.
- **Resolution (manual in Phase 1)**:
  - *No-show confirmed*: refund all `succeeded` payments in full (platform-initiated → 100%, §1); leave `payout_held_at` set — once all payments are `refunded` the event has nothing left to pay out.
  - *Host cleared*: clear `payout_held_at`; the next hourly run pays out normally.
- **Abuse note**: one tap by a malicious participant holds the entire event's payout. Phase-1 mitigation is prompt manual review of every report; future releases can require corroboration from multiple participants or rate-limit reports per user.

### 7.6 Manual refund-recovery runbook (Phase 1 deliverable)

When a refund throws (host-cancel loop §7.2, or any platform-initiated refund), the failure is recorded in `failed_refunds` (§4.8) and **a human clears it by following this procedure**. Phase 1 does not auto-retry refunds — but "manual" means *this defined procedure*, not undocumented ad-hoc fixing. This runbook is a shipped artifact (committed alongside the spec / in the ops docs), not just a note.

**Safety net that makes manual handling safe:** every refund uses idempotency key `refund_<payment_id>`, so re-running a refund that actually already succeeded returns the original refund instead of paying twice. An operator cannot make things worse by retrying.

**1. Discover.** Run the unresolved-rows query (backed by `idx_failed_refunds_unresolved`):
```sql
SELECT * FROM failed_refunds WHERE resolved_at IS NULL ORDER BY created_at;
```
Ideally this is surfaced by an alert on insert (see §12 / F29 observability) so it isn't dependent on remembering to check.

**2. Triage.** Join back to the real-world context — who, how much, which charge, and why it failed:
```sql
SELECT fr.id, fr.error_message, p.id AS payment_id, p.stripe_charge_id,
       p.amount_total_cents, prof.email, e.title
FROM failed_refunds fr
JOIN payments p    ON p.id = fr.payment_id
JOIN profiles prof ON prof.id = p.user_id
JOIN events e      ON e.id = fr.event_id
WHERE fr.resolved_at IS NULL;
```
Read `error_message` to pick the path: *"charge already refunded"* → reconcile only (step 4); *"insufficient funds"* → transient, retry later; *"charge is disputed"* → **do not refund** (the dispute process moves the money — just mark resolved with a note).

**3. Act.** Re-issue the refund — either re-invoke the refund Edge Function (idempotency key protects you) or, in the Stripe Dashboard, find the charge by `stripe_charge_id` and refund the **full amount** (host-cancel and platform-initiated refunds are 100%, §1).

**4. Reconcile + notify** (or the DB misrepresents reality):
- `payments` row → `status='refunded'`, set `stripe_refund_id`, `refunded_at`.
- Decrement `events.current_participants` if the cancel loop didn't already (it may have failed mid-way — check before decrementing so you don't double-count).
- `failed_refunds` row → `resolved_at=NOW()`, `resolved_by=<operator profile id>`.
- Send the participant a refund-confirmation notification (the cancellation push already fired; this closes the loop).

---

## 8. Delayed Payouts

### 8.1 Schedule

**Prerequisites (must exist before the `cron.schedule` call, or it silently never fires):**
1. **Enable the extensions** — `pg_cron` and `pg_net` (Supabase dashboard → Database → Extensions, or `CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;`). Without them `cron.schedule` / `net.http_post` don't resolve.
2. **Store the service-role key in Vault once** under the name `service_role_key`: `SELECT vault.create_secret('<service-role-key>', 'service_role_key');`. The Vault read below assumes this already exists. Do this **manually/out-of-band, not in a committed migration** — same reasoning as the key-in-git concern in the note below.

Then the `pg_cron` job runs every hour:
```sql
SELECT cron.schedule('process-payouts', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/process-payouts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  );
$$);
```

> **Why Vault instead of pasting the key:** the SQL passed to `cron.schedule` is stored verbatim in the `cron.job` table, so a hardcoded service-role key (which bypasses all RLS) would sit readable in a DB table and land in git history via the migration file. Storing it in Supabase **Vault** and reading it at runtime keeps the key out of both.

> **Summary:** Two Postgres extensions cooperate here. **`pg_cron`** registers a recurring job named `process-payouts` on the schedule `'0 * * * *'` (minute 0 of every hour → fires at 00:00, 01:00, 02:00…). On each tick it executes the dollar-quoted (`$$ … $$`) SQL block, which calls **`pg_net`**'s `net.http_post` to fire an async HTTP POST at the `process-payouts` Edge Function. The `Authorization: Bearer <service-role-key>` header tells the function "this is a privileged internal call, bypass RLS." The Edge Function then does the actual payout work in §8.2. The whole schedule lives inside the database — no external cron service needed.

### 8.2 Edge Function `process-payouts`

**Caller verification (first thing the function does).** Unlike user-facing functions, `process-payouts` takes no per-user auth and just pays out everything due — so it's only safe if *only the cron* can invoke it. But the function sits at a public URL; a leaked URL would otherwise let anyone force money movement on demand (there's no "you can only affect your own data" backstop here, because it's designed to affect all hosts' payouts). The cron already sends the service-role key in the `Authorization: Bearer` header (§8.1); the function must **verify that header matches the service-role key (or a dedicated shared secret) and reject everything else** — a normal user JWT or an unauthenticated request gets `403`, never a payout run.

For each `payments` row where:
- `status = 'succeeded'`
- `transferred_at IS NULL`
- `disputed_at IS NULL` — a chargeback already pulled this money (plus a $15 fee) back out of the platform balance, so paying the host would be a double loss; if the dispute is won, clear `disputed_at` and the next hourly run pays out normally
- Event's start time + 26h ≤ NOW() — 24h host-no-show report window + 2h buffer (§7.5)
- Event's `cancelled_at IS NULL`
- Event's `payout_held_at IS NULL` — held while a host no-show report is under investigation (§7.5)

Create a Stripe Transfer:
- `amount = amount_host_cents`
- `currency = 'cad'`
- `destination = host.stripe_account_id`
- `source_transaction = stripe_charge_id` — ties the transfer to the original charge. Transfers can normally only spend the platform's *available* balance (card funds take ~2 business days to clear in Canada), so without this, payouts for events booked <2 days before payout time would throw "Insufficient Funds" at start+24h. With it, the transfer always succeeds at +24h; the funds just stay *pending* in the host's Connect balance until the original charge clears.
- `transfer_group = 'event_<event_id>'`
- `metadata = { payment_id, event_id }`

These fields are sent to Stripe via `stripe.transfers.create(...)` with **idempotency key `transfer_<payment_id>`**. Stripe performs the actual money movement and returns a `Transfer` object; the Edge Function uses `transfer.id` from that response in the next step.

> **Payout timing nuance:** for charges made <2 business days before payout time (last-minute joins), the transferred funds sit as *pending* in the host's Connect balance until the original charge clears (1–2 business days), which pushes back the bank payout by the same amount. Charges older than that are unaffected — for them everything behaves exactly as scheduled. Either way the host's bank deposit is governed by their Connect payout schedule (default daily sweep of available balance), so multiple per-participant transfers still typically arrive as one deposit.

Mark payment `transferred`, store `stripe_transfer_id` and `transferred_at`.

Idempotency: three layers — (1) guard query before transfer creation, (2) `stripe_transfer_id UNIQUE`, and (3) the Stripe idempotency key. The key covers the case the first two can't: the function crashes *after* `transfers.create()` succeeds but *before* the DB row is updated — without the key, the next hourly run would re-create the transfer and pay the host twice; with it, Stripe returns the original transfer instead.

### 8.3 Transfer failure handling

> **Correction (2026-06-12):** `transfer.paid` and `transfer.failed` **do not exist** in the current Stripe API — they are legacy pre-2017 event names from when Transfers and Payouts were a single object (see [Stripe event types](https://docs.stripe.com/api/events/types); the only transfer events today are `transfer.created`, `transfer.updated`, `transfer.reversed`). In the modern API a platform→Connect transfer fails **synchronously**: `stripe.transfers.create()` throws (e.g., "Insufficient Funds", or the destination account is disabled/restricted) and no Transfer object is created.

**Synchronous error handling in `process-payouts`** — this is the actual failure-detection path:
- **Insufficient available balance**: leave the payment row as `succeeded` (untouched); the hourly job naturally retries next run. Largely prevented by `source_transaction` (§8.2).
- **Destination account disabled / transfers not allowed**: record the error on the payment row (`failed_reason`), flag for manual review, and skip on subsequent runs until cleared — don't retry blindly every hour.
- Any other Stripe error: log, flag, continue with the remaining payouts (one bad host must not block the whole batch).

**Webhook `transfer.reversed`** — fires if a transfer is later reversed (e.g., manually from the dashboard, or to claw back funds after a dispute). Flag the payment row for review.

(Bank-rail failures — host's bank rejecting the deposit — surface as `payout.failed` on the Connect account itself, outside this spec's scope. Stripe retries those and emails the host to fix their bank details.)

---

## 9. Webhooks Summary

Single Edge Function `stripe-webhook` routes events:

| Event | Action |
|---|---|
| `account.updated` | Refresh host's payout-enabled flags on profile |
| `payment_intent.succeeded` | Idempotent finalize-join (safety net) |
| `payment_intent.payment_failed` | Mark payment row failed |
| `charge.refunded` | Confirm refund completed |
| `charge.dispute.created` | Set `disputed_at` on the payment row, flag for manual review — payout job holds it (§8.2); dispute itself is handled in the Stripe dashboard per §1 non-goals |
| `transfer.reversed` | Flag payment row for review (see §8.3) |

All handlers verify the Stripe signature with `STRIPE_WEBHOOK_SECRET` from Edge Function env.

All handlers must be idempotent against **duplicate and out-of-order delivery** — Stripe guarantees neither. §6.4 already relies on this for `payment_intent.succeeded`; treat it as a blanket rule for every event the router handles. Two mechanisms enforce it across *all* handlers, not just the ones with a convenient natural key:

**1. Dedup table kills duplicates.** Stripe may deliver the same event twice (e.g. it didn't hear our `200`, so it retries). Every Stripe event carries a unique id (`evt_...`); the router's **first** action is to record it, and if it's already recorded, reply `200` and stop — like a bouncer crossing names off a guest list.

```sql
CREATE TABLE stripe_events (
  id           TEXT PRIMARY KEY,       -- the Stripe event id (evt_...)
  type         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,   -- event.created from Stripe
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Router step 1 on every event:
```sql
INSERT INTO stripe_events (id, type, created_at) VALUES ($1, $2, $3)
ON CONFLICT (id) DO NOTHING;
-- if 0 rows inserted → already processed → return 200 and skip the handler
```
Service-role writes only; no client access. This gives every handler exactly-once processing for free, including `account.updated` and `charge.refunded` which have no other unique key to dedup on.

**2. "Refresh from source" kills out-of-order.** The dedup table can't help with ordering (two different events have two different ids). Stripe can deliver an older event *after* a newer one — so a handler that blindly applies the message payload could move state backward (a stale `account.updated` re-disabling a host who actually finished onboarding). **Rule: any handler that can, re-fetches the current state from Stripe instead of trusting the event payload.** §5.3's `account.updated` already does this (it fetches the live account and copies `charges_enabled && payouts_enabled`), so a stale event just triggers a re-read of the truth and can't regress. Only handlers applying a genuine one-way transition (e.g. `payment_intent.payment_failed`) rely on the dedup table + their own guards instead.

---

## 10. Mobile App Changes

### 10.1 New dependencies

- `@stripe/stripe-react-native` (Expo-compatible via config plugin)
- `expo-web-browser` (already in Expo SDK; used for Connect onboarding redirect)

> **`@stripe/stripe-react-native` is a native module — Phase B onward will not run in Expo Go.** The project currently runs in Expo Go (per CLAUDE.md); from Phase B you need an **EAS dev build** to test on device/simulator. Phase 0 and Phase A's non-Stripe UI can still use Expo Go, but plan the dev-build switch (and any CI implications) before Phase B.

### 10.2 Screens / components

- `app/payouts.tsx` — host payouts screen (onboarding CTA or earnings list). A root-level pushed stack screen opened from the profile tab, matching the existing convention (`app/delete-account.tsx`, `app/edit-profile.tsx`) — **not** `app/(tabs)/profile/payouts.tsx`, which would force `profile.tsx` into a nested directory route for no benefit.
- `components/payments/PaymentBreakdown.tsx` — itemized fee display
- `components/payments/JoinPaidEventSheet.tsx` — confirmation + pay action
- Modify `app/event/[id].tsx`:
  - For paid events: replace direct join with paid-join flow
  - Add "Cancel my spot" (refund) for participants
  - Add "Cancel event" (auto-refund all) for hosts — enabled until 12h before start; 48h–12h band shows the late-cancellation warning first (§7.2)
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

**Cache invalidation** (reuse the existing key shapes — see `useJoinEvent`/`useLeaveEvent`). Each mutation must invalidate the lists its change affects, or screens go stale (paid join shows old spot count, cancelled event still listed as live):

| Hook | Invalidates |
|---|---|
| `usePayPaidEvent` (paid join) | `['event', eventId]`, `['events']`, `['my-joined-events', userId]`, `['userStats', userId]` (same set as `useJoinEvent`) |
| `useRefundParticipant` (paid leave) | `['event', eventId]`, `['events']`, `['my-joined-events', userId]`, `['userStats', userId]` (same set as `useLeaveEvent`) |
| `useCancelEvent` (host cancels) | `['event', eventId]`, `['events']`, `['my-hosted-events', userId]`, `['my-joined-events', userId]`, `['userStats', userId]` |
| `useStripePayouts` (start onboarding mutation) | `['profile', userId]` (the `stripe_payouts_enabled` flag lives on the profile) |

**New server-state namespaces** — all Stripe-derived data is *server state*, so it lives in TanStack Query, **never in Zustand** (Zustand is UI-only here, e.g. filters):
- `['payouts', userId]` — onboarding / payout status (read by `useStripePayouts` as a `useQuery`; the hook is a query + a mutation, not one combined call).
- `['payments', eventId]` — host earnings list (the §4.3 `host_event_payments` view).

> **`usePayPaidEvent` is a saga, not a one-shot mutation.** Unlike `useJoinEvent`/`useLeaveEvent` (one RPC → invalidate → done), the paid join is a multi-step, partly-on-device, user-interruptible flow: `create-payment-intent` (network) → Stripe Payment Sheet (native UI, the user can cancel or background the app) → `confirm-payment-join` (network). The middle step can succeed (card charged) while the third never runs — backgrounded app, dropped network, crash — leaving money taken but the join recorded only later by the §6.4 `payment_intent.succeeded` webhook. The hook contract must reflect that:
> - **Discrete states**, not a boolean: `idle | creating-intent | sheet-open | confirming | joined | failed`.
> - **Persist `clientSecret` / `paymentIntentId` across re-render and screen re-entry**, so a user returning after a crash/background resumes the *same* pending PI (reusing the §6.2 pending-row lookup) rather than starting a second charge.
> - **The server is the source of truth for "did I join", never the hook's in-memory state.** The hook's terminal signal is a TanStack Query refetch of the event/participation (§10.3 cache keys), because the webhook may finalize a join the hook never observed. The UI always reconciles to server state.

### 10.4 Stripe key & provider wiring

Matches the repo's existing conventions (the project uses **`app.json`**, not `app.config.ts`, and reads env via `process.env.EXPO_PUBLIC_*` directly — see `lib/supabase.ts`):

- **Publishable key** (`pk_test_...` / `pk_live_...`, never the secret key) → add to `.env.local` as `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, read via `process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Test key in dev; swapped to the live key at go-live (§12.3).
- **Config plugin** → register `@stripe/stripe-react-native` in `app.json`'s `plugins` array.
- **Provider** → wrap the app in `<StripeProvider publishableKey={...}>` in `app/_layout.tsx`, alongside the existing `QueryProvider`.

---

## 11. Implementation Phases

Each phase is independently testable and shippable behind a feature flag (`paid_events_enabled` boolean read from a remote config or hardcoded constant during dev) — **except Phase 0, which ships flag-independent.**

- **Phase 0 — Leave-event 12h rule** (§4.6). The one change in this spec that alters a live free-events feature (today, leaving works at any time) and that must ship **even with `paid_events_enabled` off** — it is a free-events rule, not a paid-events one. Its own small migration (`leave_event` rejects when `event start − now < 12h`) + UI pass (cancel-spot button disabled inside 12h, within-12h join confirmation). **Not gated by the feature flag.** Prerequisite the Stripe phases build on.
- **Phase A — Host onboarding** (Connect Express + profile state). Behind flag.
- **Phase B — Participant payment** (PaymentSheet + payments table + webhook).
- **Phase C — Refunds** (participant cancel + host cancel event).
- **Phase D — Delayed payouts** (pg_cron + process-payouts function).
- **Phase E — Polish** (payouts screen, payment history, receipts).
  - **"How paid events work" in-app explainer.** A single scrollable screen of **collapsible sections** (collapsed by default, expand-on-tap — *not* a swipe carousel like `how-it-works.tsx`, so every topic is visible at a glance and the page works as jump-to reference, not linear onboarding). Sections, sourced from `cancellationAndRefund.md` + the §2 fee model: fees & what the host keeps, participant refund rules (12h cutoff, processing fees non-refundable), host cancellation / late-cancellation tracking, no-shows, payout timing (~24h after the event). Plain-language first, exact numbers second; "last updated" date shown.
  - **Entry points:** the Phase A payouts screen ("Learn more about payouts" link), the create-event paid section, and the currently-dormant Profile menu items (Cancellation Policy / Help / Terms) all route here.
  - **Hybrid with the web:** the in-app page ends with a "View full terms" link out to the web-hosted Terms / Cancellation Policy on `letsplayapp.ca` — the in-app page covers the friendly educational summary (rarely changes), the web holds the formal, freely-updatable legal docs (the web docs themselves remain the separate §12.3 go-live track).
  - **Why Phase E, not earlier:** the page documents the full money loop (fees, refunds, cancellations, payouts), whose behavior only fully exists once B/C/D ship. Writing it here means every rule it states is already shipped and testable, avoiding doc drift; and since the feature stays flag-off until B+C+D land (§12.3), no user ever hits a missing link in the meantime.
  - **Payout-status confirmation UX (post-launch, low priority).** After onboarding, the Payouts screen shows a "Verifying… this might take a minute" state that polls (~60s cap) for the `account.updated` webhook to flip `stripe_payouts_enabled`. This can still lose a race if the webhook is slow, and isn't seamless. A more robust fix: an **active status fetch on return** — when the in-app browser closes, call an Edge Function that runs `stripe.accounts.retrieve()` and updates the flag immediately (reads Stripe's source directly instead of waiting for the webhook notification; the webhook stays as the safety net for later changes). Optionally pair with Universal/App Links for a smooth auto-return. **We might want to change this, but it isn't urgent — the current poll is acceptable for launch; revisit after.**

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
| Host cancels 47h before start | Warning shown; all participants refunded; tracked as late cancellation |
| Host cancels 11h before start | Blocked |
| 26h after event start | Payout job transfers funds to host |
| Host no-show reported 23h after start | `payout_held_at` set; payout job skips the event |
| No-show confirmed during investigation | All participants refunded in full; no payout |
| Host cleared during investigation | `payout_held_at` cleared; next hourly run pays out |
| Host's bank rejects transfer | Flagged for review |
| Webhook arrives twice | Idempotent, no double-action |

### 12.3 Go-live checklist (separate from this spec; tracked at release time)

- **Gate: Phases B, C, and D are all shipped before the live-key switch.** The full money loop — charge (B) → refund (C) → payout (D) — must work end-to-end first. Phase B alone takes real money with no way to refund participants or pay hosts; flipping to live keys before C+D exist invites stuck customers, chargebacks, and Stripe account review. (Phases may still be built and **test-mode**-shipped independently — this gate is only about the test→live key swap.)
- Switch to live keys
- Real bank account verified on platform Stripe
- Terms of Service + Privacy Policy published
- Stripe Connect Platform Profile completed
- Real Canadian business documentation submitted to Stripe

### 12.4 Observability (background money-failure monitoring)

Most of the money machinery runs where no user is watching — webhook handlers, the hourly payout job, the refund loop — and several failure modes leave money silently stuck: a `payments` row stranded in `pending`, a transfer flagged for manual review (§8.3), a row written to `failed_refunds` (§4.8). The app's current pattern (friendly on-screen errors, e.g. `delete-account.tsx`) only covers user-facing actions; these background failures would otherwise be discovered only via a host's "where's my money?" or a participant's "I never got refunded" — the worst possible detection method for a payments system.

**Commitment:** Edge Functions send errors and stuck-money conditions to a monitoring service (Sentry / Logflare / an alert channel) so a human is *notified*, not reliant on hand-polling tables. Worth alerting on: any webhook/handler exception; a new `failed_refunds` insert (the §7.6 runbook's "discover" step); a payout flagged for manual review (§8.3); optionally a periodic check for `pending` payments older than N minutes. Phase 1 can be lightweight (log to Sentry + alert on `failed_refunds` inserts); exact tooling depth decided at build time. The principle is fixed: background money failures are surfaced proactively.

---

## 13. Open questions deferred to later phases

- ~~Host no-show vs. the payout timer~~ — **resolved** by the cancellation policy: automatic payout hold on report + 26h payout timing + manual investigation; see §7.5.
- GST/HST registration once approaching $30k threshold
- Commission off host payouts (currently 0%)
- In-app dispute response workflow
- Multi-currency
- Apple Pay / Google Pay (Stripe Payment Sheet supports these out of the box; can enable later with negligible code change)
- **Full append-only payment audit log.** Phase 1 ships only `payments.updated_at` (§4.2) for "last touched." A `payment_status_history(payment_id, old_status, new_status, changed_at, reason)` table — written by a trigger on every status change — would give a defensible transition history for chargeback/reconciliation forensics. Deferred because Stripe's own event log (and the `stripe_events` table, §9) already provides a fallback audit source.
