# Pending Big Tasks — Final Spec

Status: **spec final (answers 2026-10-09) — not started.** Small tasks already done (see root `tasks/todo.md`).
Web app: `pigeon_pulse/` (own git repo). Mobile: `agn-mobile/` (own git repo). HayLoft legacy reference: `pigeon_pulse/docs/hayloft-schema-reference.sql`, `pigeon_pulse/docs/hayloft-comparison.md`.

Size key: **S** < ½ day · **M** 1–2 days · **L** 3–5 days · **XL** 1+ week

## Overview + order

| Phase | # | Feature | Size | Schema change |
|-------|---|---------|------|---------------|
| 1 | 5a | Betting scheme page padding fix | S | no |
| 2 | A | Registration approval (waiting → approved / rejected) | M–L | yes |
| 3 | B | Soft delete bird (event entry) + restore | M | yes |
| 4 | C | Return bird (scan) | M | maybe |
| 5 | D | Payment request (in-app + email + PayPal link) | M–L | yes |
| 6 | E | Clear result + recalc from scanner times | M | maybe |
| 7 | F | Prize scheme → percentage, per-race prize | L | yes |
| 8 | G | Winner payout in bird section | M | yes (setting) |
| 9 | H | Dynamic betting show tiers | L | yes |
| 10 | I | Reports → their sections, remove central page | M | no |
| 11 | J | Codes / indexing column for all entities | L–XL | yes |

Why this order: A first because "approved only" filter touches every later feature. F before G (payout needs prize math). J last: additive column, touches every table/list — do once everything else is stable.

**Global rules for every phase**
- Prisma migration per phase (`--create-only` first, review SQL, then apply to the **dev** DB only after user OK).
- Backfill existing rows in the same migration where noted.
- Every new list filter goes in the API query, not client-side.
- Mobile (`agn-mobile/`): list required follow-ups per phase; do not change it unless told.

---

## 5a. Betting Scheme Padding — S

Betting scheme page: under **Standard Show**, padding pushes the **Position** section lower than the show tier list. Align them (same top offset / grid row). CSS only.

---

## A. Registration Approval — M–L

**Rules**
- Breeder registers for event (web or mobile) → registration is **WAITING**. Not shown as participant; birds not active.
- Admin **approves** → breeder in, birds active.
- Admin **rejects** → breeder + birds ignored for that event (excluded everywhere).
- **Admin-created registrations: auto-approved.**
- **Existing registrations: migrated as approved.**
- Breeder **can pay before approval**.
- Rejected after paying → breeder has a **credit (deficit on organizer side)**: system creates a **payment due to the breeder** (refund owed) under the breeder's name. Admin must pay them back; it shows as owed until marked refunded.

**Exists now**
- `EventInventory.isWaiting` (Int) + `waitingDate`. Small task C added a waiting toggle + date in breeder detail.
- `Refund` model exists on `EventInventory` — check if it fits "refund owed".

**Design**
- Add `approvalStatus` enum `WAITING | APPROVED | REJECTED` on `EventInventory` (+ `approvedAt`, `rejectedAt`, `approvedById`). Keep `isWaiting/waitingDate` in sync or migrate off them; replace the small-task toggle with Approve / Reject buttons.
- Migration: all existing rows → `APPROVED`.
- Register route: breeder self-registration → `WAITING`; admin register → `APPROVED`.
- One shared helper for "approved only" (`where: { approvalStatus: 'APPROVED' }`) used by: race entry lists, check-in, baskets (loft + race), fee totals, payment requests, betting, results, averages, reports, store, defaulters.
- Event UI: **Waiting** section (list by `waitingDate`, Approve / Reject, bulk select).
- Reject with paid amount > 0 → create refund-owed record; show in breeder detail + accounting as "Due to breeder".
- Notify breeder on approve / reject (in-app notification; reuse feature D channel).

**Mobile follow-up:** show waiting / approved / rejected status on registration.

---

## B. Soft Delete Bird + Restore — M

**Rules**
- Delete removes the bird from **this event only** (event entry), not the bird globally.
- Its **fees are removed** from the breeder's totals.
- **Bets are not deleted/voided.** Paid bets stay; breeder must contact admin to cancel a bet (existing manual flow).
- **Restore** button brings it back (fees re-added).

**Design**
- `EventInventoryItem.deletedAt` (+ `deletedById`). Exclude `deletedAt != null` everywhere entries are listed/counted/billed (same shared filter pattern as A).
- Delete button in breeder detail + birds tab; confirm dialog. "Show deleted" toggle in birds tab with Restore.
- Remove from future races / baskets on delete (unassign basket). Past race results: ❓ decide in plan — default keep history, hide from current lists.

---

## C. Return Bird (Scan) — M

