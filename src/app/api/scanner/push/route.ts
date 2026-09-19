import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { autoAssignToScannerGroup, resolveScannerGroup } from "@/lib/scanner-mapping";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

/**
 * A reader pushes a tag it has just read.
 *
 * If the reader's serial is mapped to a loft section for the season, the bird is
 * filed into that section automatically — the client-meeting request to "map
 * scanner serial number to loft section; auto-assign birds on scan".
 *
 * The serial is recorded on every scan whether or not it maps anywhere, so the
 * log can answer "which reader saw this bird", and the mapping's last-seen stamp
 * tells an operator which readers are actually alive.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rfidTag, scannerId = "python-client", seasonId } = body;

    if (!rfidTag || typeof rfidTag !== "string" || !rfidTag.trim()) {
      return NextResponse.json({ message: "rfidTag required" }, { status: 400 });
    }

    const deviceIp = getClientIp(request);
    const tag = rfidTag.trim();

    const bird = await prisma.bird.findFirst({
      where: { OR: [{ rfid: tag }, { band: tag }] },
      select: { id: true },
    });

    await prisma.rfidScan.create({
      data: {
        rfidTag: tag,
        scannerId,
        deviceIp,
        birdId: bird?.id ?? null,
        // A scan that matched a bird has been understood; an unmatched one is
        // left for the phantom reconciliation screen.
        processed: bird != null,
      },
    });

    // Auto-filing needs a season to resolve the mapping against. The caller may
    // name one; otherwise fall back to the bird's most recent registration.
    let resolvedSeasonId: number | null = typeof seasonId === "number" ? seasonId : null;
    let inventoryItemId: number | null = null;

    if (bird) {
      const item = await prisma.eventInventoryItem.findFirst({
        where: {
          birdId: bird.id,
          ...(resolvedSeasonId != null ? { eventInventory: { seasonId: resolvedSeasonId } } : {}),
        },
        orderBy: { id: "desc" },
        select: { id: true, eventInventory: { select: { seasonId: true } } },
      });
      if (item) {
        inventoryItemId = item.id;
        resolvedSeasonId = resolvedSeasonId ?? item.eventInventory?.seasonId ?? null;
      }
    }

    let filedInto: string | null = null;
    await prisma.$transaction(async (tx) => {
      const hit = await resolveScannerGroup(tx, resolvedSeasonId, scannerId);
      if (hit && inventoryItemId != null) {
        const moved = await autoAssignToScannerGroup(tx, inventoryItemId, hit);
        if (moved) filedInto = hit.groupName ?? hit.label ?? null;
      }
    });

    return NextResponse.json({
      message: "Scan stored",
      scannerId,
      matchedBird: bird != null,
      filedInto,
    });
  } catch (error) {
    console.error("Error storing scan:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
