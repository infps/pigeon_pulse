import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function isEventCreator(eventId: number, sessionEmail: string, role: string) {
  if (role === "SUPERADMIN") return true;
  if (role !== "ADMIN") return false;
  const organizer = await prisma.organizerData.findFirst({
    where: { email: sessionEmail },
  });
  if (!organizer) return false;
  const event = await prisma.event.findFirst({
    where: { id: eventId, createdById: organizer.id },
    select: { id: true },
  });
  return !!event;
}

export async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
  const { searchParams } = new URL(request.url);
  const seasonIdParam = searchParams.get("seasonId");
  if (seasonIdParam) return parseInt(seasonIdParam);
  const activeSeason = await prisma.season.findFirst({
    where: { eventId, isActive: true },
    orderBy: { startDate: "desc" },
  });
  if (!activeSeason) {
    return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
  }
  return activeSeason.id;
}

// Pinned first, then newest.
export const MESSAGE_ORDER = [{ isPinned: "desc" as const }, { createdAt: "desc" as const }];
