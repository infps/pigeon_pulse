# Change handover

Everything done in this session, across both repositories. Written for a
developer picking this up cold.

**Everything is committed. Neither branch has been pushed yet** — the work is
local only, so it needs a `git push` from a machine with repo credentials
before anyone else can see it.

| Repo | Branch | Local head | On remote | This session's changes |
|---|---|---|---|---|
| `infps/pigeon_pulse` | `Roger-8-portal-parity` | `d064ad1` | **branch does not exist there** | 36 files, +12,908 / −483 |
| `infps/agn-mobile` | `Roger-mobile-apps` | `e63fc85` | `f7bf939` — **3 commits behind** | 50 files, +7,741 / −380 |

`main` was not touched in either repo. Note that the portal branch carries
earlier work as well — it sits **31 commits ahead of `main`**, so the first
push publishes all of it, not just this session's six.

---

## ⚠️ Read first

**1. The database is already migrated.** Schema changes were applied to the live
Neon database with `prisma db push`. The code and the database are in step — but
if you roll the code back, **the columns stay**. They are all additive and
nullable or defaulted, so a rollback is safe; nothing is dropped.

**2. Prisma migrations are broken, and it predates this work.**
`prisma migrate dev` fails — migration `20260309_schema_cleanup` cannot replay
against a shadow database because it references `PerchFeeItem`, a model since
renamed to `BirdFeeItem`. That is why `db push` was used. **The migration history
cannot be replayed onto a fresh database.** Needs fixing separately.

**3. The contested cascade rule is settled — it is `SINGLE`.** See
[`payment-spec-questions.md`](./payment-spec-questions.md), question 1.

```ts
// src/lib/fee-calculator.ts
export const HOTSPOT_CASCADE: "CUMULATIVE" | "SINGLE" = "SINGLE";
```

The spec stated the hotspot cascade two different ways. The organiser confirmed
on 2026-09-21: a breeder pays at any one of the four gates, a missed gate rolls
the obligation to the next, and the final race is the last chance. So it is one
obligation with four escalating prices, not four separate charges. The constant
drives billing, amount owed, the breeder's fee table and the settle-on-capture
path together — it was flipped from `CUMULATIVE`, and nothing else changed.

**4. `scripts/probe-login.ts` was committed by accident.** It is a pre-existing
untracked file from before this session, swept up by a `git add -A`. Harmless,
but it is not mine and can be dropped if unwanted.

**5. Nothing was written to HayLoft.** All legacy access was `SELECT` and
`isql -extract`. The `.FDB` file timestamp moved because Firebird stamps its
page header on connect; the file size is byte-identical and fee scheme 4
(American Showcase) is verified unchanged.

---

# Portal — `pigeon_pulse`

Five commits.

## `c6a2c57` — Push notifications

Admin/superadmin can send an announcement to every device running the app.

### Schema
| Change | Notes |
|---|---|
| `model PushDevice` | New. Keyed on the Expo push token (unique), not a device id |
| `NotificationKind.ANNOUNCEMENT` | New enum value |
| `User.pushDevices` | Relation |

### New files
- `src/lib/push.ts` — Expo Push API sender. Chunks at 100, deactivates tokens the
  service reports as `DeviceNotRegistered`. Never throws at the caller.
- `src/app/api/notifications/device/route.ts` — `POST` register, `DELETE`
  unregister. Upserts on token, so re-registering does not grow the list.
- `src/app/api/admin/notifications/route.ts` — `GET` stats, `POST` send.
- `src/app/admin/notifications/page.tsx` — composer UI with device counts and a
  confirm step.

### Modified
- `src/lib/permissions.ts` — new `notifications` module (`view` / `manage` /
  `send`). **`notifications.send` is separate from `manage`** — messaging one
  breeder and messaging every handset are different acts.
- `src/components/app-sidebar.tsx` — Notifications entry.

### Design note
The announcement is **written to the in-app feed first, pushed second**. Push is
the tap on the shoulder, not the message — a failed push loses nothing.

---

## `ffd9c0a` — Payment system + OBS overlay

