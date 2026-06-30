import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { computePaymentStatus } from "@/lib/paymentStatus";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });

  try {
    const inventories = await prisma.eventInventory.findMany({
      where: { eventId, cashPromised: false },
      include: {
        breeder: true,
        payments: true,
        items: {
          include: { bird: { select: { band: true, band1: true, band2: true, band3: true, band4: true, birdName: true, color: true, sex: true } } },
          orderBy: { birdNo: "asc" },
        },
      },
    });

    const defaulters = inventories
      .filter((inv) => {
        const status = computePaymentStatus(inv.items, inv.payments);
        return status === "PENDING" || status === "PARTIAL";
      })
      .map((inv) => ({
        eventInventoryId: inv.id,
        breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
        loft: inv.loft,
        birds: inv.items.map((item) => ({
          id: item.id,
          band: item.bird?.band,
          band1: item.bird?.band1,
          band2: item.bird?.band2,
          band3: item.bird?.band3,
          band4: item.bird?.band4,
          birdName: item.bird?.birdName,
          color: item.bird?.color,
          sex: item.bird?.sex,
        })),
      }));

    return NextResponse.json({ defaulters });
  } catch (error) {
    console.error("Error fetching public defaulters:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
