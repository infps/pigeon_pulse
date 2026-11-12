# HayLoft → Neon sync

Brings a newer `HAYLOFT.FDB` into a database that already holds the original
(Nov 2025) HayLoft import plus portal-made data. First run: 2026-11-12, dev Neon.

## Steps

1. Copy the `.FDB` somewhere scratch (never point at the live file). Needs the local
   Firebird 2.0 server (`isql.exe`, SYSDBA).
2. `node scripts/hayloft-sync/export.cjs <copy.FDB> <dump-dir>`: tables to JSON.
   The dump has personal data (SSNs, addresses); keep it out of the repo.
3. `node scripts/hayloft-sync/sync.cjs <dump-dir>`: dry run. Runs every write in one
   transaction, prints the report, and rolls back. FK/unique problems surface here.
4. `node scripts/hayloft-sync/sync.cjs <dump-dir> --apply`: same, then commits.
   Writes `id-map.json` (HayLoft id → DB id where they differ) and `sync-report.txt`
   into the dump dir.

## Rules

- New HayLoft rows are inserted, keeping the HayLoft id when it is free. If the portal
  already used that id, the row gets a fresh id and every reference is remapped.
  Portal rows are never changed by a collision.
- Rows from the original import that changed in HayLoft: HayLoft wins on race and
  money fields (`WINS` in `sync.cjs`), including bird transfers (entry moves to the
  new owner's registration, `Birds.breederId` follows). Elsewhere the portal value
  is kept, and HayLoft only fills blanks.
- Schemes: new ones are inserted with their items. Existing schemes, their items, and
  season scheme pointers are left as the portal has them (differences are reported).
- Rows deleted on either side are not deleted or re-created; they are reported.
- `EXCLUDED_EVENTS` (HayLoft event 21 "TEST RACE") is skipped.
- Value transforms reproduce the original import (`xform.cjs`): LA local time → UTC,
  TIME → 1970-01-01 minus 5:30, 1899-12-30 → NULL, country `USA` → `US`. Race item
  status is derived (arrived / lost / basketed → RELEASED / REGISTERED), which matches
  the original import on 376,527 of 376,530 rows.

## Before running against another database

`CUTOFF` in `sync.cjs` is the highest HayLoft id per table at the original import
**in the dev DB**. Re-derive it for the target (ids above it that already exist there
belong to portal rows): run a dry run and check the `remap` and `deletedInPortal`
counts look right before applying. A second sync against the same DB also needs
the previous `id-map.json`; this script does not read it yet.