Implements `payment-and-overlay-impl.md`, Tasks A–E.

### Schema
| Model | Change |
|---|---|
| `EventInventoryItem` | `hotSpot1FeeValue`, `hotSpot2FeeValue`, `hotSpot3FeeValue`, `hotSpotFinalFeeValue` |
| `EventInventory` | `hotspotsPaidMask Int @default(0)` |
| `FeeScheme` | `priorToHotspot1Required Boolean @default(false)` |
| `Payment` | `hotspotGate String?` |
| `Race` | `facebookStreamUrl`, `facebookPageUrl` |

All additive. All nullable or defaulted. Nothing dropped or renamed.

### New files
| File | Purpose |
|---|---|
| `src/lib/race-fees.ts` | Write race fee at basketing, clear on loss |
| `src/lib/hotspot-settle.ts` | Mark gates paid after a capture — shared by all three PayPal paths |
| `src/lib/basketing-gate.ts` | Optional 402 refusal when a registration is unpaid |
| `api/breeder/event/[eventId]/fee-breakdown/route.ts` | Per-bird breakdown (Task A1) |
| `api/breeder/event/[eventId]/pay-hotspot/route.ts` | Selective gate payment (Task B4) |
| `api/public/race/[raceId]/overlay/route.ts` | Public overlay data, enriched server-side |
| `app/overlay/race/[raceId]/page.tsx` + `layout.tsx` | The OBS overlay |
| `src/components/obs-source-field.tsx` | Copyable OBS URL + setup instructions |

### Modified — behaviour changes to be aware of

**`src/lib/fee-calculator.ts`**
- `PerBirdFees` and `FeeBreakdown` gained the four split hotspot figures, plus
  `hotspotDue` (single-gate cost) and `hotspotBilled` (what is charged under the
  active rule).
- `total` is unchanged in shape: `purge + perch + race + hotspotBilled`.

**`src/lib/paymentStatus.ts`** — *most important change to review*
- Was summing `hotSpotFeeValue`, which is now the four-gate total. Left alone it
  would have **overstated every balance**.
- New `hotspotOwedFor()` respects `HOTSPOT_CASCADE` and **falls back to the old
  bucket column** when the four gates are all null — without that, registrations
  written before this change would silently lose their hotspot charge.
- New `computePaymentTotals()` returns `{ owed, totalPaid, balance, status }`.
  `computePaymentStatus()` still returns just the status, so existing callers
  are unaffected.

**Registration routes** (`breeder/…/register`, `admin/…/register`)
- Write the four split hotspot values.
- **Write `raceFeeValue: 0`.** Race fees are no longer charged at registration.

**`baskets/scan-loft/route.ts`**
- Calls `requirePaidBeforeBasketing()` — returns **402** when the season's fee
  scheme sets `priorToHotspot1Required`. **Off by default.** `cashPromised`
  counts as settled.
- Calls `writeRaceFeeForBasketedBird()` — the race fee lands here.

**`race/[raceId]/end/route.ts`**
- Clears `raceFeeValue` on birds marked lost, and **restores it on recovery** —
  re-running a close corrects a mistake in both directions.

**All three PayPal capture paths** (`capture-order`, `capture-bulk`, `webhook`)
- Each calls `settleHotspotsForPayments()`. Without this a card payment for a
  hotspot would be **taken but never credited**.
- `capture-order` now **appends** the PayPal reference to `paymentDesc` instead
  of overwriting it — overwriting threw away what the payment was for.

**`go-live-tab.tsx`** — Facebook embed, priority YouTube → Facebook → placeholder,
plus a "Watch on Facebook" link.

**`races-tab.tsx`** — three stream URL inputs, and the OBS source field when
editing an existing race.

**`event-register-tab.tsx`** — per-bird fee table; race fees labelled
"Race Fees (later)".

---

## `0044b20` — Cascade rule follows the spec

Switched the hotspot cascade from the Task D-table reading to Task B4's, and
made it a named constant. The mask now records **which** gate was paid and
bit-ors rather than overwrites — a breeder paying gate by gate keeps what they
settled, and simultaneous captures no longer erase each other.

