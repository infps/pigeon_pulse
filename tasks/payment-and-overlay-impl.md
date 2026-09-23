# Payment System + Live Overlay — Implementation Spec

## Current State Audit (read before touching anything)

### What IS wired

| Piece | Location | Status |
|---|---|---|
| Fee schema | `FeeScheme` model — `entryFee`, `hotSpot1-3Fee`, `hotSpotFinalFee`, `birdFeeItems[]`, `raceTypeFees[]` | ✅ |
| Fee math | `src/lib/fee-calculator.ts` — `calculateFees()` | ✅ |
| Fee writing at registration | `api/breeder/event/[eventId]/register/route.ts:289-315` — writes `entryFeeValue`, `perchFeeValue`, `hotSpotFeeValue`, `raceFeeValue` onto each `EventInventoryItem` | ✅ |
| Payment record creation | Same route:326 — single PENDING `Payment` row for full amount at registration | ✅ |
| Payment status computation | `src/lib/paymentStatus.ts` — `computePaymentStatus()` sums item fee fields vs payments | ✅ |
| Breeder payments list page | `src/app/payments/page.tsx` | ✅ |
| Bet stake + registration combined | Single payment record folds both | ✅ |

### What is NOT wired (gaps to fix)

1. **Fee breakdown per bird not shown to breeder** — register tab shows a total but no per-bird line items (perch fee by position, per-race fee, hotspot fee per bird).
2. **Hotspot fees are bucketed together** — `fee-calculator.ts:52-55` sums ALL hotspot fees into one `hotspotPerBird`. There is no per-hotspot selective payment (pay HS1 only, defer HS2/3/final).
3. **Race fee charged for ALL birds at registration** — `raceFeePerBird` is computed from total `fees.raceFees / numBirds` at registration time. Lost birds still carry this fee. No adjustment at basketting time.
4. **No "pay for specific race/hotspot" UI** — no route or page lets breeder choose "I want to pay for Hotspot 1 only".
5. **Payout disbursement not tracked** — see separate gaps doc.
6. **Breeder can't see what each bird owes** — no API or UI that shows per-`EventInventoryItem` fee breakdown post-registration.

---

## Task A — Per-Bird Fee Breakdown (show breeder what they owe per bird)

### A1. API: `GET /api/breeder/event/[eventId]/fee-breakdown`

New route. Returns fee breakdown for the logged-in breeder's registration for this event/season.

```ts
// Response shape
{
  eventInventoryId: number,
  totalOwed: number,
  totalPaid: number,
  balance: number,  // positive = still owes
  items: Array<{
    inventoryItemId: number,
    birdNo: number,
    band: string,
    birdName: string | null,
    entryFeeValue: number,   // purge fee (only bird #1)
    perchFeeValue: number,   // per-bird per-position fee
    hotSpotFeeValue: number, // sum of all hotspot fees for this bird
    raceFeeValue: number,
    total: number,
    raceItems: Array<{ raceId: number, raceName: string, status: RaceItemStatus }>
  }>,
  payments: Array<{ id, value, status, date, desc }>
}
```

Query logic:
- Find `EventInventory` for this breeder+season
- Include `items` with fee fields + `bird` for band/name + `raceItems` for status
- Include `payments` on the `EventInventory`
- Compute `totalOwed` = sum of all item fee fields; `totalPaid` from PAID payments using `computePaymentStatus`

### A2. UI: Fee breakdown card in event register tab

In `src/app/events/[eventId]/event-register-tab.tsx`, after registration, show a table:

| Bird # | Band | Perch Fee | Hotspot Fee | Race Fee | Total | Status |
|---|---|---|---|---|---|---|
| 1 | AU25-XYZ | $20 | $40 | $10 | $70 | |
| 2 | AU25-ABC | $18 | $40 | $10 | $68 | |

Below table: "Total owed: $X · Paid: $Y · Balance: $Z"

---

## Task B — Per-Hotspot Selective Payment

### B1. Schema change

