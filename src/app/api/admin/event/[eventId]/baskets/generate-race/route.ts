import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface RaceBasketItem {
  id: number;
  bird: { band: string | null; birdName: string | null } | null;
  breederLastName: string;
}

interface ProposedRaceBasket {
  basketNo: number;
  capacity: number;
  items: RaceBasketItem[];
}

/**
 * Distribute birds across race baskets with breeder separation.
 *
 * Input: birdsPerBasket (K) — basket count derived as ceil(n / K).
 *
 * Step 1 — Prepare:
 *   Group by breeder, shuffle within each group, shuffle group order.
 *
 * Step 2 — Distribute:
 *   For each bird, try to place in a basket that is:
 *     (a) not full (< K)
 *     (b) does NOT already contain that breeder
 *   If multiple valid → pick randomly.
 *   If none → fallback: any non-full basket (collision unavoidable).
 */
function distributeRaceBaskets(items: RaceBasketItem[], birdsPerBasket: number): ProposedRaceBasket[] {
  const K = birdsPerBasket;
  const basketCount = Math.ceil(items.length / K);

  // Init baskets
  const baskets: ProposedRaceBasket[] = [];
  const breederSets: Set<string>[] = [];
  for (let i = 0; i < basketCount; i++) {
    baskets.push({ basketNo: i + 1, capacity: K, items: [] });
    breederSets.push(new Set());
  }

  // Step 1 — Prepare: group by breeder
  const byBreeder = new Map<string, RaceBasketItem[]>();
  for (const item of items) {
    const key = item.breederLastName;
    if (!byBreeder.has(key)) byBreeder.set(key, []);
    byBreeder.get(key)!.push(item);
  }

  // Shuffle within each group, then shuffle group order
  const groups: { breeder: string; birds: RaceBasketItem[] }[] = [];
  for (const [breeder, birds] of byBreeder) {
    groups.push({ breeder, birds: fisherYatesShuffle(birds) });
  }
  const shuffledGroups = fisherYatesShuffle(groups);

  // Step 2 — Distribute
  for (const group of shuffledGroups) {
    for (const bird of group.birds) {
      // Find valid baskets: not full AND no bird from this breeder yet
      const validIdxs: number[] = [];
      for (let i = 0; i < basketCount; i++) {
        if (baskets[i].items.length < K && !breederSets[i].has(bird.breederLastName)) {
          validIdxs.push(i);
        }
      }

      if (validIdxs.length > 0) {
        const picked = validIdxs[Math.floor(Math.random() * validIdxs.length)];
        baskets[picked].items.push(bird);
        breederSets[picked].add(bird.breederLastName);
      } else {
        // Fallback: any non-full basket (collision unavoidable)
        const fallbackIdxs: number[] = [];
        for (let i = 0; i < basketCount; i++) {
          if (baskets[i].items.length < K) {
            fallbackIdxs.push(i);
          }
        }
        if (fallbackIdxs.length > 0) {
          const picked = fallbackIdxs[Math.floor(Math.random() * fallbackIdxs.length)];
          baskets[picked].items.push(bird);
          breederSets[picked].add(bird.breederLastName);
        }
      }
    }
  }

  return baskets;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const birdsPerBasket = parseInt(body.birdsPerBasket);
    const preview = body.preview === true;

    if (isNaN(birdsPerBasket) || birdsPerBasket < 1) {
      return NextResponse.json({ message: "birdsPerBasket must be a positive integer" }, { status: 400 });
    }

    // Fetch items that have a LOFT basket assignment (already loft-basketted)
    const loftAssignments = await prisma.basketAssignment.findMany({
      where: {
        eventBasket: { eventId, phase: "LOFT" },
      },
      include: {
        inventoryItem: {
          include: {
            bird: { select: { band: true, birdName: true } },
            eventInventory: {
              include: {
                breeder: { select: { lastName: true } },
              },
            },
          },
        },
      },
    });

    if (loftAssignments.length === 0) {
      return NextResponse.json(
        { message: "No loft-basketted birds found. Generate loft baskets first.", baskets: [], summary: { total: 0, basketCount: 0 } },
        { status: 200 }
      );
    }

    if (birdsPerBasket > loftAssignments.length) {
      return NextResponse.json(
        { message: `Birds per basket (${birdsPerBasket}) exceeds total birds (${loftAssignments.length})` },
        { status: 400 }
      );
    }

    const items: RaceBasketItem[] = loftAssignments.map((a) => ({
      id: a.eventInventoryItemId,
      bird: a.inventoryItem?.bird ?? null,
      breederLastName: a.inventoryItem?.eventInventory?.breeder?.lastName ?? "Unknown",
    }));

    const proposed = distributeRaceBaskets(items, birdsPerBasket);

    if (preview) {
      return NextResponse.json({
        preview: true,
        baskets: proposed.map((b) => ({
          basketNo: b.basketNo,
          capacity: b.capacity,
          birdCount: b.items.length,
          breeders: [...new Set(b.items.map((i) => i.breederLastName))],
          birds: b.items.map((i) => ({ id: i.id, band: i.bird?.band, name: i.bird?.birdName, breeder: i.breederLastName })),
        })),
        summary: { total: items.length, basketCount: proposed.length },
      });
    }

    // Confirm: persist in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing RACE baskets for this event
      await tx.eventBasket.deleteMany({ where: { eventId, phase: "RACE" } });

      const createdBaskets = [];
      for (const basket of proposed) {
        const created = await tx.eventBasket.create({
          data: {
            eventId,
            basketNo: basket.basketNo,
            capacity: basket.capacity,
            phase: "RACE",
            assignments: {
              createMany: {
                data: basket.items.map((item) => ({
                  eventInventoryItemId: item.id,
                })),
              },
            },
          },
          include: { _count: { select: { assignments: true } } },
        });
        createdBaskets.push(created);
      }

      return createdBaskets;
    });

    return NextResponse.json({
      preview: false,
      baskets: result,
      summary: { total: items.length, basketCount: result.length },
      message: "Race baskets generated successfully",
    });
  } catch (error) {
    console.error("Error generating race baskets:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
