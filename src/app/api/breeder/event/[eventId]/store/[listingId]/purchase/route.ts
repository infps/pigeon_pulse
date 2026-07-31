import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; listingId: string }> }
) {
  const { eventId: eventIdParam, listingId: listingIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const listingId = parseInt(listingIdParam);
  if (isNaN(eventId) || isNaN(listingId))
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const seasonIdParam = searchParams.get("seasonId");
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
    const breeder = await prisma.breeder.findFirst({ where: { userId: session.user.id } });
    if (!breeder) return NextResponse.json({ message: "Breeder not found" }, { status: 404 });

    const listing = await prisma.eventStoreListing.findFirst({
      where: { id: listingId, seasonId },
      include: { items: true },
    });
    if (!listing) return NextResponse.json({ message: "Listing not found" }, { status: 404 });
    if (listing.status === "SOLD")
      return NextResponse.json({ message: "Already sold" }, { status: 400 });

    let buyerInventory = await prisma.eventInventory.findFirst({
      where: { seasonId, breederId: breeder.id },
    });
    if (!buyerInventory) {
      buyerInventory = await prisma.eventInventory.create({
        data: { seasonId, breederId: breeder.id },
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
          purchasedByBreederId: breeder.id,
          purchasedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ message: "Purchase recorded" });
  } catch (error) {
    console.error("Error processing purchase:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
