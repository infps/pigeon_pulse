import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
