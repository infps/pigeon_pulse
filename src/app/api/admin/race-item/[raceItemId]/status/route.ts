import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { presetIdFor } from "@/lib/birdStatus";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// POST /api/admin/race-item/[raceItemId]/status
// Body: { presetId } (direct) OR { trigger } (resolve the season's preset for that trigger, e.g. INJURED).
export async function POST(req: Request, { params }: { params: Promise<{ raceItemId: string }> }) {
  const guard = await requirePermission("races.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;
  const { raceItemId } = await params;
  const id = parseInt(raceItemId);
  const b = await req.json().catch(() => ({}));

  const item = await prisma.raceItem.findUnique({ where: { id }, include: { race: true } });
  if (!item) return NextResponse.json({ message: "RaceItem not found" }, { status: 404 });

  let presetId: number | null = b.presetId ?? null;
  if (presetId == null && b.trigger) presetId = await presetIdFor(item.race?.seasonId ?? null, b.trigger);
  if (presetId == null) return NextResponse.json({ message: "presetId or a resolvable trigger required" }, { status: 400 });

  const updated = await prisma.raceItem.update({
    where: { id }, data: { displayStatusId: presetId }, include: { displayStatus: true },
  });
  return NextResponse.json({ raceItem: updated });
}
