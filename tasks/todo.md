# Task 1b — Betting UI

Decisions: bettors = breeders (no BETTOR signup). Bet UI = tab on race page. Admin payout = event "Betting" tab. Extend GET /bet w/ pool defs.

## 1. Server: extend GET /api/breeder/race/[raceId]/bet
- [ ] Add `pools: [{category, tierIndex, amount}]` from event's BettingScheme (belgianShow#/standardShow#/wta# non-null tiers) to response. Also return `bettingOpen`, `raceStatus`.

## 2. Endpoints + hooks
- [ ] `src/lib/endpoints.ts`: add betting paths (breeder bet GET/POST per raceId, admin toggle/pool/calculate per raceId).
- [ ] `src/lib/api/bets.ts`: useRaceBets(raceId), usePlaceBet(raceId), useBettingPool(raceId), useToggleBetting(raceId), useCalcPayouts(raceId).

## 3. Admin: race betting toggle
- [ ] races-tab.tsx / races-columns.tsx: per-race Switch for bettingOpen. State from race.bettingOpen. Disabled if status !== REGISTERING. Calls toggle. Refetch races on success.
- [ ] Confirm admin races list returns bettingOpen (check /api/admin/race GET select).

## 4. Breeder/bettor: betting tab on race page
- [ ] `src/app/races/[raceId]/page.tsx`: add "Betting" tab/section. New component `betting-tab.tsx`.
- [ ] List birds (GET /bet). For each pool (category/tier from response): checkbox per eligible bird.
  - Own bird: bettable when raceStatus REGISTERING.
  - Other bird: bettable when bettingOpen.
  - Already-in-pool: show locked w/ who (isYours).
- [ ] Tick → POST /bet {raceItemId, category, tierIndex}. Optimistic refetch. Show $ amount per tier.

## 5. Admin: Betting tab on event detail
- [ ] `src/app/admin/events/[eventId]/page.tsx`: add "Betting" tab (grid-cols-10 → 11).
- [ ] `betting-tab.tsx`: race dropdown (event races) → GET pool. Table grouped by category/tier: bettor, band, amountIn, position, status, payout.
- [ ] "Calculate Payouts" button (enabled raceStatus ENDED) → POST calculate. Show per-bettor payout summary after.

## 6. Verify
- [ ] npx tsc --noEmit clean.

## Review (done)
- [x] Extended GET /bet: pools/bettingOpen/raceStatus/ownerName.
- [x] endpoints.betting + src/lib/api/bets.ts hooks.
- [x] Race type +bettingOpen. Betting column w/ Switch in races-columns (disabled unless REGISTERING).
- [x] race-betting-tab.tsx + Tabs(Results|Betting) on /races/[raceId].
- [x] admin betting-tab.tsx (race select → pools table + Calculate Payouts + payouts-owed summary). Wired into event page (Betting tab).
- [x] tsc --noEmit clean.

Notes: bettors = breeders (no BETTOR signup built). Calculate Payouts enabled only when race ENDED. Toggle enforces one-open-race/event server-side; error toasted.

---

# Big tasks

Spec: docs/pending-big-tasks.md. Branch: feat/big-tasks. One phase at a time; tsc + lint + check script after each.

## Phase 0 — preconditions (no code)

- [ ] **Dev database (BLOCKER for every schema phase).** `.env` points at one remote Neon DB, which `docs/CHANGES-HANDOVER.md` calls live. I apply nothing until you give me a dev DB URL (e.g. a Neon branch).
- [ ] **Migration method.** `prisma migrate dev` (and so `--create-only`) fails: `20260309_schema_cleanup` cannot replay on a shadow DB, and earlier changes went in via `db push`, so the migration history has drift. Proposed instead, per phase: `prisma migrate diff` (dev DB → `schema.prisma`, `--script`) into a hand-named folder in `prisma/migrations/`, backfill SQL appended by hand, shown to you, then `prisma db execute` on the dev DB + `migrate resolve --applied`. No shadow DB, no reset.
- [ ] Check runner: existing `scripts/verify-*.ts` run with `bun`. Check scripts will follow that pattern (`scripts/check-*.ts`); pure functions only, no DB.

## Shared helper (built in A, extended in B and C)

`src/lib/entry-filters.ts`:
- `approvedInventory` = `{ approvalStatus: "APPROVED" }`
- `activeItem` = `{ deletedAt: null, departureDate: null, eventInventory: approvedInventory }`
- matching `Prisma.sql` fragments for the raw SQL in `src/lib/race-results.ts`, `src/lib/bird-substitution.ts`.

