import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEventSchema, updateEventSchema } from "@/lib/zod";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

export async function GET() {
  try {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    let events;
    if(session && session.user.role ==="ADMIN"){
        events = await prisma.event.findMany({
            where: {
                createdById: session.user.id,
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
            orderBy: {
                createdAt: "desc",
            },
        });
    }else{  
            events = await prisma.event.findMany({
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
        }
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

    const body = await request.json();
    const validatedData = createEventSchema.parse(body);

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

    const body = await request.json();
    const { eventId, ...updateData } = body;

    if (!eventId) {
      return NextResponse.json(
        { message: "Event ID is required" },
        { status: 400 }
      );
    }

    const validatedData = updateEventSchema.parse(updateData);

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
          endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
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
