# Live GPS Truck Tracking — Plan

## Goal
During a liberation, an **event admin** (driver) broadcasts the truck's live GPS from the mobile app or laptop. The **public** sees the truck moving in real time (loft → breadcrumb → truck → release station) **only while in transit**. Admins can review the **route history (breadcrumb)** after the fact. Weather along the route is a **v2** add-on (deferred).

## Locked decisions
- GPS source: **device geolocation** (browser `navigator.geolocation`, mobile `expo-location`). SPOT later as alt source.
- Scope: tied to a **Race** (one liberation per race).
- Broadcaster: **any ADMIN/SUPERADMIN** (event admin). Driver UI on **mobile + web**, never public.
- Background: **mobile = true background** (expo-task-manager + expo-location). **Web = foreground only** (tab open, keep-screen-on).
- Breadcrumbs: **kept** (history + admin replay).
- Public truck: visible **only during transit**.
- No ETA / reverse-geocode in v1. Weather **v2**.

## Data model (Prisma) — `pigeon_pulse/prisma/schema.prisma`
Add to `Race`:
```
transportStatus    TransportStatus @default(IDLE) @map("TRANSPORT_STATUS")
transportStartedAt DateTime?        @map("TRANSPORT_STARTED_AT")
transportEndedAt   DateTime?        @map("TRANSPORT_ENDED_AT")
truckPings         TruckPing[]
```
New enum + model:
```
enum TransportStatus { IDLE  IN_TRANSIT  ARRIVED }

model TruckPing {
  id         Int      @id @default(autoincrement())
  raceId     Int
  latitude   Float
  longitude  Float
  speed      Float?   // m/s from geolocation
  heading    Float?   // degrees
  accuracy   Float?
  recordedAt DateTime // client capture time
  createdAt  DateTime @default(now())
  race Race @relation(fields: [raceId], references: [id], onDelete: Cascade)
  @@index([raceId, recordedAt])
}
```
Apply with `npx prisma db push` (migrate blocked by pre-existing broken migration; additive push is safe) then `npx prisma generate`.

## API contract (web `pigeon_pulse/src/app/api`)
Auth gate = existing pattern (`auth.api.getSession` + role in `["ADMIN","SUPERADMIN"]`; for ADMIN, org-owns-event via `requireAccess`). Public endpoint = no auth.

1. **POST `/api/admin/race/[raceId]/transport/start`** (admin) → set `transportStatus=IN_TRANSIT`, `transportStartedAt=now`. Returns race.
2. **POST `/api/admin/race/[raceId]/transport/stop`** (admin) → set `transportStatus=ARRIVED`, `transportEndedAt=now`. Returns race.
3. **POST `/api/admin/race/[raceId]/ping`** (admin) → body `{ pings: [{lat,lng,speed?,heading?,accuracy?,recordedAt}] }` (batch; single also ok). Inserts `TruckPing[]` (skip if `transportStatus!=IN_TRANSIT`). Returns `{count}`. Batched so the mobile background task can flush queued points.
4. **GET `/api/public/race/[raceId]/track`** (public) → `{ transportStatus, transportStartedAt, latest: ping|null, pings: ping[], station: {name,lat,lng,miles}|null, loft: {lat,lng,name}|null }`. When `transportStatus!=IN_TRANSIT`, return `latest:null, pings:[]` (hide truck) but still station+loft. Downsample pings to ~200 max.
5. **GET `/api/admin/race/[raceId]/track`** (admin) → same shape but **full breadcrumb regardless of status** (for history/replay).

Notes: ping insert is hot — keep handler tiny, no heavy includes. Downsample in the read, not write.

## Web — driver UI (admin)
Location: admin race detail [races/[raceId]/page.tsx](pigeon_pulse/src/app/admin/events/[eventId]/races/[raceId]/page.tsx) — add a **"Liberation / Transport"** card or tab.
- **Start / Stop** buttons → call transport start/stop.
- While started: `navigator.geolocation.watchPosition` → POST `/ping` every ~15s (throttle; buffer + send). Foreground only — show a "keep this tab open / screen on" notice.
- Small live map preview (reuse leaflet) showing current position + station + loft.
- Show transportStatus + started time + last ping age.

## Web — public live view
Location: public race page [races/[raceId]/page.tsx](pigeon_pulse/src/app/races/[raceId]/page.tsx) (authed breeder view; this is the "public" race page in-app).
- When `transportStatus==IN_TRANSIT`: render a **live track map** + poll GET `/api/public/race/[raceId]/track` every ~20s.
- Map: loft marker (start), breadcrumb **polyline** (history), **truck marker** (latest, rotate by heading), station marker (release point). Auto-fit. Reuse leaflet; **new component** `src/components/map/truck-track-map.tsx` (truck divIcon + polyline + station/loft markers).
- Panel: "In transit", departed time, last-update age. (No ETA/weather v1.)
- When not in transit: hide truck, optionally show planned loft→station line only.

## Web — admin route history / replay
Location: admin race detail — a **"Route History"** view (same `TruckTrackMap`, fed by admin GET `/track`).
- v1: static full breadcrumb polyline + start/end markers + station + total points + duration.
- (Optional later: time scrubber to replay.)

## Mobile — driver broadcaster (`agn-mobile`)
Stack: expo-router v6, Expo SDK 54, RN 0.81.5, axios `api.service` (Bearer), `useAuth().user.role`.
- **Add deps**: `expo-location`, `expo-task-manager`.
- **New screen** `app/(app)/liberation.tsx` (admin-only; guard on `user.role` in `["ADMIN","SUPERADMIN"]`, else show "not authorized").
  - Pick a race (admin's events → races in REGISTERING/STARTED) or receive `raceId` param.
  - **Start** → request foreground+background location perms → `Location.startLocationUpdatesAsync(TASK, {accuracy:High, timeInterval:15000, distanceInterval:50, foregroundService:{...}})` + POST transport/start.
  - Background task (`TaskManager.defineTask`) buffers points to AsyncStorage and **batch-POSTs** to `/ping` (handles offline → flush on reconnect).
  - **Stop** → `stopLocationUpdatesAsync` + POST transport/stop + flush buffer.
  - UI: status, points sent, last fix, Start/Stop. **No map on mobile v1** (broadcaster only; viewing is web).
- Reuse `api.service` for auth. Base URL already `/api`.

## Build order / parallelization
1. **(me)** schema + `db push` + `generate`. ✅ foundation.
2. **Subagent A — web backend**: 5 API routes above + TanStack hooks in `src/lib/api/transport.ts`.
3. **Subagent B — web UI**: `truck-track-map.tsx`, driver card (admin race detail), public live track (public race page), admin route-history view. Builds to the fixed contract.
4. **Subagent C — mobile**: deps + `liberation.tsx` + background location task + batch ping posting + admin guard.
A/B/C touch disjoint files → run in parallel against this contract.

## Verification
- `npx prisma db push` clean; web `npm run build` exit 0.
- Driver web: Start → watchPosition posts pings (Network tab) → DB `TruckPing` rows grow; Stop sets ARRIVED.
- Public race page (transit): truck marker + breadcrumb render, poll updates position; after Stop, truck hidden.
- Admin route history: full breadcrumb renders post-transit.
- Mobile: build app, login as admin, Start → background points POST (lock screen, confirm pings continue), Stop flushes.
- Edge: race not IN_TRANSIT → ping rejected; public GET hides truck.

## Deferred (v2)
- Weather along route (Open-Meteo free, or Windy/Meteoblue) at truck coords + panel.
- ETA + reverse-geocoded town name.
- SPOT GPS device as alternate ping source.
- Replay time-scrubber.