Applied at the ~80 query sites grouped in exploration: breeders/fee totals (`event-inventory/route.ts`, `dashboard-stats`, `defaulters`, `accounting.ts`, `build-receipt-data.ts`), birds/check-in/groups, baskets (`assign`, `assign-race`, `scan-loft`, `prescan-*`), race entry + results (`race/route.ts`, `race-item/route.ts`, `race-results.ts`, `computeAverages.ts`, `tournament.ts`, `race-classes.ts`), betting routes, reports (`lib/reports/definitions.ts`, `exportFormats.ts`), store, breeder/public endpoints, notification audiences (`lib/notifications.ts`).

## Phase 1 — 5a padding

- [x] `src/components/betting-scheme-component.tsx` (Standard Show block, ~291–384): the right column's `<h4>Position Percentages</h4>` pushes its inputs below the left column's. Give the left column a matching heading row ("Show tiers") so both grids start on the same line. CSS/markup only.
- [ ] Verify: tsc, lint, view `/admin/schemes`.

## Phase 2 — A approval

Schema (additive):
- [x] New enum `RegistrationStatus { WAITING APPROVED REJECTED }` (`ApprovalStatus` is taken by user accounts).
- [x] `EventInventory`: `approvalStatus RegistrationStatus @default(APPROVED)`, `approvedAt`, `rejectedAt`, `approvedById String?`. Default `APPROVED` backfills existing rows and covers the nine admin/system paths that create registrations.
- [x] `Refund`: `status RefundStatus { OWED ISSUED } @default(ISSUED)` so "refund owed" can exist; existing rows stay `ISSUED`.
- [x] `NotificationKind`: add `REGISTRATION_APPROVED`, `REGISTRATION_REJECTED`.
- [x] `isWaiting`/`waitingDate`: kept, no longer read; `waitingDate` still set on self-registration for sort order.

API:
- [x] `src/app/api/breeder/event/[eventId]/register/route.ts`: create as `WAITING`. It still creates race items, bets and the PENDING payment (breeder can pay before approval); the shared filter hides them until approved.
- [x] `POST /api/admin/event/[eventId]/event-inventory/approval` `{ ids, action }` (`breeders.manage`): approve / reject, bulk. Reject with paid > 0 creates a `Refund` row `OWED` for paid minus already refunded. Notifies via `notifySafely`.
- [x] `PATCH /api/admin/event-inventory/[id]`: drop `isWaiting` toggle fields.
- [x] Refund route: "mark refunded" flips `OWED` → `ISSUED`. `accounting.ts`: `OWED` shows as "Due to breeder", not netted.
- [x] Apply `approvedInventory` at all listed query sites; `?approval=WAITING` on the breeders list API.

UI:
- [x] `breeders-tab.tsx`: "Waiting (n)" view sorted by `waitingDate`, row + bulk Approve / Reject.
- [x] `breeder-registration-extras.tsx`: replace `RegistrationStatusEditor` toggle with status badge + Approve / Reject.
- [x] `breeder-details-dialog.tsx` + accounting tab: "Due to breeder" line.
- [x] Portal: registration success messages say "waiting for approval" (`event-register-tab.tsx`, `paypal-button.tsx`); no status banner yet.

Verify: tsc, lint; self-register as breeder → absent from breeders tab, baskets, race entries; approve → present; reject after payment → refund owed shown.
Mobile follow-up: show registration status.

## Phase 3 — B soft delete

- [ ] Schema: `EventInventoryItem.deletedAt DateTime?`, `deletedById String?`.
- [ ] `POST/DELETE /api/admin/event-inventory-item/[id]/delete` (delete / restore, `breeders.manage`). On delete: remove basket assignments for races not yet started; if the item carries the registration's entry fee (it sits on the first bird only), move `entryFeeValue` to the next live item; re-run `recalcPerchFees` (add deleted filter to its raw SQL in `bird-substitution.ts`). Restore reverses.
- [ ] Bets untouched.
- [ ] Filter: `activeItem` everywhere except results of `ENDED` races (history kept — open item 2).
- [ ] UI: Delete in `birds-columns.tsx` row menu and breeder detail birds table, confirm dialog; "Show deleted" toggle in `birds-tab.tsx` (`?includeDeleted=1` in the API) with Restore.

