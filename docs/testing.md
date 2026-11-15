# Testing — pigeon_pulse (web + API)

How to check a change works and how to measure speed. Mobile has its own
guide in `agn-mobile/docs/testing.md`.

> **Never point a check that writes data, or a load test, at production.**
> The `verify-*` scripts that create users or rows clean up after themselves,
> but run them against a throwaway database (section 2) unless the script says
> it rolls everything back.

## 1. Fast checks (no database, no server)

```bash
pnpm install
npx tsc --noEmit -p .                 # must be 0 errors
npx eslint <changed files>            # don't add new errors; old ones exist
pnpm test                             # bun test tests/ (accounting rules, hayloft bets)
bun scripts/verify-ttl-cache.ts       # race-results cache helper → "ttl-cache OK"
npx prisma validate                   # schema
npx next build                        # production build
```

## 2. Throwaway database

Migrations do not replay on an empty database (the history assumes a legacy
baseline), so build the schema with `db push`:

```bash
PW=$(openssl rand -hex 12)            # keep it out of source files
docker run -d --name pp-test -e POSTGRES_PASSWORD=$PW -e POSTGRES_DB=pp \
  -p 127.0.0.1:55432:5432 postgres:17-alpine
export DATABASE_URL="postgresql://postgres:$PW@localhost:55432/pp"
npx prisma db push
bun prisma/seed.ts                    # 4 breeders, 12 birds, 10 races
bun prisma/seed-500.ts                # +500 birds / 20 breeders, event 2
```

Need production-sized volume? Bulk-insert with `generate_series`, e.g.
10K birds:

```bash
docker exec -i pp-test psql -U postgres pp <<'SQL'
insert into "Birds"("BAND","BIRD_NAME","COLOR","SEX","IS_ACTIVE","IS_LOST","breederId")
select 'AU-'||g, 'Bird'||g, 'BC', g%2, 1, 0, 1 from generate_series(1,10000) g;
SQL
```

Clean up: `docker rm -f pp-test`.

## 3. Checks that need the database and/or the dev server

Start the app on the test database: `npx next dev -p 3000` (or `next build &&
next start -p 3000` to test the production build). `NEXT_PUBLIC_API_URL` in
`.env` must match that port.

| Script | Needs | What it proves |
|---|---|---|
| `bun scripts/verify-admin-pages.ts [baseUrl]` | DB + server | every admin page renders (no 500 / Next error markers), as a throwaway SUPERADMIN |
| `bun scripts/verify-list-pagination.ts [baseUrl]` | DB + server | paged users/birds lists = full list, no duplicates, no SSN/tax fields in list rows |
| `bun scripts/verify-rbac-e2e.ts [baseUrl]` | DB + server | revoking a permission turns a 200 into a 403, and back |
| `bun scripts/verify-view-permissions.ts [baseUrl]` | DB + server | "view" permissions open their GET routes |
| `bun scripts/probe-login.ts` | DB + server | the mobile sign-in route returns a bearer token |
| `bun scripts/verify-rbac.ts` | DB | permission resolver edge cases |
| `bun scripts/verify-race-classes.ts` | DB | class payout arithmetic vs worked examples |
| `bun scripts/verify-entry-delete.ts` | DB (rolled back) | soft delete + restore of an entry |
| `bun scripts/verify-substitution.ts` | DB (rolled back) | backup bird substitution |
| `bun scripts/verify-season-clone.ts [seasonId]` | DB (rolled back) | season clone copies config only |
| `bun scripts/verify-prize-engine.ts` | DB (dry run) | result engine vs HayLoft-imported results |
| `node scripts/simulate-arrivals.mjs` | server | scanner arrivals every 200ms (manual live-race test) |

Logged-in browser check: sign up a throwaway account, promote it in the DB
(`update "Users" set role='SUPERADMIN', "APPROVAL_STATUS"='APPROVED' where email=…`),
then click through `/admin/users`, `/admin/birds`, every tab of
`/admin/events/<id>`, `/races/<id>` (click a loft name → breeder popup) and
`/events/<id>`. Watch DevTools for failed requests and console errors.

## 4. Performance benchmarks

Two read-only scripts:

- `scripts/bench-api.sh <baseUrl> <liveRaceId> <endedRaceId> <eventId> <seasonId> [loadRequests]`
  — first / p50 / p95 ms and size for the hot public endpoints; with
  `loadRequests > 0` also 20 parallel viewers polling one live race.
- `node scripts/bench-db.mjs <endedRaceId> <liveRaceId> <seasonId>` — hot
  queries via `EXPLAIN ANALYZE` (median of 5) and whether they use an index.

Pick IDs from real data: the race with the most `RaceItem` rows (ended), a
STARTED race, and the season with the most entries.

### A/B: old code vs new code on the same real data (EC2)

Runs two extra containers on the live host bound to localhost only. They skip
migrations (`sh -c "pnpm start"`), so they only read. Memory on t4g.small is
tight: run, measure, remove.

```bash
# on the EC2 host (ssh via SSM, see infra/README.md)
cd /opt/pigeon_pulse      # repo checkout; scripts/ is current after a deploy
OLD=<full sha before the change>; NEW=<full sha after>
for x in "pp-old 3100 $OLD" "pp-new 3101 $NEW"; do set -- $x
  sudo docker pull -q ghcr.io/infps/pigeon_pulse:$3
  sudo docker run -d --name $1 --env-file .env -p 127.0.0.1:$2:3000 \
    ghcr.io/infps/pigeon_pulse:$3 sh -c "pnpm start"
done
bash scripts/bench-api.sh http://127.0.0.1:3100 10000 834 19 15 40    # old
bash scripts/bench-api.sh http://127.0.0.1:3101 10000 834 19 15 100   # new
sudo docker rm -f pp-old pp-new

# DB timings (inside the app container, reaches RDS)
sudo docker compose cp scripts/bench-db.mjs app:/tmp/
sudo docker compose exec -T app node /tmp/bench-db.mjs 834 10000 15
```

Live site through Caddy (gzip sizes as visitors get them), from the host:

```bash
CURL_EXTRA="--resolve pigeonpulse.com:443:127.0.0.1" \
  bash scripts/bench-api.sh https://pigeonpulse.com 10000 834 19 15
```

The load test hits whatever `baseUrl` serves. Against production, agree a
quiet window first: the old code took minutes to recover from 20 viewers.

### Baseline (2026-11-15, RDS with 623K race items, commits 63318e4 → f003ecf)

| Endpoint | Old p50 | New p50 | Raw size old → new |
|---|---|---|---|
| live race items (1,390 birds) | 2,350 ms | 11 ms | 3.3 MB → 575 KB |
| ended race items (2,495 birds) | 938 ms | 47 ms | 6.3 MB → 1.07 MB |
| event inventory | 159 ms | 39 ms | 2.2 MB → 281 KB |
| race overlay | 68 ms | 8 ms | same |
| public inventory-items | 3,321 ms | 2,351 ms | 38.6 MB → 14.2 MB (still slow) |
| 20 viewers × live race | all requests > 60 s | 100 req in 1.7 s, p50 247 ms | |

DB: race lookup 27 ms (seq scan) → 0.4–2.5 ms (index).
