import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Check for a fresh unprocessed scan from Python client (within last 10s)
    const cutoff = new Date(Date.now() - 10_000);
    const localScan = await prisma.rfidScan.findFirst({
      where: { processed: false, timestamp: { gte: cutoff } },
      orderBy: { timestamp: "desc" },
    });

    if (localScan) {
      await prisma.rfidScan.update({
        where: { id: localScan.id },
        data: { processed: true },
      });
      // Return in same format as tipes.de so browser code is unchanged
      return NextResponse.json([{ el: localScan.rfidTag, source: "python" }]);
    }

    // Fall back to tipes.de
    const response = await fetch('https://olr.tipes.de/backend/inc/funcs/jsFuncs.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'Origin': 'https://olr.tipes.de',
        'Referer': 'https://olr.tipes.de/backend/index.php?mod=pigeons',
      },
      body: 'action=get_last_reg_el&oid=20210012&zid=1&lang=EN',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch scanner data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error polling scanner:', error);
    return NextResponse.json(
      { error: 'Failed to poll scanner' },
      { status: 500 }
    );
  }
}
