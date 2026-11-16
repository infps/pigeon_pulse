import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { approvedInventory } from "@/lib/entry-filters";
import { prisma } from "@/lib/prisma";
import { invalidate, raceKey } from "@/lib/ttl-cache";
import { lockRace, recalcPositions } from "@/lib/race-results";
import { parseScanTime } from "@/lib/scan-time";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const batchSchema = z.object({
  scans: z.array(
    z.object({
      ringNo: z.string(),
      timestamp: z.union([z.string(), z.number()]),
      antenna: z.string().optional(),
    })
  ).min(1).max(1000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const guard = await requirePermission("races.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    const body = await request.json();
    const { scans } = batchSchema.parse(body);

    // ── 1. Parse + deduplicate: keep earliest time per ringNo ───────────────
    const skipped: Array<{ ringNo: string; reason: string }> = [];
    const dedupedMap = new Map<string, Date>(); // ringNo → arrival time
    for (const s of scans) {
      const at = parseScanTime(s.timestamp);
      if (!at) {
        skipped.push({ ringNo: s.ringNo, reason: `Invalid timestamp: ${s.timestamp}` });
        continue;
      }
      const existing = dedupedMap.get(s.ringNo);
      if (!existing || at < existing) dedupedMap.set(s.ringNo, at);
    }
    const parsedRings = new Set(dedupedMap.keys());
    // A ring with one bad and one good stamp is still processed; drop its skip.
    for (let i = skipped.length - 1; i >= 0; i--) if (parsedRings.has(skipped[i].ringNo)) skipped.splice(i, 1);

    // ── 2. Fetch race once ──────────────────────────────────────────────────
    const race = await prisma.race.findUnique({
      where: { id: raceIdInt },
      include: {
        seasonRel: { select: { eventId: true } },
        raceType: { select: { prizeRole: true } },
      },
    });
    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });

    const isLive = race.status === "STARTED" || race.status === "ENDED";
    // Live-race scans stamped at/before release are clock or format errors — skip them.
    const deduped: Array<{ ringNo: string; at: Date }> = [];
    for (const [ringNo, at] of dedupedMap) {
      if (isLive && race.startTime && at <= race.startTime) {
        skipped.push({ ringNo, reason: `Scan time ${at.toISOString()} is not after race start ${race.startTime.toISOString()}` });
      } else {
        deduped.push({ ringNo, at });
      }
    }
    const ringNos = deduped.map((s) => s.ringNo);

    // ── 3. Bulk fetch birds (by band OR rfid) ───────────────────────────────
    const [bandBirds, rfidBirds] = await Promise.all([
      prisma.bird.findMany({ where: { band: { in: ringNos } }, select: { id: true, band: true, rfid: true } }),
      prisma.bird.findMany({ where: { rfid: { in: ringNos } }, select: { id: true, band: true, rfid: true } }),
    ]);

    // Map ringNo → bird (band match preferred, rfid as fallback)
    const ringToBird = new Map<string, { id: number; band: string | null; rfid: string | null }>();
    for (const b of rfidBirds) if (b.rfid) ringToBird.set(b.rfid, b);
    for (const b of bandBirds) if (b.band) ringToBird.set(b.band, b); // overwrite — band match wins

    const knownBirdIds = [...new Set([...ringToBird.values()].map((b) => b.id))];

    // ── 4. Bulk fetch raceItems for known birds ─────────────────────────────
    const existingRaceItems = knownBirdIds.length > 0
      ? await prisma.raceItem.findMany({
          where: { raceId: raceIdInt, inventoryItem: { birdId: { in: knownBirdIds } } },
          include: {
            inventoryItem: {
              select: { id: true, birdId: true, deletedAt: true, eventInventory: { select: { approvalStatus: true } } },
            },
          },
        })
      : [];

    // birdId → raceItem
    const birdIdToRaceItem = new Map(
      existingRaceItems.map((ri) => [ri.inventoryItem?.birdId, ri])
    );

    // ── 5. Resolve presetId once ────────────────────────────────────────────
    const arrivedStatusId = isLive
      ? await prisma.birdStatusPreset.findFirst({
          where: { trigger: "ARRIVE", isActive: true, OR: [{ seasonId: race.seasonId ?? undefined }, { seasonId: null }] },
          orderBy: [{ seasonId: "desc" }, { sortOrder: "asc" }],
        }).then((p) => p?.id ?? null)
      : null;

    // ── 6. Resolve defaulter group once (for foreign birds) ─────────────────
    let defaulterGroup: { id: number } | null = null;
    const getDefaulterGroup = async () => {
      if (defaulterGroup) return defaulterGroup;
      defaulterGroup = await prisma.eventGroup.findFirst({
        where: { seasonId: race.seasonId ?? undefined, type: "DEFAULTER" },
        select: { id: true },
      });
      if (!defaulterGroup) {
        defaulterGroup = await prisma.eventGroup.create({
          data: { seasonId: race.seasonId!, name: "Defaulters", type: "DEFAULTER", hasCapacity: false },
          select: { id: true },
        });
      }
      return defaulterGroup;
    };

    // ── 7. Process each scan ────────────────────────────────────────────────
    const results: Array<{
      ringNo: string;
      scanType: string;
      isNewScan: boolean;
      message: string;
      birdPosition?: number | null;
    }> = [];

    // Separate into known-registered, and foreign
    const toArrive: Array<{ ringNo: string; at: Date; raceItem: typeof existingRaceItems[0] }> = [];
    const toForeign: Array<{ ringNo: string; at: Date; bird?: { id: number } }> = [];

    for (const scan of deduped) {
      const bird = ringToBird.get(scan.ringNo);
      const raceItem = bird ? birdIdToRaceItem.get(bird.id) : undefined;

      if (!bird || !raceItem) {
        toForeign.push({ ringNo: scan.ringNo, at: scan.at, bird: bird ?? undefined });
        continue;
      }

      if (raceItem.inventoryItem?.eventInventory?.approvalStatus !== approvedInventory.approvalStatus) {
        skipped.push({ ringNo: scan.ringNo, reason: "This bird's registration has not been approved." });
        continue;
      }

      if (raceItem.inventoryItem?.deletedAt) {
        skipped.push({ ringNo: scan.ringNo, reason: "This bird has been removed from the event." });
        continue;
      }

      if (!isLive) {
        // Pre-race loft scan
        if (raceItem.status === "LOFT_BASKETED") {
          skipped.push({ ringNo: scan.ringNo, reason: "Already loft-basketed" });
        } else {
          toArrive.push({ ringNo: scan.ringNo, at: scan.at, raceItem });
        }
        continue;
      }

      // Live race
      if (raceItem.status === "ARRIVED" || raceItem.status === "FOREIGN_BIRD") {
        skipped.push({ ringNo: scan.ringNo, reason: `Already ${raceItem.status.toLowerCase()}` });
        continue;
      }

      toArrive.push({ ringNo: scan.ringNo, at: scan.at, raceItem });
    }

    // ── 8a. Process loft / arrivals ─────────────────────────────────────────
    if (toArrive.length > 0) {
      if (!isLive) {
        // Bulk loft basketing
        await prisma.raceItem.updateMany({
          where: { id: { in: toArrive.map((a) => a.raceItem.id) } },
          data: { status: "LOFT_BASKETED" },
        });
        for (const a of toArrive) {
          results.push({ ringNo: a.ringNo, scanType: "loft", isNewScan: true, message: "Added to loft" });
        }
      } else {
        // Positions are recomputed for the whole race under the race lock
        // after the results are written, so out-of-order and concurrent scans
        // rank by arrival time and the FINAL unpaid rule is applied. Everything
        // runs in one transaction so a conflict rolls back the whole batch.
        const arrivalUpdates = await prisma.$transaction(
          async (tx) => {
            await lockRace(tx, raceIdInt);

            const updates = toArrive.map((a) => ({ scan: a, pos: null as number | null, arrivalTime: a.at }));

            for (const { scan, arrivalTime } of updates) {
              await tx.raceItem.update({
                where: { id: scan.raceItem.id },
                data: {
                  status: race.status === "ENDED" ? "FOREIGN_BIRD" : "ARRIVED",
                  raceBasketTime: arrivalTime,
                  displayStatusId: arrivedStatusId,
                },
              });
            }

            if (race.status !== "ENDED") { // ended → foreign, no result row
              for (const { scan, arrivalTime } of updates) {
                await tx.raceItemResult.upsert({
                  where: { raceItemId: scan.raceItem.id },
                  create: { raceItemId: scan.raceItem.id, arrivalTime },
                  update: { arrivalTime },
                });
              }
              await recalcPositions(tx, raceIdInt, race.raceType?.prizeRole === "FINAL");
              const placed = await tx.raceItemResult.findMany({
                where: { raceItemId: { in: updates.map((u) => u.scan.raceItem.id) } },
                select: { raceItemId: true, birdPosition: true },
              });
              const posById = new Map(placed.map((r) => [r.raceItemId, r.birdPosition]));
              for (const u of updates) u.pos = posById.get(u.scan.raceItem.id) ?? null;
            }

            await tx.birdEventHistory.createMany({
              data: updates.map(({ scan, pos }) => ({
                eventInventoryItemId: scan.raceItem.inventoryItemId!,
                action: race.status === "ENDED" ? ("STATUS_CHANGED" as const) : ("ARRIVED" as const),
                detail:
                  race.status === "ENDED"
                    ? "Marked as FOREIGN_BIRD (arrived after race ended)"
                    : pos != null ? `Arrived at position ${pos}, race ${raceId}` : `Arrived (unplaced), race ${raceId}`,
                performedById: session.user.id ?? null,
              })),
            });

            return updates;
          },
          { maxWait: 20000, timeout: 180000 }
        );

        for (const { scan, pos } of arrivalUpdates) {
          results.push({
            ringNo: scan.ringNo,
            scanType: race.status === "ENDED" ? "foreign" : "arrival",
            isNewScan: true,
            message: race.status === "ENDED" ? "Marked as foreign (after race ended)" : pos != null ? `Arrived at position ${pos}` : "Arrived (unplaced)",
            birdPosition: race.status === "ENDED" ? undefined : pos,
          });
        }
      }
    }

    // ── 8b. Process foreign birds ───────────────────────────────────────────
    //
    // A tag that matches no bird at all is recorded as a phantom scan for an
    // operator to match later, rather than fabricating a Bird plus a whole
    // registration for an unreadable tag. Same rule as the single-scan route.
    const unknownTags = toForeign.filter((f) => !f.bird);
    if (unknownTags.length > 0) {
      const existing = await prisma.racePhantomBird.findMany({
        where: { raceId: raceIdInt, rfid: { in: unknownTags.map((u) => u.ringNo) } },
        select: { rfid: true },
      });
      const alreadyQueued = new Set(existing.map((e) => e.rfid));
      const fresh = unknownTags.filter((u) => !alreadyQueued.has(u.ringNo));

      if (fresh.length > 0) {
        await prisma.racePhantomBird.createMany({
          data: fresh.map((u) => ({
            raceId: raceIdInt,
            eventId: race.seasonRel?.eventId ?? null,
            rfid: u.ringNo,
            arrivalTime: u.at,
          })),
        });
      }

      for (const u of unknownTags) {
        results.push({
          ringNo: u.ringNo,
          scanType: "phantom",
          isNewScan: !alreadyQueued.has(u.ringNo),
          message: alreadyQueued.has(u.ringNo)
            ? "Already waiting to be matched"
            : "No matching bird — saved for matching",
        });
      }
    }

    const knownForeign = toForeign.filter((f) => f.bird);
    if (knownForeign.length > 0) {
      const dg = await getDefaulterGroup();

      // Sequential: one transaction each in parallel would take one pool
      // connection per foreign bird and starve every other request.
      for (const { ringNo, at: arrivalTime, bird } of knownForeign) {

        await prisma.$transaction(async (tx) => {
          const birdId = bird!.id;
          const eventInv = await tx.eventInventory.create({ data: { seasonId: race.seasonId } });
          const invItem = await tx.eventInventoryItem.create({
            data: { birdId, eventInventoryId: eventInv.id, statusGroupId: dg.id },
          });
          const ri = await tx.raceItem.create({
            data: { raceId: raceIdInt, inventoryItemId: invItem.id, status: "FOREIGN_BIRD", raceBasketTime: arrivalTime },
          });
          await tx.raceItemResult.create({ data: { raceItemId: ri.id, arrivalTime } });
          await tx.birdEventHistory.create({
            data: {
              eventInventoryItemId: invItem.id,
              action: "STATUS_CHANGED",
              detail: "Marked as FOREIGN_BIRD (Defaulter)",
              groupId: dg.id,
              performedById: session.user.id ?? null,
            },
          });
        });

        results.push({ ringNo, scanType: "foreign", isNewScan: true, message: `Unknown bird ${ringNo} registered as foreign` });
      }
    }

    invalidate(raceKey(raceIdInt));

    // ── 9. Skipped ──────────────────────────────────────────────────────────
    for (const s of skipped) {
      results.push({ ringNo: s.ringNo, scanType: "skipped", isNewScan: false, message: s.reason });
    }

    const summary = {
      total: new Set(scans.map((s) => s.ringNo)).size,
      arrived: results.filter((r) => r.scanType === "arrival").length,
      loft: results.filter((r) => r.scanType === "loft").length,
      foreign: results.filter((r) => r.scanType === "foreign").length,
      skipped: results.filter((r) => r.scanType === "skipped").length,
    };

    return NextResponse.json({ results, summary });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request data", errors: error }, { status: 400 });
    }
    console.error("Error in batch scan:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
