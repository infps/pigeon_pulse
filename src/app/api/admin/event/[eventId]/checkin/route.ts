import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventInventoryItemId, rfid } = body;

    if (!eventInventoryItemId || !rfid || typeof rfid !== "string" || rfid.trim() === "") {
      return NextResponse.json(
        { message: "eventInventoryItemId and rfid are required" },
        { status: 400 }
      );
    }

    // Validate item belongs to this event
    const item = await prisma.eventInventoryItem.findFirst({
      where: {
        id: eventInventoryItemId,
        eventInventory: { eventId },
      },
      include: { bird: { select: { id: true } } },
    });

    if (!item || !item.bird) {
      return NextResponse.json(
        { message: "Bird not found for this event" },
        { status: 404 }
      );
    }

    // Check RFID not already used by another bird
    const existing = await prisma.bird.findFirst({
      where: {
        rfid: rfid.trim(),
        id: { not: item.bird.id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: `RFID "${rfid}" is already linked to another bird (ID: ${existing.id})` },
        { status: 409 }
      );
    }

    // Update Bird.rfid
    await prisma.bird.update({
      where: { id: item.bird.id },
      data: { rfid: rfid.trim() },
    });

    return NextResponse.json({
      message: "RFID linked successfully",
      birdId: item.bird.id,
      rfid: rfid.trim(),
    });
  } catch (error) {
    console.error("Error linking RFID:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventInventoryItemId } = body;

    if (!eventInventoryItemId) {
      return NextResponse.json(
        { message: "eventInventoryItemId is required" },
        { status: 400 }
      );
    }

    const item = await prisma.eventInventoryItem.findFirst({
      where: {
        id: eventInventoryItemId,
        eventInventory: { eventId },
      },
      include: { bird: { select: { id: true } } },
    });

    if (!item || !item.bird) {
      return NextResponse.json(
        { message: "Bird not found for this event" },
        { status: 404 }
      );
    }

    await prisma.bird.update({
      where: { id: item.bird.id },
      data: { rfid: null },
    });

    return NextResponse.json({
      message: "RFID unlinked successfully",
      birdId: item.bird.id,
    });
  } catch (error) {
    console.error("Error unlinking RFID:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
