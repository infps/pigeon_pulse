import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; groupId: string }> }
) {
  const { eventId: eventIdParam, groupId: groupIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const groupId = parseInt(groupIdParam);
  if (isNaN(eventId) || isNaN(groupId)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { newStartingBid } = await request.json();
  if (newStartingBid == null) return NextResponse.json({ message: "newStartingBid required" }, { status: 400 });

  const group = await prisma.calcuttaBetGroup.findFirst({ where: { id: groupId, eventId } });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });
  if (Number(newStartingBid) >= Number(group.calculatedPrice)) {
    return NextResponse.json({ message: "newStartingBid must be less than calculatedPrice" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.calcuttaBetGroup.update({
      where: { id: groupId },
      data: { status: "PENDING", startingBid: Number(newStartingBid), lastBidAt: null },
    }),
    prisma.calcuttaBid.deleteMany({ where: { groupId } }),
  ]);

  return NextResponse.json({ ok: true });
}
