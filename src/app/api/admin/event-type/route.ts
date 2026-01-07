import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createEventTypeSchema } from "@/lib/zod";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

export async function GET() {
  try {
    const eventTypes = await prisma.eventType.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json(
      { eventTypes, message: "Event types fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event types:", error);
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
    if (!session || !session.user.role || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const validatedData = createEventTypeSchema.parse(body);
    const newEventType = await prisma.eventType.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
      },
    });
    return NextResponse.json(
      { message: "Event type created successfully", eventType: newEventType },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating event type:", error);
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
    if (!session || !session.user.role || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { eventTypeId, ...updateData } = body;
    
    if (!eventTypeId) {
      return NextResponse.json(
        { message: "Event type ID is required" },
        { status: 400 }
      );
    }

    const validatedData = createEventTypeSchema.parse(updateData);
    
    const updatedEventType = await prisma.eventType.update({
      where: { eventTypeId },
      data: {
        name: validatedData.name,
        description: validatedData.description,
      },
    });
    
    return NextResponse.json(
      { message: "Event type updated successfully", eventType: updatedEventType },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating event type:", error);
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
    if (!session || !session.user.role || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    
    const body = await request.json();
    const { eventTypeId } = body;
    
    if (!eventTypeId) {
      return NextResponse.json(
        { message: "Event type ID is required" },
        { status: 400 }
      );
    }

    await prisma.eventType.delete({
      where: { eventTypeId },
    });
    
    return NextResponse.json(
      { message: "Event type deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting event type:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