**Rules**
- **Return Bird** opens the scanner (reuse check-in scan pattern / scanner poll).
- On scan: show **owner name, address, payment details** (paid, owed, refund due).
- Bird marked **returned** → cannot take part in any following race **in this season** only (other seasons unaffected).
- If the breeder chose refund or pay-out, show that option (pay balance / refund) in the scan result; otherwise nothing — handled off-software.

**Exists now:** `POST /api/admin/event-inventory-item/[id]/return`, `returnBird()` in `lib/bird-substitution.ts`, scanner poll `POST /api/scanner/poll`, check-in tab scan UI.

**Design**
- Check what `returnBird()` does today; extend, don't duplicate.
- Returned flag on the event entry (`returnedAt`) — or a `RETURNED` race-item status for remaining races of the season. Block adding returned birds to new races + baskets in that season.
- Re-scan of already-returned bird → notify, no-op. Unknown RFID → error toast.

---

## D. Payment Request — M–L

**Rules**
- Two bulk buttons on Breeders tab: **Request Entry Fee** and **Request Race Fee**. Each sends a POST.
- Targets: every registration with hybrid payment status **PENDING or PARTIAL** (approved only).
- Also a single-breeder button in breeder detail (same endpoint, one id).
- **Fee meanings:** Per Bird fee = perch fee. **Race fee = the amount for one particular race** → admin picks the race when requesting race fee.
- Delivery: **in-app notification + email**, both with a **PayPal payment link** for the exact amount.
- Message: full amount due; if PARTIAL, state amount already paid and remaining balance.

**Exists now:** `Notification` + `NotificationKind`, `PushDevice`, PayPal orders (`/api/payment/paypal/*`), `lib/paymentStatus.ts`, fee calc `lib/fee-calculator.ts`. **No email sending infra found** — check `package.json`/env for an existing mailer before adding one (needs user OK for a new dependency/provider).

**Design**
- `POST /api/admin/event/[eventId]/payment-request` `{ type: 'ENTRY' | 'RACE', raceId?, inventoryIds? }` (no ids = all eligible).
- `PaymentRequest` log table (inventoryId, type, raceId, amount, sentAt, sentById, channel results). Show "last requested" in breeders tab.
- PayPal link: deep link to existing pay flow with amount + fee type prefilled (reuse PayPal order creation).

**Mobile follow-up:** notification opens pay screen for that fee.

---

## E. Clear Result + Recalc — M

**Rules**
- **Clear result** = temporarily **unrank** birds: positions removed, arrival times + raw scans kept.
- While unranked, **prizes and bet payouts are reversed too** (not shown as won/paid).
- **Recalc** = re-rank using the **arrival time recorded by the scanner** (clock time in scan), not the time the app fetched/inserted it. Recompute prizes + bet payouts.
- Import: out of scope (left blank).

**Exists now:** `RaceItemResult`, `RaceItemScan`, `RfidScan`, `races/[raceId]/recalculate-dialog.tsx`, corrections dialog.

**Design**
- Check which timestamp recalc and the scan route use today. If it's insert/fetch time → fix to scanner time (bug).
- Clear: null positions/prize values, mark race results "unranked", reverse bet settlement (status back to pending, payouts cleared). Confirm dialog, permission `races.manage`, audit log.
- Breeders see "Results pending" while unranked.

---

## F. Prize Scheme → Percentage, Per-Race — L

**Rules**
- Prize scheme bands are **percentages**, not amounts.
- **Band % is split across the positions in the band**: band 1–3 at 10% → the 3 positions share 10% (3.33% each).
- **Pool per race** = fees for **that race**: `(paid + 75% of owed) − organizer cut (FeeScheme.feesCutPercent)`. Subtract the cut first, as stated.
- Event/race UI shows **computed amounts**, not %. Scheme editor shows %.
- **Per race**: race has its own prize scheme or none. Replaces season prize slots.
- Ties (same drop): sum the tied positions' prizes, split equally (HayLoft rule).

**HayLoft note:** HayLoft stored manual amounts per event/race type (`PRIZE_VALUE`); no % logic exists in its DB. This % model is new.

**Exists now:** `PrizeScheme`, `PrizeSchemeItem(fromPosition, toPosition, prizeValue)`, `PrizeValue`, season slots `finalPrizeSchemeId`, `hotSpot1–3PrizeSchemeId`, `hotSpotAvgPrizeSchemeId`, `RaceType.prizeRole`, engine `calcRacePrizes` (see `pigeon_pulse/docs/scheme-wiring-audit.md`).

**Design**
- `PrizeSchemeItem.percent` (validate band sum ≤ 100). Existing amount schemes: ❓ plan must propose (convert impossible without pool → likely mark legacy / require re-entry).
- `Race.prizeSchemeId` nullable. Migrate: each race gets the scheme its season slot + race type role pointed to. Then stop reading season slots (drop later).
- `lib/prize.ts`: `racePrizePool(raceId)`, `prizeForPosition(race, position)`; used by results, recalc, reports, payout (G).
- "Fees for that race" = per-race fee (race-type fee via `RaceTypeFeeScheme` / hot spot fee for that race). Derive from `fee-calculator.ts`; document the formula in code.
- Average prizes (`AverageConfig`, `AvgWinnerPrizes`): unchanged unless the plan finds they read season slots — then keep working.

