# Scheme wiring audit

*What is connected, what only looks connected, and what is stored but never acted on.*

Audited against `prisma/schema.prisma`, `src/lib/fee-calculator.ts`,
`src/lib/race-results.ts`, `src/lib/bird-substitution.ts` and the
`/api/admin/*-scheme` routes.

> **Updated** after reading the legacy Firebird database at
> `C:\Hayloft\HAYLOFT.FDB`. Two open questions below are now settled against the
> original, and one new regression was found. See `hayloft-comparison.md`.

---

## Summary

The three scheme families — fees, prizes, betting — are genuinely wired to the
season and genuinely drive calculation. No orphaned relations were found.

Three things are not what they appear:

1. **"Bird fee" and "perch fee" are one table under two names.**
2. **`raceTypeId` on prize bands is validated and then discarded** — the column
   does not exist.
3. **Six fee-scheme settings are stored, displayed and reported, but never
   enforced.** Two of them matter.

---

## 1. Connected and working

| Scheme | Attached via | Drives |
|---|---|---|
| Fee scheme | `Season.feeSchemeId` | `calculateFees()` — purge, perch, race, hotspot |
| Perch fees | `BirdFeeItem.feeSchemeId` | Graduated per-bird table, repriced by `recalcPerchFees` |
| Race-type fees | `RaceTypeFeeScheme` (composite PK) | Per-race charge, honouring `raceFeeMode` |
| Hotspot fees | `hotSpot1–3Fee` + `hotSpotFinalFee` | Summed per bird onto `hotSpotFeeValue` |
| Betting scheme | `Season.bettingSchemeId` | Tier stakes, house cut, Belgian ratio, show percentages |
| Prize schemes | 5 slots on `Season` | Selected by `RaceType.prizeRole` |

### How fees compose

`calculateFees()` is a pure function with no database dependency, shared by the
API routes and the registration UI so both arrive at the same number:

```
purgeFee   = feeScheme.entryFee                      // flat, once per registration
perchFees  = Σ birdFeeItems[birdNo].birdFee          // graduated by bird position
raceFees   = Σ raceTypeFees[race.raceTypeId].fee     // × numBirds if PER_BIRD_PER_RACE
hotspot    = (hotSpot1 + hotSpot2 + hotSpot3 + final) × numBirds
total      = purgeFee + perchFees + raceFees + hotspot
```

### How prizes are routed

The five prize-scheme slots on `Season` are not chosen by hand at award time.
A race type declares what it is for, and `schemeForRole()` resolves the slot:

| `RaceType.prizeRole` | Season slot |
|---|---|
| `FINAL` | `finalPrizeSchemeId` |
| `HOTSPOT_1` | `hotSpot1PrizeSchemeId` |
| `HOTSPOT_2` | `hotSpot2PrizeSchemeId` |
| `HOTSPOT_3` | `hotSpot3PrizeSchemeId` |
| `AVERAGE` | `hotSpotAvgPrizeSchemeId` |

This is a clean design and worth keeping. It means a season can carry five
different prize tables at once without any screen having to ask which applies.

### How betting stakes resolve

Tier amounts are read off the scheme by constructed field name — `belgianShow1`
through `belgianShow7`, `standardShow1` through `standardShow6`, `wta1` through
`wta5`. Five separate call sites build the same field map:

- `admin/race/[raceId]/betting/place-cash-bet`
- `breeder/race/[raceId]/bet`
- `payment/paypal/create-bet-order`
- `payment/paypal/capture-bet-order`
- `lib/betting-pools.ts`

Payout uses `bettingCutPercent`, `belgianRatio` and `standardShowPercentages`.
All betting-scheme columns are consumed somewhere.

> **Note:** the field map is duplicated at five sites rather than shared. Adding
> an eighth Belgian tier would mean five edits, and missing one would fail
> silently on a subset of routes.

---

## 2. Naming: perch fee and bird fee are the same thing

```prisma
model BirdFeeItem {
  id          Int  @id @default(autoincrement()) @map("ID_PERCH_FEE_ITEM")
  birdNo      Int? @map("BIRD_NO")
  birdFee     Int? @map("PERCH_FEE")   // ← this is the perch fee
}
```

The model is `BirdFeeItem`, the property is `birdFee`, the column is
`PERCH_FEE`, and the primary key is `ID_PERCH_FEE_ITEM`. The raw SQL in
`recalcPerchFees` reads `PERCH_FEE` directly; `calculateFees()` reads `birdFee`
and reports it as `perchFees`.

