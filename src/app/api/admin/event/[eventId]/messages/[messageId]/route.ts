import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function isEventCreator(eventId: number, sessionEmail: string, role: string) {
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

async function resolveSeasonId(request: Request, eventId: number): Promise<number | NextResponse> {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; messageId: string }> }
) {
  const { eventId: eventIdParam, messageId: messageIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const messageId = parseInt(messageIdParam);

  if (isNaN(eventId) || isNaN(messageId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const allowed = await isEventCreator(eventId, session.user.email, session.user.role);
    if (!allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const seasonId = await resolveSeasonId(request, eventId);
    if (seasonId instanceof NextResponse) return seasonId;

    const body = await request.json();
    const data: { title?: string | null; body?: string; mediaUrls?: string[] } = {};
    if (body.title !== undefined) data.title = body.title?.trim() || null;
    if (body.body !== undefined) {
      const trimmed = String(body.body).trim();
      if (!trimmed) {
        return NextResponse.json({ message: "Body cannot be empty" }, { status: 400 });
      }
      data.body = trimmed;
    }
    if (Array.isArray(body.mediaUrls)) data.mediaUrls = body.mediaUrls;

    const existing = await prisma.eventMessage.findFirst({
      where: { id: messageId, seasonId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const updated = await prisma.eventMessage.update({
      where: { id: messageId },
      data,
      include: {
        author: {
          select: { id: true, name: true, lastName: true, image: true },
        },
      },
    });

    return NextResponse.json({ message: updated, status: "Updated" }, { status: 200 });
  } catch (error) {
    console.error("Error updating event message:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string; messageId: string }> }
) {
  const { eventId: eventIdParam, messageId: messageIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const messageId = parseInt(messageIdParam);

  if (isNaN(eventId) || isNaN(messageId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const allowed = await isEventCreator(eventId, session.user.email, session.user.role);
    if (!allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const seasonId = await resolveSeasonId(request, eventId);
    if (seasonId instanceof NextResponse) return seasonId;

    const existing = await prisma.eventMessage.findFirst({
      where: { id: messageId, seasonId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    await prisma.eventMessage.delete({ where: { id: messageId } });

    return NextResponse.json({ status: "Deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting event message:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
