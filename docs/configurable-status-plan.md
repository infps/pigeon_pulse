# Configurable Bird Status — plan (build first, then load-run)

Client green note: bird statuses must update on release/arrival — "flying, resting in inventory, or whatever status we have configured." Today only the fixed `RaceItemStatus` enum (`REGISTERED, CHECKED_IN, LOFT_BASKETED, RELEASED, ARRIVED, FOREIGN_BIRD`) exists — no LOST/INJURED, nothing configurable.

## Approach (keep the enum as the internal state machine; add a configurable display layer)
- **New model `BirdStatusPreset`**: `{ id, seasonId? (null = global), code, label, color, trigger: REGISTER|CHECKIN|RELEASE|ARRIVE|LOST|INJURED|MANUAL, sortOrder, isActive }`. Admin CRUD.
- **`RaceItem.displayStatusId`** (nullable FK → BirdStatusPreset) — the current configurable status, separate from `status` enum.
- **Wire lifecycle events** to set `displayStatusId` from the preset whose `trigger` matches:
  - register → REGISTER ("Resting in inventory")
  - start/release (`race/[raceId]/start`) → RELEASE ("Flying")
  - arrival (`race/[raceId]/scan` ARRIVED branch) → ARRIVE ("Arrived")
  - end, unreturned (`race/[raceId]/end`) → LOST ("Lost")
  - injured (group move) → INJURED ("Injured")
- **Seed default presets** on season create.

## Endpoints
- CRUD `…/event/[eventId]/status-presets` (GET/POST/PATCH/DELETE), admin.
- Set `displayStatusId` inside existing start/scan/end routes (+ injured path).
- Include `displayStatus` in race-item / checkin / basket / public-display feeds.

## Harness verification to add (loadtest repo)
Per race, assert sampled RaceItems carry the right preset: released→"Flying", arrived→"Arrived", lost→"Lost", injured→"Injured". Report counts.

## Build order (tomorrow)
1. Schema: `BirdStatusPreset` + `RaceItem.displayStatusId`; `prisma db push`.
2. Seed defaults on season create.
3. Wire start / scan / end / injured to set `displayStatusId`.
4. CRUD route.
5. Harness: verify status transitions per race.
6. Smoke-validate → full 2000/5-race run.

## Open questions
- Presets global or per-season (default: per-season, fall back to global)?
- Display status REPLACE the enum in UI or coexist (rec: coexist; enum = pipeline, preset = human label)?
- Exact default statuses/labels/colors?
- Public display shows the configurable status? (rec: yes.)

See load-test harness handoff in Claude memory for how to run.
