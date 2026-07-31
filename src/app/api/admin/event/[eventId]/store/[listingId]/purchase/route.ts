import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ buyerBreederId: z.number().int().positive() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string; listingId: string }> }
) {
  const { eventId: eventIdParam, listingId: listingIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const listingId = parseInt(listingIdParam);
  if (isNaN(eventId) || isNaN(listingId))
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !["ADMIN", "SUPERADMIN"].includes(session.user.role))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const seasonIdParam = url.searchParams.get("seasonId");
  let seasonId: number;
  if (seasonIdParam) {
    seasonId = parseInt(seasonIdParam);
  } else {
    const activeSeason = await prisma.season.findFirst({
      where: { eventId, isActive: true },
      orderBy: { startDate: "desc" },
    });
    if (!activeSeason) {
      return NextResponse.json({ message: "No active season for this event" }, { status: 404 });
    }
    seasonId = activeSeason.id;
  }

  try {
    const body = await req.json();
    const { buyerBreederId } = schema.parse(body);

    const listing = await prisma.eventStoreListing.findFirst({
      where: { id: listingId, seasonId },
      include: { items: true },
    });
    if (!listing) return NextResponse.json({ message: "Listing not found" }, { status: 404 });
    if (listing.status === "SOLD")
      return NextResponse.json({ message: "Already sold" }, { status: 400 });

    // Find or create buyer's EventInventory for this season
    let buyerInventory = await prisma.eventInventory.findFirst({
      where: { seasonId, breederId: buyerBreederId },
    });
    if (!buyerInventory) {
      buyerInventory = await prisma.eventInventory.create({
        data: { seasonId, breederId: buyerBreederId },
      });
    }

    const itemIds = listing.items.map((i) => i.eventInventoryItemId);

    await prisma.$transaction([
      prisma.eventInventoryItem.updateMany({
        where: { id: { in: itemIds } },
        data: { eventInventoryId: buyerInventory.id },
      }),
      prisma.eventStoreListing.update({
        where: { id: listingId },
        data: {
          status: "SOLD",
          purchasedByBreederId: buyerBreederId,
          purchasedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ message: "Purchase recorded" });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    console.error("Error processing purchase:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
