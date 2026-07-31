import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const createListingSchema = z.object({
  breederId: z.number(),
  itemIds: z.array(z.number()).min(1),
  listingPrice: z.number().positive(),
});

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(request, eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  try {
    const listings = await prisma.eventStoreListing.findMany({
      where: { seasonId },
      include: {
        originalBreeder: true,
        purchasedBy: true,
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(req, eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  try {
    const body = await req.json();
    const { breederId, itemIds, listingPrice } = createListingSchema.parse(body);

    const listing = await prisma.eventStoreListing.create({
      data: {
        seasonId,
        originalBreederId: breederId,
        listingPrice,
        items: {
          create: itemIds.map((id) => ({ eventInventoryItemId: id })),
        },
      },
      include: {
        originalBreeder: true,
        items: { include: { inventoryItem: { include: { bird: true } } } },
      },
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    console.error("Error creating store listing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const seasonId = await resolveSeasonId(req, eventId);
  if (seasonId instanceof NextResponse) return seasonId;

  try {
    const { listingId } = await req.json();
    const listing = await prisma.eventStoreListing.findFirst({ where: { id: listingId, seasonId } });
    if (!listing) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (listing.status === "SOLD") return NextResponse.json({ message: "Cannot delete sold listing" }, { status: 400 });

    await prisma.eventStoreListing.delete({ where: { id: listingId } });
    return NextResponse.json({ message: "Listing deleted" });
  } catch (error) {
    console.error("Error deleting store listing:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
