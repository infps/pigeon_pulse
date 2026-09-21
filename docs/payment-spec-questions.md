# Payment spec — open questions

Everything in `payment-and-overlay-impl.md` is built and working. The spec's
own three open questions are answered below with what I implemented, plus two
more the build turned up.

**Nothing here is blocking.** Each has a working default. Marking an answer
changes one line in a named place — no rework.

---

## Q1 — Hotspot cascade: does paying one gate settle the others?

**This is the one that matters.** The spec answers it twice, differently.

**Task B4, under "Cascade rule":**
> If breeder pays HS1 → HS2, HS3, FINAL are still owed. If pays FINAL, earlier
> hotspots are considered satisfied.

**Task D table:**
> `hotSpot2FeeValue` — Can skip if paid HS1; or pay at HS2
> `hotSpot3FeeValue` — Can skip if paid HS1 or HS2; or pay at HS3
> `hotSpotFinalFeeValue` — Must pay at Final if didn't pay any prior

B4 says paying HS1 leaves HS2 owed. The D table says paying HS1 lets you skip
it. Both cannot hold.

### What I built

**B4's reading — `CUMULATIVE`.** It sits under a heading that says "Cascade
rule", which reads as the deliberate statement.

One constant controls it:

```ts
// src/lib/fee-calculator.ts
export const HOTSPOT_CASCADE: "CUMULATIVE" | "SINGLE" = "CUMULATIVE";
```

Flip it to `"SINGLE"` and billing, the amount owed, the breeder's fee table and
the settle-on-capture logic all follow. Nothing else changes.

### One thing worth checking before you answer

Fee scheme 4 in your live HayLoft database — the one used by *American
Showcase* — is priced:

| Gate | Amount |
|---|---|
| Hotspot 1 | $200 |
| Hotspot 2 | $400 |
| Hotspot 3 | $800 |
| Final | not set |

Alongside a **$500 entry fee**, **$100 per bird** perch fee, and a **10-bird**
maximum.

Under each reading, a full 10-bird entry comes to:

| | Entry | Perch | Hotspot | **Total** |
|---|---|---|---|---|
| `CUMULATIVE` (built) | $500 | $1,000 | $14,000 | **$15,500** |
| `SINGLE` | $500 | $1,000 | $2,000 | **$3,500** |

The prices double at each gate. That is the shape of a late fee — a penalty for
leaving it — which only bites if paying early ends the obligation. If all four
are owed regardless, escalating them charges the most to whoever pays on time.

I may be reading the domain wrong, and you know what breeders were actually
charged. **If $15,500 is right for a full entry, leave it as built.**

> ☐ Cumulative — every gate its own charge *(as built)*
> ☐ Single — one fee, four prices, paying any ends it

---

## Q2 — Race fee: flat, or per race type?

> *"Is the fee the same for all race types (flat per bird), or does it vary by
> race type using `RaceTypeFeeScheme`?"*

### There is no legacy answer

HayLoft has **no race-fee concept at all** — no `RACE_FEE` column, no rate
table, nothing across 48 tables and 113 stored procedures.

But payment type `2` (`RACES_FEE`) holds **1,071 rows totalling $313,215**. Race
fees were charged; they were keyed in by hand as payments, never modelled.

So this is a genuinely new decision. Nothing to match.

### What I built

**Per race type, via `RaceTypeFeeScheme`** — the richer option, with flat as a
special case (set every race type to the same rate).

`raceFeeMode` is honoured:
- `PER_BIRD_PER_RACE` — each bird pays the full rate
- `FLAT_PER_RACE` — the rate is **divided across the birds flying**, so a fee
  named once is collected once rather than once per bird

> ☐ Per race type *(as built)*
> ☐ Flat per bird regardless of race type

---

## Q3 — Purge fee: block registration, or just flag it?

> *"Should the system block registration if the purge fee is not paid, or just
> flag it in the defaulters tab?"*

### What I built

**Neither, quite — it gates *basketing*, not registration**, which is what
Task D1 describes:

> This gates basketting in `scan-loft/route.ts`: before assigning basket, check
> payment status … If `priorToHotspot1Required=true` and status is PENDING,
> reject with 402.

`FeeScheme.priorToHotspot1Required`, **off by default**. When on, `scan-loft`
returns 402 with the amount owed and the shortfall named.

Two deliberate choices:

- **Off by default.** Turning a scanner into a debt collector is an organiser's
  decision, and a default that starts refusing birds at a basketing table would
  be discovered at the worst moment.
- **`cashPromised` counts as settled.** That flag exists for the breeder paying
  at the door, and the ledger honours it everywhere else.

> ☐ Gate basketing, off by default *(as built)*
> ☐ Also block registration itself
> ☐ Flag in defaulters only, never block

---

## Q4 — Legacy payment types 6, 7 and 8 *(new)*

`TYPE_MAP` in `src/app/api/admin/payment/route.ts` covers 0–4:

```ts
{ PERCH_FEE: 0, BIRD_FEE: 1, RACES_FEE: 2, PAYOUTS: 3, OTHER: 4 }
```

The legacy data also uses **6, 7 and 8** — 187 rows:

| Type | Rows | Total |
|---|---|---|
| 6 | 9 | −$2,050 |
| 7 | 86 | +$33,612 |
| 8 | 92 | −$24,133 |

Types 6 and 8 are negative, so they behave like refunds. `paymentStatus.ts`
treats only type `3` as money out and everything else as money in — so these
187 rows are classified by a map that does not know they exist.

The arithmetic still works (negative values sum correctly), but nothing can
name them, and any new logic keyed on payment type will mis-handle them.

**What were 6, 7 and 8 used for?**

> ☐ Map them (please say what each means): ______________________
> ☐ Migrate them onto existing types
> ☐ Leave as-is — historical only, no new rows will use them

---

## Q5 — Race fees in the registration total *(new)*

Task C says race fees are charged per bird at basketing, and that
`calculateFees`'s `raceFees` output is "only used for the UI preview total".

Both are implemented. But that leaves one thing unstated: **the pending payment
raised at registration still includes race fees in its amount**, because it is
built from `fees.total`.

So a breeder registering 10 birds is asked to pay race fees for 10 — then only
the birds actually basketed carry the charge on their item rows. The two
figures disagree until the ledger is recomputed.

### What I built

Left as the spec has it — `total` includes race fees, and the breeder's fee
table labels them **"Race Fees (later)"** in muted text, with a note explaining
they are charged per bird at basketing.

The alternative is to drop race fees from the registration payment entirely and
raise a second payment after basketing, which is cleaner but more moving parts.

> ☐ Keep race fees in the registration total *(as built)*
> ☐ Bill race fees separately after basketing

---

## Also worth knowing

**Prisma migrations are broken, and it predates this work.**
`prisma migrate dev` fails: migration `20260309_schema_cleanup` cannot replay
against a shadow database because it references `PerchFeeItem`, a model since
renamed to `BirdFeeItem`.

Schema changes were applied with `prisma db push`, which is what the rest of
this project already does — **the database is live and correct**. But the
migration history cannot be replayed onto a fresh database, which matters the
first time someone tries to stand up a new environment.

Worth a separate fix, independent of anything in this spec.