**Mobile follow-up:** prize band editor → %.

---

## G. Winner Payout in Bird Section — M

**Rules**
- Bird section shows **both prize money and bet winnings** (per race + total).
- **Toggle**: show to breeders, or admin only. Default admin only.

**Design**
- Per-event setting `showPayoutToBreeders` (event settings / tab visibility pattern `EventTabVisibility`).
- Data from F (`prizeForPosition` / stored prize value) + settled bets.

---

## H. Dynamic Betting Show Tiers — L

**Rules**
- Tier count **set per scheme**, **no maximum**.
- Applies to Belgian, Standard and WTA.

**Exists now:** fixed columns `belgianShow1–7`, `standardShow1–6`, `wta1–5` on `BettingScheme`; `StandardShowPercentage(place)`; engine `lib/betting-pools.ts`, `lib/betting-payout.ts`; `Bet` has tier field.

**Design**
- `BettingTier { schemeId, category, tier, amount }`. Migration copies column values into rows (skip nulls). Then remove reads of the fixed columns (drop columns in a later migration).
- Scheme editor: add/remove tier rows per category.
- Pools/payout/bet placement (web + mobile endpoints) loop over tiers. Existing bets keep tier numbers → still valid.
- Standard show position % (`StandardShowPercentage`) already row-based — verify it supports any tier count.

**Mobile follow-up:** bet placement tier picker reads tiers from API.

---

## I. Reports → Their Sections — M

**Rules**
- **Remove** central `/admin/reports` page.
- Each report lives in its section (e.g. bet details → Betting tab).
- In each section: pick a race → that race's report, or **All races** at once.
- Preview before download (reuse `components/document-preview.tsx` from small task K).

**Design**
- Plan proposes report → tab mapping from `lib/reports/definitions.ts`; confirm with user before moving.
- Shared `<ReportButton reportId raceSelector />` in each tab. Remove page + nav link + dead code.

---

## J. Codes Column (Indexing) — L–XL

**Rules**
- Keep current int IDs and FKs. Add a `code` string column (unique, indexed) per entity, shown in tables.
- Format: type letters + zero-padded number, scoped by event. Example `EVE0027RACE00200` = event 27, race 200.
- Numbers:
  - **Event**: event number (event list shows it).
  - **Breeder**: number **per event** (not global) → on `EventInventory`.
  - **Race**: number **per event**.
  - **Bird**: number **per event** → on `EventInventoryItem`.
- Number ranges for all entities, **auto-assigned, admin-editable**. Race ranges labelled by race type (separate table, e.g. 2000–2200 Training, 2500–3000 Inventory).

**Exists now:** `Breeder.number` (global), `Race.raceNumber`, bird number on `EventInventoryItem`, `EventRaceNumber(seasonId, numberGroupId, from, to)` + `RaceNumberGroup` ← `RaceType.numberGroupId`.

**Design (proposed — confirm prefixes in plan)**
- Prefixes: `EVE` (4 digits), `BRE` (4), `RACE` (5), `BRD` (5). Codes:
  - Event `EVE0027`
  - Breeder in event `EVE0027BRE0105`
  - Race `EVE0027RACE00200`
  - Bird in event `EVE0027BRD02001`
- `lib/codes.ts`: `formatCode()` + `nextNumber(entity, eventId, range)` in a transaction with unique `(eventId, number)` index.
- Range table `NumberRange { eventId?, entity, raceTypeId?, from, to }`; race ranges reuse/replace `EventRaceNumber` (season → event scope: check impact).
- Editing a number regenerates the code; validate range + uniqueness.
- Backfill migration for all existing rows.
- Show code column in event list, breeders tab, races tab, birds tab; searchable. Add to receipts/exports/reports.

**Mobile follow-up:** show codes.

---

## Open items (ask in plan, don't block)

1. A: should reject notify by email too, or in-app only?
2. B: deleted bird's past race results — keep in history or hide?
3. C: returned = new `RaceItemStatus.RETURNED` vs `returnedAt` flag — plan picks.
4. D: email provider — none in repo yet. Which (SES on AWS per infra plan, Resend, SMTP)?
5. D: partial message wording — user's sentence cut off ("if paid partially then …"); default: show paid + remaining.
6. F: existing amount-based prize schemes — convert/legacy/re-enter?
7. J: prefixes + digit widths confirm.
8. Small-task leftovers: Change Breeder moves whole registration (all birds) — per bird instead? Rename stale entry-fee "Perch Fee" labels to "Entry/Purge Fee"? Default team name stays in `defNameAgn`?
