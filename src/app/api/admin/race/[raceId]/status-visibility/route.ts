import { auth } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { RaceItemStatus } from "@/generated/prisma/enums";

const ALL_STATUSES: RaceItemStatus[] = [
  "REGISTERED",
  "CHECKED_IN",
  "LOFT_BASKETED",
  "RELEASED",
  "ARRIVED",
  "FOREIGN_BIRD",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  const guard = await requireAnyPermission(["races.view", "races.manage"]);
    if ("error" in guard) return guard.error;
    const session = guard.session;

  const { raceId } = await params;
  const raceIdInt = parseInt(raceId);

  const rows = await prisma.raceStatusVisibility.findMany({
    where: { raceId: raceIdInt },
  });

  const map = new Map(rows.map((r) => [r.status, r.visible]));

  const visibility = ALL_STATUSES.map((status) => ({
    status,
    visible: map.get(status) ?? true,
  }));

  return NextResponse.json({ visibility });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  const guard = await requirePermission("races.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

  const { raceId } = await params;
  const raceIdInt = parseInt(raceId);
  const { status, visible } = await req.json();

  if (!ALL_STATUSES.includes(status)) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  await prisma.raceStatusVisibility.upsert({
    where: { raceId_status: { raceId: raceIdInt, status } },
    create: { raceId: raceIdInt, status, visible },
    update: { visible },
  });

  return NextResponse.json({ status, visible });
}
