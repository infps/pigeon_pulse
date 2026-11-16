import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { isEventCreator } from "@/lib/event-messages";
import { NextResponse } from "next/server";

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
    const guard = await requirePermission("messages.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const allowed = await isEventCreator(eventId, session.user.email, session.user.role);
    if (!allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data: { title?: string | null; body?: string; mediaUrls?: string[]; isPinned?: boolean } = {};
    if (body.title !== undefined) data.title = body.title?.trim() || null;
    if (body.body !== undefined) {
      const trimmed = String(body.body).trim();
      if (!trimmed) {
        return NextResponse.json({ message: "Body cannot be empty" }, { status: 400 });
      }
      data.body = trimmed;
    }
    if (Array.isArray(body.mediaUrls)) data.mediaUrls = body.mediaUrls;
    if (typeof body.isPinned === "boolean") data.isPinned = body.isPinned;

    const existing = await prisma.eventMessage.findFirst({
      where: { id: messageId, season: { eventId } },
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
    const guard = await requirePermission("messages.manage");
    if ("error" in guard) return guard.error;
    const session = guard.session;

    const allowed = await isEventCreator(eventId, session.user.email, session.user.role);
    if (!allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.eventMessage.findFirst({
      where: { id: messageId, season: { eventId } },
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
