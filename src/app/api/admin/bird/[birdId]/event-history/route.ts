import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ birdId: string }> }
) {
  const { birdId: bp } = await params;
  const birdId = parseInt(bp);
  if (isNaN(birdId)) return NextResponse.json({ message: "Invalid bird ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.eventInventoryItem.findMany({
    where: { birdId },
    select: { id: true },
  });

  if (items.length === 0) return NextResponse.json({ history: [] });

  const itemIds = items.map((i) => i.id);

  const history = await prisma.birdEventHistory.findMany({
    where: { eventInventoryItemId: { in: itemIds } },
    orderBy: { createdAt: "desc" },
  });

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