Verify: tsc, lint; delete first bird → entry fee still owed once, perch fees renumbered; restore → totals back.

## Phase 4 — C return bird

- [ ] No schema change: reuse `EventInventoryItem.departureDate`, which `returnBird()` already sets, as the returned flag (open item 3).
- [ ] `returnBird()` (`src/lib/bird-substitution.ts:384`): add already-returned no-op; remove basket assignments + race items of not-yet-started races in the season. RFID clearing: see Q-C1.
- [ ] `POST /api/admin/event/[eventId]/return-scan` `{ rfid, confirm? }`: lookup by RFID (pattern from `baskets/scan-loft/route.ts:60`), returns bird, owner name + address, `computePaymentTotals` (paid, owed), refund owed; with `confirm` calls `returnBird()`. Unknown RFID → 404.
- [ ] Block returned birds: `activeItem` (has `departureDate: null`) in race creation, register/add-bird paths, basket assign/scan routes.
- [ ] UI: "Return Bird" button in `birds-tab.tsx` opening a scan dialog (poll loop + `useWebSerial`, as in `checkin-tab.tsx:237`); result card with owner + payment details; toasts for already-returned / unknown.
- [ ] Verify during build: `scanner/push` marks scans of known RFIDs `processed`, so `scanner/poll` may never return them — confirm on the dev scanner path before relying on poll.

Mobile follow-up: none required.

## Phase 5 — D payment request

- [ ] Schema: `PaymentRequest { id, eventInventoryId, type (ENTRY|RACE), raceId?, amount, paidAtSend, sentAt, sentById, inAppOk, emailOk, emailError?, paymentId? }`.
- [ ] `POST /api/admin/event/[eventId]/payment-request` `{ type, raceId?, inventoryIds? }` (`payments.manage`): targets approved registrations with hybrid status PENDING / PARTIAL. Amount: ENTRY = outstanding entry + per-bird fees; RACE = that race's fee from `RaceTypeFeeScheme.fee` × the registration's live race items (or flat, per `raceFeeMode`) — see Q-D1.
- [ ] Message: amount due; if PARTIAL, amount paid + remaining. In-app via `notifySafely` (kind `PAYMENT_DUE`, link to the pay page).
- [ ] Pay link: new page `/pay/request/[id]` (breeder sign-in required) + `POST /api/payment/paypal/create-request-order` that creates a PENDING `Payment` for the request amount and a PayPal order; capture reuses the existing capture flow. Existing `create-order` takes no amount, so it cannot be reused directly.
- [ ] Email (**BLOCKER for the email half**): no mailer exists. One `sendEmail()` in `src/lib/email.ts` once you choose a provider; until then requests go in-app only and record `emailOk = false`.
- [ ] UI: "Request Entry Fee" / "Request Race Fee" (race picker) on `breeders-tab.tsx`; single button in `breeder-details-dialog.tsx`; "Last requested" column.

Verify: tsc, lint; send to one PARTIAL breeder → notification text, PaymentRequest row, pay page charges the stated amount in PayPal sandbox.
Mobile follow-up: notification opens the pay screen for that request.

## Phase 6 — E clear result + recalc

Findings: recalc already sorts by `RaceItemResult.ARRIVAL_TIME`. That value is the scanner clock on the Web Serial path, but on the scanner-poll path it is server insert time, cut to seconds and shifted by the browser's UTC offset (`races/[raceId]/page.tsx:161–174, 242`). Raw scans are not kept per race (`RaceItemScan` is never written).

- [ ] Timestamp fix: `scanner/push` accepts an optional scanner timestamp and stores it on `RfidScan.timestamp`; `scripts/serial-scanner-bridge.mjs` sends it; `handleScan` formats with UTC getters and milliseconds; `scan/batch/route.ts` `parseTimestamp` made identical to the single-scan route.
- [ ] Schema: `Race.resultsClearedAt DateTime?`, `resultsClearedById String?`; `Payment.betId Int?` (links a payout to its bet so it can be reversed).
- [ ] `POST /api/admin/race/[raceId]/clear-results`: null `birdPosition`, `birdPositionHotSpot`, `prizeValue` (arrival times kept); bets → `PLACED`, `payoutValue` null; delete this race's PENDING payout payments. If any payout is already PAID, refuse and list them.
- [ ] `calculate-payouts`: set `betId`, delete prior PENDING payouts first (re-running currently duplicates payout rows).
- [ ] `recalcRace` (`src/lib/race-results.ts:375`): clears `resultsClearedAt`; re-runs bet payouts when the race is `ENDED`.
- [ ] UI: "Clear results" next to `RecalculateDialog` with confirm; breeder race page shows "Results pending" while `resultsClearedAt` is set; prize/position hidden in breeder APIs.
- [ ] Check: `scripts/check-recalc-order.ts` — ordering by scanner time with ms, ties by id.