Current: `EventInventoryItem.hotSpotFeeValue` is one blob for all hotspots.

Add four separate fields to `EventInventoryItem`:

```prisma
hotSpot1FeeValue  Float? @map("HOT_SPOT1_FEE_VALUE")
hotSpot2FeeValue  Float? @map("HOT_SPOT2_FEE_VALUE")
hotSpot3FeeValue  Float? @map("HOT_SPOT3_FEE_VALUE")
hotSpotFinalFeeValue Float? @map("HOT_SPOT_FINAL_FEE_VALUE")
```

Migration: `npx prisma migrate dev --name add_per_hotspot_fee_values`

Keep `hotSpotFeeValue` as legacy computed total (sum of the four above) — don't remove it, just stop writing it as a blob.

### B2. Update fee-calculator.ts

Change `FeeBreakdown`:
```ts
export interface FeeBreakdown {
  purgeFee: number;
  perchFees: number;
  raceFees: number;
  hotspot1Fees: number;  // new
  hotspot2Fees: number;  // new
  hotspot3Fees: number;  // new
  hotspotFinalFees: number; // new
  hotspotFees: number;   // keep as total for backwards compat
  total: number;
  perBirdBreakdown: PerBirdFees[];
}

export interface PerBirdFees {
  position: number;
  perchFee: number;
  hotspot1Fee: number;  // new
  hotspot2Fee: number;  // new
  hotspot3Fee: number;  // new
  hotspotFinalFee: number; // new
  hotspotFee: number;   // keep as total
}
```

### B3. Update registration routes to write split fields

In both `api/breeder/event/[eventId]/register/route.ts` and `api/admin/event/[eventId]/register/route.ts`, replace the `hotSpotFeeValue` write with the four split values.

### B4. Payment route for selective hotspot payment

New route: `POST /api/breeder/event/[eventId]/pay-hotspot`

```ts
// Body
{ hotspot: "HS1" | "HS2" | "HS3" | "FINAL", paymentMethod: "PAYPAL" | "CASH" }
```

Logic:
1. Find breeder's `EventInventory` for this event/season
2. Compute amount = sum of `hotSpot{N}FeeValue` across all their items
3. Check they haven't already paid this hotspot (scan existing payments by desc or add a `hotspot` tag on Payment)
4. Create PENDING `Payment` with `paymentType=2` (race fee), desc `"Hotspot 1 entry fee"`, amount
5. Return PayPal order or mark PAID for cash

**Cascade rule:** If breeder pays HS1 → HS2, HS3, FINAL are still owed. If pays FINAL, earlier hotspots are considered satisfied (they can fly in all, paying just at the end). This is a business rule checked at `defaulters` gate.

Add `hotspotPaid` flags (or use existing payment scan) to the fee-breakdown endpoint to show which hotspots are paid.

---

## Task C — Race Fee Charged Only for Basketted Birds

### C1. Current problem

At registration, `raceFeeValue` is written as `fees.raceFees / numBirds` for every bird regardless of whether it flies. A bird lost before basketting still carries a race fee.

### C2. Fix: Zero out race fee at basketting

In `api/admin/event/[eventId]/baskets/scan-loft/route.ts` (and `generate-loft`), when a bird is basketted:
- Do nothing to the fee (it was already set at registration — this bird IS flying)

In `api/admin/race/[raceId]/end/route.ts` (race end) or wherever birds are marked LOST:
- When a `RaceItem` is set to `LOST` status, zero `raceFeeValue` on its `EventInventoryItem`:
  ```ts
  await prisma.eventInventoryItem.update({
    where: { id: raceItem.inventoryItemId },
    data: { raceFeeValue: 0 }
  })
  ```
- This automatically reduces `totalOwed` in `computePaymentStatus` since it sums the fee fields

**Key:** Birds that were never basketted (stayed home) should have `raceFeeValue = 0` from the start. Currently they get a raceFee share. Fix: only write `raceFeeValue` for birds that reach LOFT_BASKETED status — so at registration time, write 0 and update to the fee amount when the bird is scanned into a loft basket.

