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
