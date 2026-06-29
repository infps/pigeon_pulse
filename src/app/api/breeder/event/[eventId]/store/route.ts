import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const listings = await prisma.eventStoreListing.findMany({
      where: { eventId, status: "AVAILABLE" },
      include: {
        originalBreeder: true,
        items: { include: { inventoryItem: { include: { bird: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ listings });
  } catch (error) {
    console.error("Error fetching store listings:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