Concretely:
1. At registration (`register/route.ts`): write `raceFeeValue: 0` for all birds
2. At loft basketting (`scan-loft/route.ts`): update `raceFeeValue = season.feeScheme.raceTypeFees fee / 1` (the per-bird amount from the fee scheme for this race's type)

This means fee-calculator's `raceFees` output is no longer used at registration time for writing to items — only used for the UI preview total.

---

## Task D — Payment Timing / When Each Fee Is Due

Current model has NO enforcement of payment timing. All fees are lumped into one PENDING record. The business rules the client wants:

| Fee | When due | Current state |
|---|---|---|
| `entryFee` (Purge Fee) | **Before Hotspot 1** (one-time registration fee) | Written at registration, collected in combined PENDING payment — no enforcement ❌ |
| `perchFeeValue` (Per-Bird Fee) | Before Hotspot 1 | Same ❌ |
| `hotSpot1FeeValue` | Before Hotspot 1 race starts | Combined ❌ |
| `hotSpot2FeeValue` | Can skip if paid HS1; or pay at HS2 | Not modeled ❌ |
| `hotSpot3FeeValue` | Can skip if paid HS1 or HS2; or pay at HS3 | Not modeled ❌ |
| `hotSpotFinalFeeValue` | Must pay at Final if didn't pay any prior | Not modeled ❌ |
| `raceFeeValue` | After basketting (only birds that flew) | Charged upfront for all ❌ |

### D1. Add payment phase tracking to FeeScheme

Optionally add a config field:
```prisma
// On FeeScheme
priorToHotspot1Required Boolean @default(false) @map("PRIOR_TO_HS1_REQUIRED")
```

When `true`, `entryFee + perchFee + hotSpot1Fee` must be PAID before a bird can be basketted for Hotspot 1.

This gates basketting in `scan-loft/route.ts`: before assigning basket, check payment status of the breeder's `EventInventory`. If `priorToHotspot1Required=true` and status is PENDING, reject with 402.

### D2. Hotspot cascade rule

The "pay for one hotspot = skip prior ones" rule needs to be tracked. Simplest approach: add a `hotspotsPaidMask` column on `EventInventory`:

```prisma
hotspotsPaidMask Int @default(0) @map("HOTSPOTS_PAID_MASK")
// bit 0 = HS1 paid, bit 1 = HS2 paid, bit 2 = HS3 paid, bit 3 = FINAL paid
```

When breeder pays HS2, set bits 0+1 (HS1 obligation waived). When pays FINAL, set all bits.

Alternative simpler approach (recommended): track via Payment rows with tagged `paymentDesc` ("Hotspot 1 fee", "Final fee") and resolve in `computePaymentStatus` — no schema change needed, just logic in the fee-breakdown endpoint.

---

## Task E — OBS Live Overlay Page

### E1. Schema change on Race

Add to `Race` model in `schema.prisma`:
```prisma
facebookStreamUrl  String?  @map("FACEBOOK_STREAM_URL")
facebookPageUrl    String?  @map("FACEBOOK_PAGE_URL")
```

Migration: `npx prisma migrate dev --name add_race_facebook_stream`

Add both fields to `Race` type in `src/lib/types.ts` (already has `youtubeUrl` at line ~382).

### E2. Admin race edit — stream URL inputs

In admin race edit form (grep codebase for `youtubeUrl` to find exact file), add:
- "YouTube URL" (existing field — verify it saves)
- "Facebook Stream Embed URL" → saves `facebookStreamUrl`
- "Facebook Live Page URL" → saves `facebookPageUrl`

### E3. Go-live tab — Facebook support

File: `src/app/races/[raceId]/go-live-tab.tsx`

Add alongside `getYouTubeEmbedUrl`:
```ts
function getFacebookEmbedUrl(url: string): string | null {
  try {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true&mute=true`;
  } catch { return null; }
}
```

Logic: YouTube → Facebook → placeholder (current order of priority). Add "Watch on Facebook →" button below player if `race.facebookPageUrl` set.

### E4. New OBS overlay page

**File:** `src/app/overlay/race/[raceId]/page.tsx`

Requirements:
- No layout/navbar — standalone page
- `<html style="background:transparent">` — transparent for OBS browser source
- `export const dynamic = "force-dynamic"`
- No auth required — display only (reads public race data)
- Poll `GET /api/breeder/races?raceId=X` + existing race items endpoint every 5s

**Layout:**
```
[LEFT PANEL — 340px wide, full height]
  "LATEST ARRIVALS" header
  TOP 10 section (highlighted rows): rank | loft name (bold) | band (mono small) | speed | arrival time
  divider
  remaining arrivals (dimmer)
  
