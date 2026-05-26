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

export async function GET(
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

    const messages = await prisma.eventMessage.findMany({
      where: { eventId },
      include: {
        author: {
          select: { id: true, name: true, lastName: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      { messages, message: "Event messages fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event messages:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const allowed = await isEventCreator(eventId, session.user.email, session.user.role);
    if (!allowed) {
      return NextResponse.json(
        { message: "Only event creator can post messages" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const title: string | null = body.title?.trim() || null;
    const messageBody: string = (body.body ?? "").trim();
    const mediaUrls: string[] = Array.isArray(body.mediaUrls) ? body.mediaUrls : [];

    if (!messageBody) {
      return NextResponse.json({ message: "Body is required" }, { status: 400 });
    }

    const created = await prisma.eventMessage.create({
      data: {
        eventId,
        authorId: session.user.id,
        title,
        body: messageBody,
        mediaUrls,
      },
      include: {
        author: {
          select: { id: true, name: true, lastName: true, image: true },
        },
      },
    });

    return NextResponse.json(
      { message: created, status: "Message created" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating event message:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