## Phase 7 — F % prizes per race

Findings: the engine pays from `PrizeValue` rows (which have no editor), not from `PrizeSchemeItem.prizeValue`; each position in a band gets the full band value; fees and payments are not tracked per race.

- [ ] Schema: `PrizeSchemeItem.percent Float?`, `Race.prizeSchemeId Int?`. Backfill: each race gets the scheme its season slot + `RaceType.prizeRole` resolves to. Season slots and `PrizeValue` stay (dropped later).
- [ ] `src/lib/prize.ts` (pure): `splitPrizes(pool, bands, placed)` — band % ÷ positions in band; tied birds pool their positions' prizes and split equally; round down to cents. `racePrizePool(tx, raceId)` — formula per Q-F1, documented in code.
- [ ] `calcRacePrizes`: scheme from `Race.prizeSchemeId`; uses `splitPrizes` when the scheme's items have `percent`; legacy amount path kept for schemes without it. FINAL pays on `birdPosition`, hot-spot roles on `birdPositionHotSpot` (unchanged).
- [ ] Prize scheme form + API + zod: `%` per band, sum ≤ 100.
- [ ] Race form (`races-tab.tsx`): prize scheme select; race page shows computed amounts per position.
- [ ] Switch season-slot readers: `dashboard-stats`, `reports/definitions.ts` prize-scheme report, event list `finalPrize`, `season-selector.tsx`, `season-clone.ts`.
- [ ] Check: `scripts/check-prizes.ts` — pool, band split, tie split, rounding.

Mobile follow-up: prize band editor → %.

## Phase 8 — G payout

- [ ] Schema: `Event.showPayoutToBreeders Boolean @default(false)` (`EventTabVisibility` is a sign-in gate and does not fit).
- [ ] Admin `bird-event-section.tsx` (already has a Prize column): add bet winnings per race + totals.
- [ ] Breeder `event-birds-tab.tsx`, `birds/[birdId]/page.tsx` and their APIs: prize + bet winnings only when the flag is on.
- [ ] Toggle in `details-tab.tsx` / event update API.

## Phase 9 — H dynamic tiers

- [ ] Schema: `BettingTier { id, bettingSchemeId, category BetCategory, tier Int, amount Float, @@unique([bettingSchemeId, category, tier]) }`. Backfill from `belgianShow1–7`, `standardShow1–6`, `wta1–5` (skip nulls). Old columns stay.
- [ ] `src/lib/betting-pools.ts`: `schemeTierAmount` / `schemePools` read tier rows; remove `TIER_COUNTS`. Replace the private tier maps in `breeder/race/[raceId]/bet`, `place-cash-bet`, `create-bet-order`, `capture-bet-order`, register route; remove the four `max(7)` caps.
- [ ] `betting-scheme-component.tsx` + API + zod: add/remove tier rows per category.
- [ ] Reports/receipt (`definitions.ts:607`, `build-receipt-data.ts`) read tier rows.
- [ ] Check: `scripts/check-tier-payout.ts` — payouts for a scheme with 9 tiers, existing tier numbers unchanged.

Mobile follow-up: tier picker reads tiers from the API.

## Phase 10 — I reports

Proposed mapping (for your OK):

| Report | Goes to | Race picker |
|---|---|---|
| Race Result | Result tab + race page | yes + All races |
| Pool Totals | Betting tab | yes + All races |
| Betting Scheme | Betting tab | no |
| Breeder Average, Breeder Average (Short) | Averages tab | no |
| Inventory List | Birds tab | no |
| Breeder Labels | Breeders tab | no |
| Breeder Balance, Season Ledger, Unpaid Balances, Earnings Owed, Prize Statements | Accounting tab | no |
| Fee Scheme, Prize Scheme | Details tab | no |
| Event Rules and Fees | Rules tab | no |
| Address Book Labels | `/admin/users` (global, no event) | no |

