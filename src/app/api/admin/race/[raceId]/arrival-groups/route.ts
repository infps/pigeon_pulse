import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  GAP_SECONDS_DEFAULT,
  groupArrivalsByWindow,
} from "@/lib/arrivalGrouping";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ raceId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { raceId } = await params;
  const groups = await prisma.arrivalGroup.findMany({
    where: { raceId: parseInt(raceId) },
    orderBy: { arrivalTimeStart: "asc" },
    include: { _count: { select: { results: true } } },
  });
  return NextResponse.json({ groups });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ raceId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { raceId: raceIdStr } = await params;
  const raceId = parseInt(raceIdStr);

  let body: { gapSeconds?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const gapSeconds =
    typeof body.gapSeconds === "number" && body.gapSeconds > 0
      ? body.gapSeconds
      : GAP_SECONDS_DEFAULT;

  const results = await prisma.raceItemResult.findMany({
    where: {
      arrivalTime: { not: null },
      raceItem: { raceId },
    },
    select: { raceItemId: true, arrivalTime: true },
  });

  const arrivals = results
    .filter(
      (r): r is { raceItemId: number; arrivalTime: Date } =>
        r.arrivalTime !== null,
    )
    .map((r) => ({ id: r.raceItemId, arrivalTime: r.arrivalTime }));

  const computed = groupArrivalsByWindow(arrivals, gapSeconds);

  const created = await prisma.$transaction(async (tx) => {
    await tx.raceItemResult.updateMany({
      where: { raceItem: { raceId }, groupId: { not: null } },
      data: { groupId: null },
    });
    await tx.arrivalGroup.deleteMany({ where: { raceId } });

    const out: { id: number; raceItemIds: number[] }[] = [];
    for (let i = 0; i < computed.length; i++) {
      const g = computed[i];
      const grp = await tx.arrivalGroup.create({
        data: {
          raceId,
          name: `Group ${i + 1}`,
          arrivalTimeStart: g.start,
          arrivalTimeEnd: g.end,
        },
      });
      await tx.raceItemResult.updateMany({
        where: { raceItemId: { in: g.arrivalIds } },
        data: { groupId: grp.id },
      });
      out.push({ id: grp.id, raceItemIds: g.arrivalIds });
    }
    return out;
  });

  const groups = await prisma.arrivalGroup.findMany({
    where: { raceId },
    orderBy: { arrivalTimeStart: "asc" },
    include: { _count: { select: { results: true } } },
  });

  return NextResponse.json({ groups, created }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ raceId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { raceId: raceIdStr } = await params;
  const raceId = parseInt(raceIdStr);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ message: "id required" }, { status: 400 });

  const groupId = parseInt(id);
  await prisma.$transaction([
    prisma.raceItemResult.updateMany({
      where: { groupId, raceItem: { raceId } },
      data: { groupId: null },
    }),
    prisma.arrivalGroup.delete({ where: { id: groupId } }),
  ]);
  return NextResponse.json({ message: "Deleted" });
}
