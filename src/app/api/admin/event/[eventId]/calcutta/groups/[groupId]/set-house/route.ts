import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
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

  const group = await prisma.calcuttaBetGroup.findFirst({ where: { id: groupId, eventId } });
  if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.calcuttaBetGroup.update({ where: { id: groupId }, data: { status: "HOUSE", isHouse: true } }),
    // Clear activeGroupId if this was the active group
    prisma.calcuttaConfig.updateMany({ where: { eventId, activeGroupId: groupId }, data: { activeGroupId: null } }),
  ]);

  await pusher.trigger(`calcutta-${eventId}`, "group-closed", {
    groupId,
    isHouse: true,
  });

  return NextResponse.json({ ok: true });
}