- [ ] `src/components/report-button.tsx`: format menu + `useDocumentPreview`, optional race select with "All races".
- [ ] "All races": report route loops the single-race builder over the season's races into one document.
- [ ] Remove `src/app/admin/reports/page.tsx`, sidebar link (`app-sidebar.tsx:87`), `scripts/verify-admin-pages.ts` entry, empty `api/admin/reports/[slug]`. Report API routes stay.

## Phase 11 — J codes

- [ ] Schema: `Event.number Int? @unique`, `Event.code`; `EventInventory.number`, `.code`; `Race.code` (number = existing `raceNumber`); `EventInventoryItem.number`, `.code`. All `code String? @unique`. `birdNo` is NOT reused — it is the per-registration ordinal that drives perch-fee tiers.
- [ ] `NumberRange { id, eventId, entity, raceTypeId?, from, to }`. `EventRaceNumber` left alone (unused today).
- [ ] `src/lib/codes.ts`: `formatCode()`, `nextNumber()` in a transaction; uniqueness enforced by the unique `code` (it embeds the event number, so no denormalised `eventId` column is needed).
- [ ] Backfill: event number = `id`; others numbered in `id` order within the event.
- [ ] Assign on create in every registration / race / bird-entry path; edit number → regenerate code, validate range + uniqueness.
- [ ] Range editor in event details; code column + search in event list, breeders, races, birds tabs; receipts, exports, reports.
- [ ] Check: `scripts/check-codes.ts` — formatting, next number, range exhaustion.

Mobile follow-up: show codes.

## Questions (default in brackets)

Blockers
1. **Dev DB URL?** Only DB configured is the live Neon one.
2. **Migration method** above OK, given `migrate dev` is broken? [yes]
3. **D: email provider?** [SES; in-app only until chosen]
4. **Q-F1 pool:** paid/owed per race is not stored. [race due = race-type fee × birds in race, + that hot spot's gate fee; "paid" share = the registration's overall paid ÷ owed ratio; pool = (paid + 0.75 × owed) × (1 − cut%)] Is the cut % of that sum, or of full fees?
5. **E/F: FINAL ranking requires `ENTRY_FEE_PAID = 1`, which no app code ever sets** — app-created registrations get no FINAL positions. [replace with "registration's hybrid status is PAID/OVERPAID"?]

Spec open items
6. A: reject notification by email too? [in-app only]
7. B: deleted bird's past results [kept for ended races, hidden elsewhere]
8. C: `RETURNED` status vs flag [reuse `departureDate`]
9. D: partial wording [paid + remaining]
10. F: existing amount schemes [keep legacy amount path; re-enter as % to convert]
11. J: prefixes `EVE`4 / `BRE`4 / `RACE`5 / `BRD`5 OK?
12. Small-task leftovers (transfer per bird? rename "Perch Fee" labels? `defNameAgn`?) [not in this work]

New
13. A: `ApprovalStatus` name is taken → `RegistrationStatus`. OK? Existing rows with `isWaiting = 1` → APPROVED too? [yes, per spec]
14. A: breeder store purchase creates a registration [APPROVED].
15. B: registration's PENDING payment row is a fixed amount [reduce it by the deleted bird's fees if still PENDING].
16. Q-C1: `returnBird()` clears the bird's RFID, so a re-scan looks unknown. [stop clearing on return]
17. C: nothing stores the breeder's "refund or pay" choice. [show pay/refund whenever balance ≠ 0]
18. Q-D1: hybrid status counts PENDING `Payment` rows as paid (`computePaymentTotals` ignores `Payment.status`), so self-registered unpaid breeders may show PAID and be skipped. [count only `PAID` rows — changes existing status display]
19. E: clear/recalc permission [`races.recalculate`, as the existing route]; no audit-log table exists [who/when columns on `Race`].
20. F: tie = identical arrival time? `BIRD_DROP` is never written. [yes, to the ms]
21. H: second fixed-tier family on `EventInventoryItem` (`belgianShowBet1–7` …) [left as is].
22. J: "per event" vs per season (races/registrations hang off `Season`; an event has many). [per event, across seasons] A breeder with two registrations in one event gets two numbers? [yes]
23. J: lists filter client-side today; spec wants API-side search. [client-side, matching existing lists]
24. Mapping table in Phase 10 OK?

Also found, not in scope: `scripts/simulate-arrivals.mjs` has a Neon connection string with password committed. Worth rotating.

## Verification (every phase)

`npx tsc --noEmit` and `npm run lint` with no new errors; the phase's `scripts/check-*.ts`; the manual flow listed in the phase against the dev DB via `npm run dev`.