[BOTTOM TICKER — full width, ~50px]
  scrolling marquee: #1 LOFT_NAME band YPM · #2 ... (CSS animation, loops)
  
[LAST SCAN CARD — bottom center, above ticker]
  appears 8s after each new arrival then fades
  contains: rank badge | loft logo circle | loft name (large bold) | band + speed + breeder | arrival + gap
```

Styling: dark (`bg-black/70`), white text, semi-transparent panels. Designed to overlay on any OBS video source.

**Data source:** reuse `/api/breeder/races` (already exists, public). Poll every 5s. Track `lastArrivedId` in state — when it changes, show the last-scan card for 8s.

### E5. Admin OBS link display

In the admin race page, add a read-only field:
```
OBS Browser Source URL: https://[host]/overlay/race/[raceId]
[Copy] button
```
With note: "In OBS: Sources → Browser → paste URL → 1920×1080 → check 'Page background transparent'"

---

## Files Changed Summary

| File | Change | Task |
|---|---|---|
| `prisma/schema.prisma` | +4 hotspot fee fields on `EventInventoryItem`, +2 stream fields on `Race` | B1, E1 |
| `prisma/migrations/…` | 2 migrations | B1, E1 |
| `src/lib/fee-calculator.ts` | Split hotspot fees into 4 fields in breakdown | B2 |
| `src/lib/types.ts` | +2 stream fields on Race type | E1 |
| `api/breeder/event/[eventId]/register/route.ts` | Write split hotspot fees; write `raceFeeValue: 0` | B3, C2 |
| `api/admin/event/[eventId]/register/route.ts` | Same | B3, C2 |
| `api/admin/event/[eventId]/baskets/scan-loft/route.ts` | Write `raceFeeValue` when bird basketted | C2 |
| `api/admin/race/[raceId]/end/route.ts` | Zero `raceFeeValue` on LOST birds | C2 |
| `api/breeder/event/[eventId]/fee-breakdown/route.ts` | **NEW** — per-bird fee breakdown | A1 |
| `api/breeder/event/[eventId]/pay-hotspot/route.ts` | **NEW** — selective hotspot payment | B4 |
| `src/app/events/[eventId]/event-register-tab.tsx` | Add per-bird fee table after registration | A2 |
| `src/app/overlay/race/[raceId]/page.tsx` | **NEW** — OBS overlay | E4 |
| `src/app/races/[raceId]/go-live-tab.tsx` | Facebook embed + page link | E3 |
| Admin race edit form | Stream URL inputs + OBS link display | E2, E5 |

---

## Open Questions (answer before implementing D)

1. **Hotspot payment cascade direction:** "pays HS1 → later ones still owed, pays FINAL → all satisfied" — does paying HS2 also satisfy HS1 (i.e. you can jump in at any hotspot)? Or must you pay sequentially?
2. **Race fee per basketted bird:** is the fee the same for all race types (flat per bird), or does it vary by which race type (A/B/C/Final) using `RaceTypeFeeScheme`?
3. **Purge fee due date enforcement:** should the system block registration if purge fee is not paid, or just flag it in the defaulters tab?