There is no separate perch-fee table. Same data, three names depending on which
layer you are standing in. Not broken — but it will mislead anyone reading the
code cold, and it already produced a fourth name ("Fee per bird") in the mobile
app's scheme editor.

**Recommendation:** rename the Prisma property `birdFee` → `perchFee` and the
model `BirdFeeItem` → `PerchFeeItem`. The `@map` keeps the physical column
untouched, so this is a code-only change with no migration.

---

## 3. Bug: `raceTypeId` on prize bands is validated, then dropped

`src/lib/zod.ts` **requires** it:

```ts
export const prizeSchemeItemSchema = z.object({
    raceTypeId: z.number().int().positive("Race type ID is required"),
    fromPosition: z.number().int().positive(),
    toPosition: z.number().int().positive(),
    prizeValue: z.number().nonnegative(),
})
```

`prisma/schema.prisma` has **no such column**:

```prisma
model PrizeSchemeItem {
  id            Int    @id @map("ID_PRIZE_SCHEME_ITEM")
  prizeSchemeId Int?   @map("ID_PRIZE_SCHEME")
  fromPosition  Int?   @map("FROM_POSITION")
  toPosition    Int?   @map("TO_POSITION")
  prizeValue    Float? @map("PRIZE_VALUE")
}
```

And the handler writes only three of the four fields — `raceTypeId` goes on the
floor.

It is redundant *by design*: the race type is already implied by which of the
five season slots the scheme is plugged into. But the validator still demands
it, so every client has to invent a value to get past validation, and any UI
that displays bands grouped by race type is showing something that was never
stored.

**Impact:** the mobile app's prize-band editor asks for a race type per band and
groups the list by it. After a save and reload that grouping is meaningless.

**Recommendation:** drop `raceTypeId` from `prizeSchemeItemSchema`. Validating a
field that is discarded is a trap for whoever writes the next client.

---

## 4. Stored, shown, never enforced

| Field | Appears in | Enforced anywhere? |
|---|---|---|
| `maxBirdCount` | Portal register UI, fee-scheme editor, report | **No server-side check** |
| `feesCutPercent` | Dashboard stat, report ("Admin cut") | **Never deducted** |
| `minEntryFees` | Report ("Minimum total fee") | Never applied to a total |
| `isRefundable` | Report ("Entry fee refundable") | No |
| `maxBackupBirdCount` | Report ("Maximum backup birds") | No |
| `isFloatingBackup` | Report ("Floating backups") | No |

### Settled against HayLoft

`MAX_BIRD_COUNT`, `MIN_ENTRY_FEES` and `FEES_CUT_PERCENT` appear in HayLoft's
113 stored procedures **only as CRUD parameters**. No procedure branches on
them. So these were never enforced in the original either — the portal
inherited the behaviour rather than losing it. They have been fee-scheme report
fields since 2011.

`IS_FLOATING_BACKUP` is the exception, and it **was** enforced — see the
regression noted in `hayloft-comparison.md`.

### Still worth acting on

The last four are documentation fields — printed on the fee-scheme sheet so a
breeder can read the rules. Harmless as long as nobody expects the system to
apply them.

The first two are different:

**`maxBirdCount`** is honoured by `register-tab.tsx` in the portal and used to
size the perch-fee table in `fee-scheme-component.tsx`, but no API route checks
it. A direct API call — **or the mobile app** — can register past the limit the
web UI enforces.

**`feesCutPercent`** is labelled "Admin cut — percent of fees collected" on the
dashboard and in the fee-scheme report. The ledger in `accounting.ts` never
subtracts it. The number on screen is not money that has moved.

---

## Recommended order of work

1. **Enforce `maxBirdCount` server-side** in the register routes. This is the
   only finding that can currently produce wrong data, and the mobile app makes
   it reachable.
2. **Drop `raceTypeId` from `prizeSchemeItemSchema`** and fix the mobile
   prize-band editor to match.
3. **Decide on `feesCutPercent`** — apply it in `accounting.ts`, or stop
   presenting it as though it has been applied.
4. **Rename bird fee → perch fee** in the Prisma model. Cosmetic, no migration,
   removes a standing source of confusion.
5. **Share the betting tier field map** rather than rebuilding it at five sites.
