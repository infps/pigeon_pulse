import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher";
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

  const { buyerId } = await request.json();
  if (!buyerId) return NextResponse.json({ message: "buyerId required" }, { status: 400 });

  const group = await prisma.calcuttaBetGroup.findFirst({
    where: { id: groupId, eventId },
  });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });
  if (group.status !== "PENDING") return NextResponse.json({ message: "Group not available for early buy" }, { status: 409 });

  const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { id: true, name: true } });
  if (!buyer) return NextResponse.json({ message: "Buyer not found" }, { status: 404 });

  const updated = await prisma.calcuttaBetGroup.update({
    where: { id: groupId },
    data: { status: "EARLY_BOUGHT", ownerId: buyerId, finalPrice: group.calculatedPrice },
  });

  await pusher.trigger(`calcutta-${eventId}`, "group-closed", {
    groupId,
    winnerId: buyerId,
    winnerName: buyer.name,
    finalPrice: Number(updated.finalPrice),
    isHouse: false,
  });

  return NextResponse.json({ group: { ...updated, calculatedPrice: Number(updated.calculatedPrice), finalPrice: Number(updated.finalPrice) } });
}
