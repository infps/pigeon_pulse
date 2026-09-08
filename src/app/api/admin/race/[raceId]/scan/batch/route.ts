import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const batchSchema = z.object({
  scans: z.array(
    z.object({
      ringNo: z.string(),
      timestamp: z.string(),
      antenna: z.string().optional(),
    })
  ).min(1).max(1000),
});

function parseTimestamp(ts: string): Date {
  return new Date(
    parseInt(ts.substring(0, 4)),
    parseInt(ts.substring(4, 6)) - 1,
    parseInt(ts.substring(6, 8)),
    parseInt(ts.substring(8, 10)),
    parseInt(ts.substring(10, 12)),
    parseInt(ts.substring(12, 14)),
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { raceId } = await params;
    const raceIdInt = parseInt(raceId);
    const body = await request.json();
    const { scans } = batchSchema.parse(body);

    // ── 1. Deduplicate: keep earliest timestamp per ringNo ──────────────────
    const dedupedMap = new Map<string, string>(); // ringNo → timestamp
    for (const s of scans) {
      const existing = dedupedMap.get(s.ringNo);
      if (!existing || s.timestamp < existing) {
        dedupedMap.set(s.ringNo, s.timestamp);
      }
    }
    const deduped = Array.from(dedupedMap.entries()).map(([ringNo, timestamp]) => ({ ringNo, timestamp }));

    // ── 2. Fetch race once ──────────────────────────────────────────────────
    const race = await prisma.race.findUnique({ where: { id: raceIdInt } });
    if (!race) return NextResponse.json({ message: "Race not found" }, { status: 404 });

    const isLive = race.status === "STARTED" || race.status === "ENDED";
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
          include: { inventoryItem: { select: { id: true, birdId: true } } },
        })
      : [];

    // birdId → raceItem
    const birdIdToRaceItem = new Map(
      existingRaceItems.map((ri) => [ri.inventoryItem?.birdId, ri])
    );

    // ── 5. Resolve presetId + arrivedCount once ─────────────────────────────
    const [arrivedStatusId, arrivedCountNow] = await Promise.all([
      isLive
        ? prisma.birdStatusPreset.findFirst({
            where: { trigger: "ARRIVE", isActive: true, OR: [{ seasonId: race.seasonId ?? undefined }, { seasonId: null }] },
            orderBy: [{ seasonId: "desc" }, { sortOrder: "asc" }],
          }).then((p) => p?.id ?? null)
        : Promise.resolve(null),
      isLive
        ? prisma.raceItem.count({ where: { raceId: raceIdInt, status: "ARRIVED" } })
        : Promise.resolve(0),
    ]);

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
    let positionCounter = arrivedCountNow;

    const results: Array<{
      ringNo: string;
      scanType: string;
      isNewScan: boolean;
      message: string;
      birdPosition?: number;
    }> = [];

    // Separate into known-registered, and foreign
    const toArrive: Array<{ ringNo: string; timestamp: string; raceItem: typeof existingRaceItems[0] }> = [];
    const toForeign: Array<{ ringNo: string; timestamp: string; bird?: { id: number } }> = [];
    const skipped: Array<{ ringNo: string; reason: string }> = [];

    for (const scan of deduped) {
      const bird = ringToBird.get(scan.ringNo);
      const raceItem = bird ? birdIdToRaceItem.get(bird.id) : undefined;

      if (!bird || !raceItem) {
        toForeign.push({ ringNo: scan.ringNo, timestamp: scan.timestamp, bird: bird ?? undefined });
        continue;
      }

      if (!isLive) {
        // Pre-race loft scan
        if (raceItem.status === "LOFT_BASKETED") {
          skipped.push({ ringNo: scan.ringNo, reason: "Already loft-basketed" });
        } else {
          toArrive.push({ ringNo: scan.ringNo, timestamp: scan.timestamp, raceItem });
        }
        continue;
      }

      // Live race
      if (raceItem.status === "ARRIVED" || raceItem.status === "FOREIGN_BIRD") {
        skipped.push({ ringNo: scan.ringNo, reason: `Already ${raceItem.status.toLowerCase()}` });
        continue;
      }

      toArrive.push({ ringNo: scan.ringNo, timestamp: scan.timestamp, raceItem });
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
        // Assign positions sequentially (sorted by timestamp for correct order)
        toArrive.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        const arrivalUpdates = toArrive.map((a) => {
          positionCounter++;
          const pos = positionCounter;
          const arrivalTime = parseTimestamp(a.timestamp);
          return { scan: a, pos, arrivalTime };
        });

        // Bulk update raceItem statuses
        await Promise.all(
          arrivalUpdates.map(({ scan, arrivalTime }) =>
            prisma.raceItem.update({
              where: { id: scan.raceItem.id },
              data: {
                status: race.status === "ENDED" ? "FOREIGN_BIRD" : "ARRIVED",
                raceBasketTime: arrivalTime,
                displayStatusId: arrivedStatusId,
              },
            })
          )
        );

        // Bulk upsert results + history in parallel
        await Promise.all([
          ...arrivalUpdates.map(({ scan, pos, arrivalTime }) =>
            race.status === "ENDED"
              ? Promise.resolve() // ended → foreign, no result row needed
              : prisma.raceItemResult.upsert({
                  where: { raceItemId: scan.raceItem.id },
                  create: { raceItemId: scan.raceItem.id, arrivalTime, birdPosition: pos },
                  update: { arrivalTime, birdPosition: pos },
                })
          ),
          ...arrivalUpdates.map(({ scan, pos }) =>
            prisma.birdEventHistory.create({
              data: {
                eventInventoryItemId: scan.raceItem.inventoryItemId!,
                action: race.status === "ENDED" ? "STATUS_CHANGED" : "ARRIVED",
                detail: race.status === "ENDED"
                  ? "Marked as FOREIGN_BIRD (arrived after race ended)"
                  : `Arrived at position ${pos}, race ${raceId}`,
                performedById: session.user.id ?? null,
              },
            })
          ),
        ]);

        for (const { scan, pos } of arrivalUpdates) {
          results.push({
            ringNo: scan.ringNo,
            scanType: race.status === "ENDED" ? "foreign" : "arrival",
            isNewScan: true,
            message: race.status === "ENDED" ? "Marked as foreign (after race ended)" : `Arrived at position ${pos}`,
            birdPosition: race.status === "ENDED" ? undefined : pos,
          });
        }
      }
    }

    // ── 8b. Process foreign birds ───────────────────────────────────────────
    if (toForeign.length > 0) {
      const dg = await getDefaulterGroup();

      await Promise.all(
        toForeign.map(async ({ ringNo, timestamp, bird }) => {
          const arrivalTime = parseTimestamp(timestamp);

          await prisma.$transaction(async (tx) => {
            let birdId = bird?.id;
            if (!birdId) {
              const newBird = await tx.bird.create({ data: { band: ringNo, rfid: ringNo } });
              birdId = newBird.id;
            }
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
        })
      );
    }

    // ── 9. Skipped ──────────────────────────────────────────────────────────
    for (const s of skipped) {
      results.push({ ringNo: s.ringNo, scanType: "skipped", isNewScan: false, message: s.reason });
    }

    const summary = {
      total: deduped.length,
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
