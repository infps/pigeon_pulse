import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

interface BirdItem {
  id: number;
  birdId: number | null;
  bird: { id: number; band: string | null; birdName: string | null; rfid: string | null } | null;
  breederLastName: string;
  breederId: number | null;
}

interface ProposedBasket {
  basketNo: number;
  capacity: number;
  label: string;
  items: BirdItem[];
  breeders: string[];
}

function distributeLoftBaskets(checkedInItems: BirdItem[], capacity: number): ProposedBasket[] {
  // Group by breeder lastName
  const groups = new Map<string, BirdItem[]>();
  for (const item of checkedInItems) {
    const key = item.breederLastName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  // Sort by lastName alphabetically
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  const baskets: ProposedBasket[] = [];
  let current: BirdItem[] = [];
  // Track per-breeder basket count for label indexing
  const breederBasketCount = new Map<string, number>();

  const flushCurrent = () => {
    if (current.length === 0) return;
    const breeders = [...new Set(current.map((i) => i.breederLastName))];
    // Label uses primary breeder (first in basket)
    const primaryBreeder = current[0].breederLastName.toUpperCase();
    const idx = (breederBasketCount.get(primaryBreeder) ?? 0) + 1;
    breederBasketCount.set(primaryBreeder, idx);
    const label = `LB-${primaryBreeder}-${idx}`;
    baskets.push({
      basketNo: baskets.length + 1,
      capacity,
      label,
      items: [...current],
      breeders,
    });
    current = [];
  };

  for (const [, birds] of sortedGroups) {
    // Flush previous breeder's basket before starting a new breeder
    flushCurrent();

    let remaining = [...birds];

    while (remaining.length > 0) {
      const space = capacity - current.length;

      if (space <= 0) {
        flushCurrent();
        continue;
      }

      const batch = remaining.splice(0, space);
      current.push(...batch);
    }
  }

  flushCurrent();

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
    const capacity = parseInt(body.capacity);
    const preview = body.preview === true;

    if (isNaN(capacity) || capacity < 1) {
      return NextResponse.json({ message: "Capacity must be a positive integer" }, { status: 400 });
    }

    // Fetch checked-in items: bird has rfid AND breeder has PAID payment
    const items = await prisma.eventInventoryItem.findMany({
      where: {
        eventInventory: { eventId },
        bird: { rfid: { not: null } },
      },
      include: {
        bird: { select: { id: true, band: true, birdName: true, rfid: true } },
        eventInventory: {
          include: {
            breeder: { select: { id: true, firstName: true, lastName: true } },
            payments: { select: { status: true } },
          },
        },
      },
    });

    // Filter to only paid breeders
    const checkedIn: BirdItem[] = items
      .filter((item) => {
        const hasPaid = item.eventInventory?.payments?.some((p) => p.status === "PAID") ?? false;
        const hasRfid = item.bird?.rfid != null && item.bird.rfid !== "";
        return hasPaid && hasRfid;
      })
      .map((item) => ({
        id: item.id,
        birdId: item.birdId,
        bird: item.bird,
        breederLastName: item.eventInventory?.breeder?.lastName ?? "Unknown",
        breederId: item.eventInventory?.breeder?.id ?? null,
      }));

    if (checkedIn.length === 0) {
      return NextResponse.json(
        { message: "No checked-in birds found (need RFID + PAID payment)", baskets: [], summary: { total: 0, basketCount: 0 } },
        { status: 200 }
      );
    }

    const proposed = distributeLoftBaskets(checkedIn, capacity);

    if (preview) {
      return NextResponse.json({
        preview: true,
        baskets: proposed.map((b) => ({
          basketNo: b.basketNo,
          capacity: b.capacity,
          birdCount: b.items.length,
          breeders: b.breeders,
          birds: b.items.map((i) => ({ id: i.id, band: i.bird?.band, name: i.bird?.birdName, breeder: i.breederLastName })),
        })),
        summary: { total: checkedIn.length, basketCount: proposed.length },
      });
    }

    // Confirm: persist in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing LOFT baskets for this event (cascade deletes assignments)
      await tx.eventBasket.deleteMany({ where: { eventId, phase: "LOFT" } });

      // Create baskets + assignments
      const createdBaskets = [];
      const allInventoryItemIds: number[] = [];

      for (const basket of proposed) {
        const created = await tx.eventBasket.create({
          data: {
            eventId,
            basketNo: basket.basketNo,
            capacity: basket.capacity,
            phase: "LOFT",
            label: basket.label,
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
        allInventoryItemIds.push(...basket.items.map((i) => i.id));
      }

      // Bulk update RaceItems for these inventory items to LOFT_BASKETED
      await tx.raceItem.updateMany({
        where: {
          inventoryItemId: { in: allInventoryItemIds },
          status: { in: ["REGISTERED", "CHECKED_IN"] },
        },
        data: { status: "LOFT_BASKETED" },
      });

      return createdBaskets;
    });

    return NextResponse.json({
      preview: false,
      baskets: result,
      summary: { total: checkedIn.length, basketCount: result.length },
      message: "Loft baskets generated successfully",
    });
  } catch (error) {
    console.error("Error generating loft baskets:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
