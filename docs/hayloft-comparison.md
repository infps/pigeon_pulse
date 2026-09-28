# HayLoft vs. the portal — comparison report

*Built by reading the live legacy database, not by inference.*

**Source:** `C:\Hayloft\HAYLOFT.FDB` (191 MB), schema extracted read-only with
Firebird 2.0 `isql`. Application binary `HayLoft.exe` (6.2 MB, 31 Jan 2011),
config `HayLoft.properties`, and 11 FastReport templates in `reports\`.

---

## What HayLoft is

| | |
|---|---|
| **Database** | Firebird, SQL dialect 3, accessed through `gds32.dll` |
| **Client** | Delphi desktop application using FIBPlus components |
| **Reporting** | FastReport — 11 `.fr3` templates |
| **Scanner** | Serial, `COM1` @ 19200 8-O-1, `scanner_type=lg` |
| **Web link** | One-way outbox (`DATASYNC_WEB`), `upload.url` in config |

### Database objects

| Object | Count |
|---|---|
| Business tables | **48** |
| Audit tables (`IBE$*`, IBExpert) | 4 |
| Stored procedures | **113** distinct |
| Triggers | 12 |
| Generators (sequences) | 37 |

The business logic lives **inside the database**. The Delphi client is largely a
form over stored procedures — `SYSTEM_LOGIN`, `RACE_CLOSE`, `RACE_RECALC` and
110 others.

---

## Live data in the legacy database

| Table | Rows |
|---|---|
| `RACE_ITEM` | 377,722 |
| `RACE_ITEM_RESULT` | 350,927 |
| **`RACE_PHANTOM_BIRD`** | **31,487** |
| `BIRDS` / `EVENT_INVENTORY_ITEM` | 11,620 |
| `DATASYNC_WEB` | 8,112 |
| `PAYMENTS` | 7,144 |
| `RACE_ITEM_SCAN` | 2,521 |
| `EVENT_INVENTORY` | 2,295 |
| `BREEDERS` | 1,330 |
| `RACE` | 718 |
| **`RACE_IGNORE_BIRD`** | **612** |
| `PRIZE_VALUE` | 261 |
| `PRIZE_SCHEME` | 24 |
| `EVENTS` | 19 |
| `FEE_SCHEME` | 11 |
| `BETTING_SCHEME` | 3 |
| **`RIGHT_GROUP_LINES`** | **4** |
| **`RIGHT_GROUPS`** | **1** |
| **`USERS`** | **1** |

Three of these deserve attention.

**`USERS` = 1.** The entire system ran on a single account (`last.user=ADMIN` in
the config). Whatever HayLoft's permission model could express, in practice
nobody was ever distinguished from anybody else.

**`RIGHT_GROUPS` = 1, `RIGHT_GROUP_LINES` = 4.** This matches the note in
`src/lib/permissions.ts` word for word — "production carried exactly one group
with four lines." The porting comments are accurate.

**`RACE_PHANTOM_BIRD` = 31,487 and `RACE_IGNORE_BIRD` = 612** likewise match the
counts recorded in the portal's comments exactly.

---

## Table coverage: complete

Every core HayLoft business table has a portal model:

| HayLoft | Portal | HayLoft | Portal |
|---|---|---|---|
| `BIRDS` | `Bird` | `PRIZE_SCHEME` | `PrizeScheme` |
| `BREEDERS` | `Breeder` | `PRIZE_SCHEME_ITEM` | `PrizeSchemeItem` |
| `EVENTS` | `Event` | `PRIZE_VALUE` | `PrizeValue` |
| `EVENT_INVENTORY` | `EventInventory` | `BETTING_SCHEME` | `BettingScheme` |
| `EVENT_INVENTORY_ITEM` | `EventInventoryItem` | `STANDARD_SHOW_PERCENTAGE` | `StandardShowPercentage` |
| `RACE` | `Race` | `PAYMENTS` | `Payment` |
| `RACE_ITEM` | `RaceItem` | `BASKET` | `EventBasket` |
| `RACE_ITEM_RESULT` | `RaceItemResult` | `PARTNERS` | `Partner` |
| `RACE_ITEM_SCAN` | `RfidScan` | `LOST_HISTORY` | `LostHistory` |
| `RACE_PHANTOM_BIRD` | `RacePhantomBird` | `ORGANIZER_DATA` | `OrganizerData` |
| `RACE_IGNORE_BIRD` | `RaceIgnoreBird` | `RACE_TYPE` | `RaceType` |
| `FEE_SCHEME` | `FeeScheme` | `PICTURE` | `BirdImage` |
| `PERCH_FEE_ITEM` | `BirdFeeItem` | `AVG_WINNER_PRIZES` | `AverageConfig` |

Not carried across, deliberately:

- `RIGHT_GROUPS` / `RIGHT_GROUP_LINES` / `USER_RIGHT_GROUPS` — replaced by the
  23-module permission system
- `REPORTS` / `REPORT_CLASSES` / `REPORT_IDS` — report definitions moved into
  code (`src/lib/reports/definitions.ts`)
- `SYSTEM_CFG` / `SYSTEM_INFO` / `SYSTEM_REQUIREMENTS` / `SYSTEM_SESSION` /
  `SYSTEM_UPDATES` — desktop install and update plumbing
- `TMP_AVG_SPEED` / `TMP_BETS` / `TMP_ID` — scratch tables for procedures
- `LOG` / `LOG_USER_LOGGEDIN` / `LOG_USER_LOGGEDOUT` — desktop logging
- `DATASYNC_SYS` / `DATASYNC_WEB` — the web outbox, obsolete once the system
  *is* the web application

---

## The biggest structural change: seasons

**HayLoft has no concept of a season.** The word appears **zero** times in the
entire schema.

In HayLoft, every scheme hangs directly off the event:

```sql
CREATE TABLE EVENTS (
  ID_EVENT, EVENT_NAME, EVENT_SHORT_NAME, EVENT_DATE,
  ID_FEE_SCHEME,
  ID_FINAL_PRIZE_SCHEME,
  ID_HOT_SPOT1_PRIZE_SCHEME, ID_HOT_SPOT2_PRIZE_SCHEME,
  ID_HOT_SPOT3_PRIZE_SCHEME, ID_HOT_SPOT_AVG_PRIZE_SCHEME,
  ID_BETTING_SCHEME, IS_OPEN, EVENT_TYPE
);
```

The portal inserted `Season` between `Event` and everything else, and moved all
seven scheme references onto it. That is why the same event can run year after
year with different pricing, and why season cloning exists at all. With 19
events and no seasons, HayLoft's answer to "run it again next year" was to
create another event.

This is the change with the widest blast radius, and it is the right one.

---

## Questions this settles

Three findings from `scheme-wiring-audit.md` were open pending access to
HayLoft. All three are now answered.

### 1. `maxBirdCount`, `minEntryFees`, `feesCutPercent` — HayLoft did not enforce them either

Searching all 113 procedures, these columns appear **only** as procedure
parameters on the fee-scheme CRUD routines. No procedure branches on them. The
single logic-level hit for `MAX_BIRD_COUNT` is an unrelated local variable
inside `BREEDER_AVG_SPEED_GET`.

**The portal is not behind here — it inherited the same non-enforcement.**
These have been presentation fields for the fee-scheme report since 2011.

That said: `maxBirdCount` is now honoured by the portal's own registration UI
while the API ignores it, so the mobile app can breach a limit the web screen
respects. Worth closing regardless of what HayLoft did.

### 2. `raceTypeId` on prize bands — confirmed spurious

```sql
CREATE TABLE PRIZE_SCHEME_ITEM (
  ID_PRIZE_SCHEME_ITEM, FROM_POSITION, TO_POSITION,
  PRIZE_VALUE, ID_PRIZE_SCHEME
);
```

No race type — identical to the portal. The race type lives on `PRIZE_VALUE`,
which joins *(event, race type, band)* to an amount. `GET_PRIZE_VALUE` proves
it:

```sql
join PRIZE_VALUE pv
  on pv.ID_PRIZE_SCHEME_ITEM = psi.ID_PRIZE_SCHEME_ITEM
 and pv.ID_EVENT = :ID_EVENT
 and pv.ID_RACE_TYPE = :ID_RACE_TYPE
