import { requirePermission } from "@/lib/authorize";
import { averageSpeedWinners, setAverageSpeedPrizes } from "@/lib/hayloft-avg-speed";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * HayLoft's average-speed winners (RACE_AVG_SPEED_GET) and their prizes.
 *
 *   GET  ?seasonId=&raceIds=1,2,3&onlyHotSpotPaid=1   the ranking, with each rank's prize
 *   POST { seasonId, raceIds, onlyHotSpotPaid }        store the prizes (AVG_WINNER_PRIZE_SET):
 *                                                      the season's are replaced
 */
async function seasonOf(eventId: string, seasonId: number) {
  return prisma.season.findFirst({ where: { id: seasonId, eventId: parseInt(eventId, 10) }, select: { id: true } });
}

async function ranking(seasonId: number, raceIds: number[], onlyHotSpotPaid: boolean) {
  const rows = await averageSpeedWinners(seasonId, raceIds, { onlyHotSpotPaid, calcPrize: true });
  const items = await prisma.eventInventoryItem.findMany({
    where: { id: { in: rows.map((r) => r.inventoryItemId) } },
    select: {
      id: true,
      bird: { select: { id: true, band: true, band1: true, band2: true, band3: true, band4: true } },
      eventInventory: { select: { loft: true, breeder: { select: { firstName: true, lastName: true } } } },
    },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows.map((r) => {
    const it = byId.get(r.inventoryItemId);
    const b = it?.bird;
    return {
      ...r,
      birdId: b?.id ?? null,
      band: b ? [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") || b.band || "" : "",
      breederName: `${it?.eventInventory?.breeder?.firstName ?? ""} ${it?.eventInventory?.breeder?.lastName ?? ""}`.trim(),
      loft: it?.eventInventory?.loft ?? null,
    };
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const guard = await requirePermission("accounting.view");
  if ("error" in guard) return guard.error;
  const { eventId } = await params;
  const url = new URL(request.url);
  const seasonId = parseInt(url.searchParams.get("seasonId") ?? "", 10);
  const raceIds = (url.searchParams.get("raceIds") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const onlyHotSpotPaid = url.searchParams.get("onlyHotSpotPaid") === "1";
  if (Number.isNaN(seasonId) || !(await seasonOf(eventId, seasonId))) {
    return NextResponse.json({ message: "Season not found for this event" }, { status: 404 });
  }
  if (!raceIds.length) return NextResponse.json({ rows: [] });
  return NextResponse.json({ rows: await ranking(seasonId, raceIds, onlyHotSpotPaid) });
}

const postSchema = z.object({
  seasonId: z.number().int(),
  raceIds: z.array(z.number().int()).min(1),
  onlyHotSpotPaid: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const guard = await requirePermission("accounting.manage");
  if ("error" in guard) return guard.error;
  try {
    const { eventId } = await params;
    const { seasonId, raceIds, onlyHotSpotPaid } = postSchema.parse(await request.json());
    if (!(await seasonOf(eventId, seasonId))) {
      return NextResponse.json({ message: "Season not found for this event" }, { status: 404 });
    }
    const rows = await averageSpeedWinners(seasonId, raceIds, { onlyHotSpotPaid, calcPrize: true });
    const result = await setAverageSpeedPrizes(seasonId, rows);
    return NextResponse.json({
      ...result,
      message: `Average-speed prizes set: ${result.set} birds, $${result.total.toFixed(2)}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
    }
    console.error("Setting average-speed prizes failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
