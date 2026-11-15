import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { hiddenRaceStatuses, isStaff } from "@/lib/visibility";
import { activeRaceItemOr } from "@/lib/entry-filters";
import { cached, raceKey } from "@/lib/ttl-cache";

/** Only what the public results page and the mobile live/result screens read. */
const itemSelect = {
  id: true,
  raceId: true,
  inventoryItemId: true,
  status: true,
  result: { select: { birdPosition: true, arrivalTime: true } },
  inventoryItem: {
    select: {
      bird: {
        select: {
          id: true,
          band: true,
          band1: true,
          band2: true,
          band3: true,
          band4: true,
          birdName: true,
          sex: true,
          color: true,
          breeder: {
            select: {
              id: true, // breeder popup + "active lofts" on public race page
              firstName: true,
              lastName: true,
              country: true,
              user: { select: { id: true, loftName: true, image: true } },
            },
          },
        },
      },
    },
  },
} as const;

async function loadRaceItems(raceId: number, staff: boolean) {
  const hiddenStatuses = staff ? [] : await hiddenRaceStatuses(raceId);

  const raceItems = await prisma.raceItem.findMany({
    where: {
      raceId,
      ...(hiddenStatuses.length > 0 && { status: { notIn: hiddenStatuses } }),
      OR: activeRaceItemOr,
    },
    select: itemSelect,
    orderBy: [{ result: { birdPosition: "asc" } }],
  });

  // Rank delta vs each bird's most recent prior race: one row per bird.
  // Same rule as before: earlier start time, a position held, entry approved and not deleted.
  const birdIds = raceItems
    .map((it) => it.inventoryItem?.bird?.id)
    .filter((id): id is number => typeof id === "number");

  const priorByBird = new Map<number, number>();
  if (birdIds.length > 0) {
    const prior = await prisma.$queryRaw<Array<{ birdId: number; pos: number }>>`
      SELECT DISTINCT ON (eii."ID_BIRD") eii."ID_BIRD" AS "birdId", rir."BIRD_POSITION" AS pos
      FROM "RaceItem" ri
      JOIN "RaceItemResult" rir ON rir."ID_RACE_ITEM" = ri."ID_RACE_ITEM"
      JOIN "EventInventoryItem" eii ON eii."ID_EVENT_INVENTORY_ITEM" = ri."ID_INVENTORY_ITEM"
      JOIN "EventInventory" ei ON ei."ID_EVENT_INVENTORY" = eii."ID_EVENT_INVENTORY"
      JOIN "Race" r ON r."ID_RACE" = ri."ID_RACE"
      WHERE eii."ID_BIRD" = ANY(${birdIds})
        AND ri."ID_RACE" <> ${raceId}
        AND rir."BIRD_POSITION" IS NOT NULL
        AND eii."DELETED_AT" IS NULL
        AND ei."APPROVAL_STATUS" = 'APPROVED'
        AND r."START_TIME" < (SELECT "START_TIME" FROM "Race" WHERE "ID_RACE" = ${raceId})
      ORDER BY eii."ID_BIRD", r."START_TIME" DESC, ri."ID_RACE_ITEM" DESC`;
    for (const p of prior) priorByBird.set(p.birdId, p.pos);
  }

  // Flatten nested relations for UI column accessors (matches admin API shape)
  const flattened = raceItems.map(({ inventoryItem, result, ...item }) => {
    const bird = inventoryItem?.bird ?? undefined;
    return {
      ...item,
      bird,
      birdPosition: result?.birdPosition ?? null,
      arrivalTime: result?.arrivalTime ?? null,
      previousPosition: bird ? priorByBird.get(bird.id) ?? null : null,
    };
  });

  // Prisma nulls-first on relation orderBy — push null-position birds to end
  flattened.sort((a, b) => {
    if (a.birdPosition == null && b.birdPosition == null) return 0;
    if (a.birdPosition == null) return 1;
    if (b.birdPosition == null) return -1;
    return a.birdPosition - b.birdPosition;
  });
  return flattened;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const { raceId } = await params;

    if (!raceId) {
      return NextResponse.json(
        { message: "Race ID is required" },
        { status: 400 }
      );
    }

    const raceIdInt = parseInt(raceId);

    const session = await auth.api.getSession({ headers: await headers() });
    const staff = isStaff(session?.user?.role);

    // Polled every 5-15s by every viewer of a live race; one DB pass per race per 3s.
    const raceItems = await cached(`${raceKey(raceIdInt)}items:${staff ? "staff" : "public"}`, 3000, () =>
      loadRaceItems(raceIdInt, staff)
    );

    return NextResponse.json(
      { raceItems, message: "Race items fetched successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching race items:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
