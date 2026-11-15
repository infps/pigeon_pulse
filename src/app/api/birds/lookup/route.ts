import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/birds/lookup?band=...&seasonId=&eventId=
 * Finds a bird by its band, so any list that shows a band can open the bird
 * popup (web and mobile). A bird entered in the given season / event wins when
 * a band is not unique. Returns { birdId } or 404.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const band = (url.searchParams.get("band") ?? "").trim();
  if (!band) return NextResponse.json({ message: "band is required" }, { status: 400 });
  const seasonId = parseInt(url.searchParams.get("seasonId") ?? "", 10);
  const eventId = parseInt(url.searchParams.get("eventId") ?? "", 10);

  // Bands are shown both whole ("AU-26-AA-26817") and as parts; match either.
  const parts = band.split("-").map((p) => p.trim()).filter(Boolean);
  const where = {
    OR: [
      { band: { equals: band, mode: "insensitive" as const } },
      ...(parts.length === 4
        ? [{ band1: parts[0], band2: parts[1], band3: parts[2], band4: parts[3] }]
        : []),
    ],
  };
  const candidates = await prisma.bird.findMany({
    where,
    select: {
      id: true,
      inventoryItems: { select: { eventInventory: { select: { seasonId: true, season: { select: { eventId: true } } } } } },
    },
    take: 20,
  });
  if (candidates.length === 0) return NextResponse.json({ message: "Bird not found" }, { status: 404 });
  const inScope = candidates.find((c) =>
    c.inventoryItems.some(
      (i) =>
        (!Number.isNaN(seasonId) && i.eventInventory?.seasonId === seasonId) ||
        (!Number.isNaN(eventId) && i.eventInventory?.season?.eventId === eventId)
    )
  );
  return NextResponse.json({ birdId: (inScope ?? candidates[0]).id });
}
