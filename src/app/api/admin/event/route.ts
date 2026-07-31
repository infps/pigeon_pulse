import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEventSchema, updateEventSchema } from "@/lib/zod";
import { uploadToR2, deleteFromR2, generateImageKey } from "@/lib/r2";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get("eventId");

    if (eventIdParam) {
      const eventId = parseInt(eventIdParam);
      if (isNaN(eventId)) {
        return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          eventType: true,
          createdBy: true,
          seasons: {
            include: {
              feeScheme: {
                include: {
                  birdFeeItems: { orderBy: { birdNo: "asc" } },
                  raceTypeFees: { include: { raceType: true } },
                },
              },
              bettingScheme: true,
              finalPrize: true,
              races: { include: { raceType: true }, orderBy: { startTime: "asc" } },
              _count: { select: { races: true, eventInventories: true } },
            },
          },
          _count: { select: { seasons: true } },
        },
      });
      if (!event) {
        return NextResponse.json(
          { message: "Event not found" },
          { status: 404 }
        );
      }
      const activeSeason = event.seasons.find(s => s.isActive) ?? event.seasons[0];
      const birdCount = await prisma.eventInventoryItem.count({
        where: { eventInventory: { seasonId: activeSeason?.id } },
      });
      return NextResponse.json(
        {
          event,
          stats: {
            breeders: activeSeason?._count.eventInventories ?? 0,
            birds: birdCount,
            races: activeSeason?._count.races ?? 0,
          },
          message: "Event fetched successfully",
        },
        { status: 200 }
      );
    }

    const events = await prisma.event.findMany({
      include: {
        eventType: true,
        createdBy: true,
      },
      orderBy: {
        id: "desc",
      },
    });

    return NextResponse.json(
      { events, message: "Events fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (
      !session ||
      !session.user.role ||
      (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();

    // Extract files
    const logoImageFile = formData.get("logoImage") as File | null;
    const bannerImageFile = formData.get("bannerImage") as File | null;

    // Extract other fields
    const bodyData: any = {};
    formData.forEach((value, key) => {
      if (key !== "logoImage" && key !== "bannerImage") {
        bodyData[key] = value;
      }
    });

    const validatedData = createEventSchema.parse(bodyData);

    // Upload images to R2
    let logoImageUrl = null;
    let logoImageKey = null;
    let bannerImageUrl = null;
    let bannerImageKey = null;

    if (logoImageFile && logoImageFile.size > 0) {
      const key = generateImageKey("events/logos", logoImageFile.name);
      const result = await uploadToR2(logoImageFile, key);
      logoImageUrl = result.url;
      logoImageKey = result.key;
    }

    if (bannerImageFile && bannerImageFile.size > 0) {
      const key = generateImageKey("events/banners", bannerImageFile.name);
      const result = await uploadToR2(bannerImageFile, key);
      bannerImageUrl = result.url;
      bannerImageKey = result.key;
    }

    // Find organizer by session user email for createdById
    const organizer = await prisma.organizerData.findFirst({
      where: { email: session.user.email },
    });

    const newEvent = await prisma.event.create({
      data: {
        name: validatedData.name,
        shortName: validatedData.shortName,
        eventDate: new Date(validatedData.eventDate),
        isOpen: validatedData.isOpen ?? 1,
        eventTypeId: validatedData.eventTypeId ?? null,
        latitude: validatedData.latitude ?? null,
        longitude: validatedData.longitude ?? null,
        createdById: organizer?.id ?? null,
        logoImage: logoImageUrl,
        logoImageKey: logoImageKey,
        bannerImage: bannerImageUrl,
        bannerImageKey: bannerImageKey,
      },
      include: {
        eventType: true,
        createdBy: true,
      },
    });

    return NextResponse.json(
      { message: "Event created successfully", event: newEvent },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating event:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (
      !session ||
      !session.user.role ||
      (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const eventIdParam = formData.get("eventId") as string;

    if (!eventIdParam) {
      return NextResponse.json(
        { message: "Event ID is required" },
        { status: 400 }
      );
    }

    const eventId = parseInt(eventIdParam);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { message: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Get existing event
    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    // Extract files
    const logoImageFile = formData.get("logoImage") as File | null;
    const bannerImageFile = formData.get("bannerImage") as File | null;

    // Extract other fields
    const bodyData: any = {};
    formData.forEach((value, key) => {
      if (key !== "logoImage" && key !== "bannerImage" && key !== "eventId") {
        bodyData[key] = value;
      }
    });

    const validatedData = updateEventSchema.parse(bodyData);

    // Handle image uploads
    let logoImageUrl = existingEvent.logoImage;
    let logoImageKey = existingEvent.logoImageKey;
    let bannerImageUrl = existingEvent.bannerImage;
    let bannerImageKey = existingEvent.bannerImageKey;

    if (logoImageFile && logoImageFile.size > 0) {
      if (logoImageKey) await deleteFromR2(logoImageKey);
      const key = generateImageKey("events/logos", logoImageFile.name);
      const result = await uploadToR2(logoImageFile, key);
      logoImageUrl = result.url;
      logoImageKey = result.key;
    }

    if (bannerImageFile && bannerImageFile.size > 0) {
      if (bannerImageKey) await deleteFromR2(bannerImageKey);
      const key = generateImageKey("events/banners", bannerImageFile.name);
      const result = await uploadToR2(bannerImageFile, key);
      bannerImageUrl = result.url;
      bannerImageKey = result.key;
    }

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.shortName !== undefined && {
          shortName: validatedData.shortName,
        }),
        ...(validatedData.eventDate && {
          eventDate: new Date(validatedData.eventDate),
        }),
        ...(validatedData.isOpen !== undefined && {
          isOpen: validatedData.isOpen,
        }),
        ...(validatedData.eventTypeId !== undefined && { eventTypeId: validatedData.eventTypeId }),
        ...(validatedData.latitude !== undefined && { latitude: validatedData.latitude }),
        ...(validatedData.longitude !== undefined && { longitude: validatedData.longitude }),
        ...(validatedData.locationAddress !== undefined && { locationAddress: validatedData.locationAddress }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.endDate && { endDate: new Date(validatedData.endDate) }),
        ...(validatedData.contactName !== undefined && { contactName: validatedData.contactName }),
        ...(validatedData.contactEmail !== undefined && { contactEmail: validatedData.contactEmail }),
        ...(validatedData.contactPhone !== undefined && { contactPhone: validatedData.contactPhone }),
        ...(validatedData.contactWebsite !== undefined && { contactWebsite: validatedData.contactWebsite }),
        ...(validatedData.contactAddress !== undefined && { contactAddress: validatedData.contactAddress }),
        ...(validatedData.socialYt !== undefined && { socialYt: validatedData.socialYt }),
        ...(validatedData.socialFb !== undefined && { socialFb: validatedData.socialFb }),
        ...(validatedData.socialTwitter !== undefined && { socialTwitter: validatedData.socialTwitter }),
        ...(validatedData.socialInsta !== undefined && { socialInsta: validatedData.socialInsta }),
        logoImage: logoImageUrl,
        logoImageKey: logoImageKey,
        bannerImage: bannerImageUrl,
        bannerImageKey: bannerImageKey,
      },
      include: {
        eventType: true,
        createdBy: true,
      },
    });

    return NextResponse.json(
      { message: "Event updated successfully", event: updatedEvent },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating event:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (
      !session ||
      !session.user.role ||
      (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json(
        { message: "Event ID is required" },
        { status: 400 }
      );
    }

    const id = parseInt(eventId);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: "Invalid event ID" },
        { status: 400 }
      );
    }

    await prisma.event.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Event deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
