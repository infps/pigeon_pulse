import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

// ponytail: in-memory dedup so tipes.de's buffered RFID isn't returned twice
// key = deviceIp, value = last rfid returned from tipes.de fallback
const tipesLastRfid = new Map<string, string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { startedAt } = body;

    const deviceIp = getClientIp(request);
    // ponytail: no startedAt = caller didn't intend a session window, use now so no stale rows slip through
    const sessionStart = startedAt ? new Date(startedAt) : new Date();

    // Find all unprocessed scans from this device IP after session start
    const candidates = await prisma.rfidScan.findMany({
      where: {
        deviceIp,
        processed: false,
        timestamp: { gte: sessionStart },
      },
      orderBy: { timestamp: "asc" },
    });

    if (candidates.length > 0) {
      const ids = candidates.map((c) => c.id);
      // Atomic claim — mark all processed at once
      const claimed = await prisma.rfidScan.updateMany({
        where: { id: { in: ids }, processed: false },
        data: { processed: true },
      });

      if (claimed.count > 0) {
        return NextResponse.json(
          candidates.map((c) => ({ el: c.rfidTag, timestamp: c.timestamp, source: "python" }))
        );
      }
      return NextResponse.json([]);
    }

    // No local scan for this device — fall back to tipes.de
    const response = await fetch("https://olr.tipes.de/backend/inc/funcs/jsFuncs.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "*/*",
        Origin: "https://olr.tipes.de",
        Referer: "https://olr.tipes.de/backend/index.php?mod=pigeons",
      },
      body: "action=get_last_reg_el&oid=20210012&zid=1&lang=EN",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch scanner data" },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Dedup: if tipes.de returns the same RFID as last time for this device, skip it
    if (Array.isArray(data) && data.length > 0 && data[0].el) {
      const rfid = data[0].el;
      if (tipesLastRfid.get(deviceIp) === rfid) {
        return NextResponse.json([]);
      }
      tipesLastRfid.set(deviceIp, rfid);
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error polling scanner:", error);
    return NextResponse.json({ error: "Failed to poll scanner" }, { status: 500 });
  }
}
