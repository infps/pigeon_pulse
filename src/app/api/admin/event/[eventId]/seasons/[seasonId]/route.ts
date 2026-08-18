import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; seasonId: string }> }
) {
  const { eventId: eventIdParam, seasonId: seasonIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  const seasonId = parseInt(seasonIdParam);

  if (isNaN(eventId) || isNaN(seasonId)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      startDate,
      endDate,
      feeSchemeId,
      bettingSchemeId,
      finalPrizeSchemeId,
      hotSpot1PrizeSchemeId,
      hotSpot2PrizeSchemeId,
      hotSpot3PrizeSchemeId,
      hotSpotAvgPrizeSchemeId,
    } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (feeSchemeId !== undefined) data.feeSchemeId = feeSchemeId ? parseInt(feeSchemeId) : null;
    if (bettingSchemeId !== undefined) data.bettingSchemeId = bettingSchemeId ? parseInt(bettingSchemeId) : null;
    if (finalPrizeSchemeId !== undefined) data.finalPrizeSchemeId = finalPrizeSchemeId ? parseInt(finalPrizeSchemeId) : null;
    if (hotSpot1PrizeSchemeId !== undefined) data.hotSpot1PrizeSchemeId = hotSpot1PrizeSchemeId ? parseInt(hotSpot1PrizeSchemeId) : null;
    if (hotSpot2PrizeSchemeId !== undefined) data.hotSpot2PrizeSchemeId = hotSpot2PrizeSchemeId ? parseInt(hotSpot2PrizeSchemeId) : null;
    if (hotSpot3PrizeSchemeId !== undefined) data.hotSpot3PrizeSchemeId = hotSpot3PrizeSchemeId ? parseInt(hotSpot3PrizeSchemeId) : null;
    if (hotSpotAvgPrizeSchemeId !== undefined) data.hotSpotAvgPrizeSchemeId = hotSpotAvgPrizeSchemeId ? parseInt(hotSpotAvgPrizeSchemeId) : null;

    const season = await prisma.season.update({
      where: { id: seasonId, eventId },
      data,
    });

    return NextResponse.json({ season });
  } catch (error) {
    console.error("Error updating season:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
