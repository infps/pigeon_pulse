import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presetIdFor } from "@/lib/birdStatus";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// POST /api/admin/race-item/[raceItemId]/status
// Body: { presetId } (direct) OR { trigger } (resolve the season's preset for that trigger, e.g. INJURED).
export async function POST(req: Request, { params }: { params: Promise<{ raceItemId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
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