Added `docs/payment-spec-questions.md`.

---

## `17827ff` — Charge the hotspot once, not four times

The organiser answered Q1: **one obligation, four chances to pay it**, not four
separate charges. `HOTSPOT_CASCADE` flipped to `"SINGLE"`. Everything downstream
already read the constant, so this is a one-line behaviour change.

**The number that moves:** a full 10-bird entry on fee scheme 4 goes from
**$15,500 to $3,500**. If any ledger or report was reconciled against the
higher figure, it will now disagree.

---

## `d064ad1` — A missed gate actually costs more

The four gates were priced to escalate — 200 / 400 / 800 — but nothing ever
closed one, so an unpaid breeder was quoted HS1's $200 indefinitely. The
escalation never bit.

**A gate now shuts when basketing opens for its race.** That is the organiser's
deadline. `RaceType.prizeRole` already maps races to `HOTSPOT_1/2/3/FINAL`, so
this needed no new columns.

### New file

| File | What |
|---|---|
| `src/lib/hotspot-gates.ts` | `openHotspotGate(seasonId)` — the earliest gate whose race has not been basketed |

### Rules it encodes

- A gate with no price is not a gate. The charge lands on the first **priced**
  gate at or after the open one.
- If a scheme stops short — **scheme 4 leaves Final blank** — the last priced
  gate stands. A breeder who misses everything pays HS3's $800, not zero. Set
  Final on the scheme if they should pay a final amount instead.
- The final race is the last gate. The price stops climbing there.

### Modified

- `computePaymentTotals` / `computePaymentStatus` / `hotspotOwedFor` take an
  `openGate` argument, **defaulting to `HS1`** — so callers that do not know
  the season keep billing exactly as before. Only the three call sites that do
  know it were changed.
- `basketing-gate.ts`, the breeder fee-breakdown route and `pay-hotspot` all
  pass the real gate, so the scanner, the breeder's table and the payment form
  quote the same figure.
- `pay-hotspot` now returns **409 `gateClosed`** rather than selling the early
  price after its deadline. The response carries `openGate` so the UI can say
  what is owed instead.

### Needs a look

**A season only escalates once its hotspot races are mapped to race types with
the right `prizeRole`.** If they are left `NONE`, every gate stays open and
billing sits at HS1 — which is the old behaviour, so it fails quietly rather
than loudly. Worth checking on any live season before the first hotspot.

---

## Documentation added

| File | What |
|---|---|
| `docs/payment-spec-questions.md` | **5 open questions, checkbox format.** Q1 is the cascade rule |
| `docs/scheme-wiring-audit.md` | Audit of how fee/prize/betting schemes connect |
| `docs/hayloft-comparison.md` | Legacy system vs portal, from the live Firebird DB |
| `docs/hayloft-schema-reference.sql` | 8,795-line metadata extract of HayLoft |

---

# Mobile — `agn-mobile`

Three commits. **Admin write operations went from 4 to 64.**

## `eabaece` — Admin app becomes read-write

The 16 event sections fetched correctly but could not change anything.

### New foundation
- `hooks/useAdminAction.ts` — the write counterpart to `useAdminData`. Surfaces
  the portal's own error messages rather than a generic string. Guards
  double-submit with a ref, not state.
- `components/admin/actions.tsx` — `Button`, `ButtonRow`, `Field`, `Sheet`,
  `ChoiceList`, `Confirm`. Re-exported from `ui.tsx`.

### New screens
`event-scanners.tsx` (scanner→loft mapping), `schemes.tsx` (fee/prize/betting).

### New components
`PhantomSheet` (unmatched RFID tags), `UserAccessSheet` (roles + per-user
permissions), `UserEditSheet` (add/edit breeders), `CashBetSheet`,
`CsvImportSheet`, `RaceTrackMap`.

### New services
`download.service.ts` — authenticated binary download to the share sheet, for
PDF/CSV/XLSX reports.

