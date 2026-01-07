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
    const eventId = searchParams.get("eventId");

    if (eventId) {
      const whereClause: any = {
        eventId: eventId,
      };
      
      // If ADMIN, can only access their own events
      if (session.user.role === "ADMIN") {
        whereClause.createdById = session.user.id;
      }

      const event = await prisma.event.findUnique({
        where: whereClause,
        include: {
          type: true,
          feeScheme: {
            include:{
              perchFeeItems: true
            }
          },
          prizeScheme: true,
          bettingScheme: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      if (!event) {
        return NextResponse.json(
          { message: "Event not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { event, message: "Event fetched successfully" },
        { status: 200 }
      );
    }

    const whereClause = session.user.role === "ADMIN" 
      ? { createdById: session.user.id }
      : {};

    const events = await prisma.event.findMany({
      where: whereClause,
      include: {
        type: true,
        feeScheme: true,
        prizeScheme: true,
        bettingScheme: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
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

    const newEvent = await prisma.event.create({
      data: {
        name: validatedData.name,
        shortName: validatedData.shortName,
        description: validatedData.description,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        isOpen: validatedData.isOpen ?? true,
        typeId: validatedData.typeId,
        feeSchemeId: validatedData.feeSchemeId,
        prizeSchemeId: validatedData.prizeSchemeId,
        bettingSchemeId: validatedData.bettingSchemeId,
        createdById: session.user.id,
        contactName: validatedData.contactName,
        contactEmail: validatedData.contactEmail,
        contactPhone: validatedData.contactPhone,
        contactWebsite: validatedData.contactWebsite,
        contactAddress: validatedData.contactAddress,
        socialYt: validatedData.socialYt,
        socialFb: validatedData.socialFb,
        socialTwitter: validatedData.socialTwitter,
        socialInsta: validatedData.socialInsta,
        logoImage: logoImageUrl,
        logoImageKey: logoImageKey,
        bannerImage: bannerImageUrl,
        bannerImageKey: bannerImageKey,
      },
      include: {
        type: true,
        feeScheme: true,
        prizeScheme: true,
        bettingScheme: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
    const eventId = formData.get("eventId") as string;

    if (!eventId) {
      return NextResponse.json(
        { message: "Event ID is required" },
        { status: 400 }
      );
    }

    // Get existing event to check for old images
    const existingEvent = await prisma.event.findUnique({
      where: { eventId },
      select: { logoImageKey: true, bannerImageKey: true },
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

    // Handle logo image update
    let logoImageUrl = undefined;
    let logoImageKey = undefined;
    if (logoImageFile && logoImageFile.size > 0) {
      // Delete old logo if exists
      if (existingEvent.logoImageKey) {
        try {
          await deleteFromR2(existingEvent.logoImageKey);
        } catch (error) {
          console.error("Error deleting old logo:", error);
        }
      }
      
      // Upload new logo
      const key = generateImageKey("events/logos", logoImageFile.name);
      const result = await uploadToR2(logoImageFile, key);
      logoImageUrl = result.url;
      logoImageKey = result.key;
    }

    // Handle banner image update
    let bannerImageUrl = undefined;
    let bannerImageKey = undefined;
    if (bannerImageFile && bannerImageFile.size > 0) {
      // Delete old banner if exists
      if (existingEvent.bannerImageKey) {
        try {
          await deleteFromR2(existingEvent.bannerImageKey);
        } catch (error) {
          console.error("Error deleting old banner:", error);
        }
      }
      
      // Upload new banner
      const key = generateImageKey("events/banners", bannerImageFile.name);
      const result = await uploadToR2(bannerImageFile, key);
      bannerImageUrl = result.url;
      bannerImageKey = result.key;
    }

    const updatedEvent = await prisma.event.update({
      where: { eventId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.shortName !== undefined && {
          shortName: validatedData.shortName,
        }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description,
        }),
        ...(validatedData.startDate && {
          startDate: new Date(validatedData.startDate),
        }),
        ...(validatedData.endDate !== undefined && {
          endDate: validatedData.endDate
            ? new Date(validatedData.endDate)
            : null,
        }),
        ...(validatedData.isOpen !== undefined && {
          isOpen: validatedData.isOpen,
        }),
        ...(validatedData.typeId && { typeId: validatedData.typeId }),
        ...(validatedData.feeSchemeId && {
          feeSchemeId: validatedData.feeSchemeId,
        }),
        ...(validatedData.prizeSchemeId && {
          prizeSchemeId: validatedData.prizeSchemeId,
        }),
        ...(validatedData.bettingSchemeId && {
          bettingSchemeId: validatedData.bettingSchemeId,
        }),
        ...(validatedData.contactName !== undefined && {
          contactName: validatedData.contactName,
        }),
        ...(validatedData.contactEmail !== undefined && {
          contactEmail: validatedData.contactEmail,
        }),
        ...(validatedData.contactPhone !== undefined && {
          contactPhone: validatedData.contactPhone,
        }),
        ...(validatedData.contactWebsite !== undefined && {
          contactWebsite: validatedData.contactWebsite,
        }),
        ...(validatedData.contactAddress !== undefined && {
          contactAddress: validatedData.contactAddress,
        }),
        ...(validatedData.socialYt !== undefined && {
          socialYt: validatedData.socialYt,
        }),
        ...(validatedData.socialFb !== undefined && {
          socialFb: validatedData.socialFb,
        }),
        ...(validatedData.socialTwitter !== undefined && {
          socialTwitter: validatedData.socialTwitter,
        }),
        ...(validatedData.socialInsta !== undefined && {
          socialInsta: validatedData.socialInsta,
        }),
        ...(logoImageUrl !== undefined && { logoImage: logoImageUrl }),
        ...(logoImageKey !== undefined && { logoImageKey: logoImageKey }),
        ...(bannerImageUrl !== undefined && { bannerImage: bannerImageUrl }),
        ...(bannerImageKey !== undefined && { bannerImageKey: bannerImageKey }),
      },
      include: {
        type: true,
        feeScheme: true,
        prizeScheme: true,
        bettingScheme: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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

    await prisma.event.delete({
      where: { eventId },
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