```

**The portal's `calcRacePrizes` reproduces this join faithfully**, substituting
`SEASON_ID` for `ID_EVENT`. So the engine is correct and
`prizeSchemeItemSchema` requiring `raceTypeId` is simply wrong — it should be
removed, and any UI grouping bands by race type is showing something that was
never stored.

### 3. `isFloatingBackup` — **HayLoft enforced this and the portal does not**

This is a genuine regression, and the only one found.

`BIRD_LOST_STATUS_MODIFY` reads the event's fee scheme and, when a bird is
marked lost, automatically applies a backup if the scheme allows floating
backups:

```sql
if ((IS_LOST = 1) and (IS_FLOATING_BACKUP_SCHEME = 1)) then begin
  execute procedure BIRD_BACKUP_APPLY(:ID_BIRD);
end
execute procedure BIRD_REFUNDS_MODIFY(:ID_RACE, :ID_BIRD, :IS_LOST);
```

The portal **has** `BIRD_BACKUP_APPLY` ported as `applyBackup()` — but it is
only ever called from the manual substitution route. Marking a bird lost does
not trigger it, and `isFloatingBackup` appears nowhere except the fee-scheme
CRUD route.

**Effect:** on a floating-backup scheme, HayLoft would automatically bring in a
reserve when a bird was lost. The portal requires an operator to notice and do
it by hand. Whether the refund side (`BIRD_REFUNDS_MODIFY`) has an equivalent
trigger is worth checking too.

---

## Where the portal is ahead

**Data that HayLoft recorded and abandoned.** 31,487 phantom reads and 612
ignored birds sat in the legacy database with no interface to resolve them —
and in the ignore list's case, the result engine did not apply them either. The
portal resolves both, and the mobile app reconciles phantoms at the loft.

**Access control that means something.** One user, one right group, four lines.
The portal has 23 permission modules with three resolution layers, per-user
overrides, and a real distinction between operator and breeder.

**Concepts HayLoft has no table for at all:** seasons, race-type fees, late
payment penalties, event classes, knockout tournaments, Calcutta auctions, the
event store, refunds ledger, event messages, event rules, GPS tracking, baskets
with scan assignment, scanner→section mapping, push notifications, online
payments, and breeder self-service.

**Two frontends over one API**, rather than a desktop install plus a one-way
`DATASYNC_WEB` outbox with 8,112 queued rows.

---

## Where HayLoft was ahead

1. **Automatic floating backup on bird loss** — see above. The only functional
   regression found.
2. **Atomicity by construction.** Logic inside the database ran on one
   connection in one transaction. The TypeScript ports use Prisma transactions,
   which is equivalent when used — but it is now possible to forget one, which
   it was not before.
3. **Report parity only.** All 16 portal report definitions name a legacy
   ancestor and none is marked as having no predecessor. The portal reproduced
   HayLoft's reporting rather than extending it — though it now renders to PDF,
   CSV and XLSX from a server instead of FastReport on a desktop.

---

## Assessment

The conversion is **faithful, well-documented, and ahead of the original on
every axis except one**.

The porting comments are accurate to the row — 31,487 phantoms, 612 ignores,
one right group with four lines all check out against the live database. That
level of care is unusual and worth preserving.

The `isFloatingBackup` regression is the one thing to fix. It is small, it is
specific, and it has a working procedure on both sides — the portal simply
never wires `applyBackup()` to the bird-lost path.

### Recommended actions

1. **Wire `applyBackup()` to the bird-lost transition** when the season's fee
   scheme has `isFloatingBackup` set, matching `BIRD_LOST_STATUS_MODIFY`. Check
   whether `BIRD_REFUNDS_MODIFY` needs the same treatment.
2. **Remove `raceTypeId` from `prizeSchemeItemSchema`** and fix the mobile
   prize-band editor. Confirmed unnecessary by both schemas.
3. **Enforce `maxBirdCount` server-side** — not to match HayLoft, but because
   the portal's own UI already enforces it and the API does not.
4. **Keep the legacy database.** It is the only remaining specification for
   113 procedures, and it answered three open questions in an afternoon.