### Patterns worth preserving
- **Preview → commit** on anything that can move every bird or every dollar
  (basket assignment, class payouts).
- **Confirms name the number, not the intent** — closing a Calcutta lot says who
  wins it and for how much.
- Full targets stay visible and greyed with the reason, rather than being hidden.

### Bugs fixed along the way
- **14 remount bugs** (components declared during render). The ledger rebuilt its
  figures on every keystroke; the race screen rebuilt its controls every 20s.
- **One hook-order bug** in `events.tsx` — a `useAdminData` after an early return
  would have crashed for users without `events.view`.

---

## `411d40c` — Race map shows before transport starts

Map renders from the moment a race exists, not only once the lorry moves.
Polling still only runs while transport is active.

---

## `e63fc85` — One account, one app + push registration

### Login separation
**An account now sees exactly one shell.** Holding any admin permission →
operations app. Holding none → breeder app. The three cross-over links were
removed, and `(app)/_layout.tsx` **redirects** rather than hiding a button —
hiding it still leaves screens reachable by deep link.

Which shell someone lands in is decided entirely by permissions the superadmin
grants. **Two demo logins = two accounts**, set up on the existing Users screen.

### Push
`service/push.service.ts` — registers the Expo token after sign-in, drops it on
sign-out (matters on a shared handset). Permission is asked at sign-in, not first
launch. Never throws.

---

# Dependencies added (mobile)

| Package | Why |
|---|---|
| `expo-file-system` | Authenticated downloads, CSV picker |
| `expo-sharing` | Hand files to the OS share sheet |
| `react-native-maps` **1.27.2** | Race map. **Pinned** — SDK 57 rejects 1.29 |
| `expo-notifications`, `expo-device` | Push |

### Two consequences
1. **Expo Go no longer runs this app** — native modules. Use
   `eas build --profile development`.
2. **Android needs a Google Maps API key** — `app.json` →
   `android.config.googleMaps.apiKey`, currently empty. The map draws
   OpenStreetMap / OpenTopoMap / Esri tiles (same as the portal's Leaflet, no
   tile billing), but `react-native-maps` on Android still needs the key for the
   map container to initialise. **iOS needs nothing.**

---

# Verification at time of handover

| Check | Portal | Mobile |
|---|---|---|
| `tsc --noEmit` | clean | clean |
| Build | `next build` ✓ | Android 5.5 MB ✓ · iOS 5.4 MB ✓ |
| Lint (new files) | clean | clean |
| `rules-of-hooks` | — | 0 |
| Endpoints resolve | all new routes 401/200, never 404 | 37/37 |

## Not verified

**No write operation has been run against a live authenticated admin session.**
Paths, verbs, payload shapes and permission codes are verified against the route
source, and every route answers — but the round trip with real data is untested.

Highest-risk paths to exercise first:
1. Hotspot payment → PayPal capture → mask set
2. Basket a bird → race fee written · end race → cleared on loss
3. CSV import (multipart upload)
4. Report download (authenticated binary → share sheet)
5. Push send → device receives

---

# Outstanding

| # | Item | Where |
|---|---|---|
| 1 | Answer the 5 spec questions | `docs/payment-spec-questions.md` |
| 2 | Fix migration history (`PerchFeeItem`) | `prisma/migrations/20260309_schema_cleanup` |
| 3 | Google Maps API key | `app.json` |
| 4 | Decide bundle identifiers — both are `com.mobile.agn`, **permanent after publish** | `app.json` |
| 5 | App name is `agn`; login screen says "Pigeon pulse" | `app.json` |
| 6 | Replace Expo template assets (`react-logo*.png`) | `assets/images/` |
| 7 | `/api/admin/race-type` returns 200 unauthenticated | portal |
| 8 | Legacy payment types 6/7/8 unmapped (187 rows) | `TYPE_MAP` |
| 9 | `isFloatingBackup` enforced in HayLoft, not in portal | `docs/hayloft-comparison.md` |
| 10 | Drop `raceTypeId` from `prizeSchemeItemSchema` — validated then discarded | `src/lib/zod.ts` |
