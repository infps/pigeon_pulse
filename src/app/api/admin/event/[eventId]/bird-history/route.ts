import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: ep } = await params;
  const eventId = parseInt(ep);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = parseInt(searchParams.get("itemId") ?? "");
  if (isNaN(itemId)) return NextResponse.json({ message: "itemId required" }, { status: 400 });

  // Validate item belongs to this event
  const item = await prisma.eventInventoryItem.findFirst({
    where: { id: itemId, eventInventory: { eventId } },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ message: "Item not found in this event" }, { status: 404 });

  const history = await prisma.birdEventHistory.findMany({
    where: { eventInventoryItemId: itemId },
    orderBy: { createdAt: "desc" },
  });

  // Resolve performer names in one extra query
  const performerIds = [...new Set(history.map((h) => h.performedById).filter(Boolean))] as string[];
  const users = performerIds.length
    ? await prisma.user.findMany({ where: { id: { in: performerIds } }, select: { id: true, name: true } })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const result = history.map((h) => ({
    ...h,
    performedBy: h.performedById ? { name: userMap[h.performedById] ?? null } : null,
  }));

  return NextResponse.json({ history: result });
}
