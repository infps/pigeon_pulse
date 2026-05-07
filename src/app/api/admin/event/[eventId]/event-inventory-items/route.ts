import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { PaymentStatus } from "@/generated/prisma/enums";

type HybridStatus = "PAID" | "PENDING" | "PARTIAL" | "FAILED" | "REFUNDED";

const VALID_STATUS: ReadonlyArray<HybridStatus> = [
  "PAID",
  "PENDING",
  "PARTIAL",
  "FAILED",
  "REFUNDED",
];

function computeHybridStatus(
  items: ReadonlyArray<{ entryFeeValue: number | null; perchFeeValue: number | null; raceFeeValue: number | null; hotSpotFeeValue: number | null }>,
  payments: ReadonlyArray<{ paymentValue: number | null; status: PaymentStatus | null }>
): HybridStatus {
  if (payments.some((p) => p.status === "FAILED")) return "FAILED";
  if (payments.length > 0 && payments.every((p) => p.status === "REFUNDED")) return "REFUNDED";
  const owed = items.reduce(
    (s, i) => s + (i.entryFeeValue ?? 0) + (i.perchFeeValue ?? 0) + (i.raceFeeValue ?? 0) + (i.hotSpotFeeValue ?? 0),
    0
  );
  const paid = payments
    .filter((p) => p.status === "PAID" || p.status === "PARTIAL")
    .reduce((s, p) => s + (p.paymentValue ?? 0), 0);
  if (owed === 0) return "PENDING";
  if (paid >= owed) return "PAID";
  if (paid === 0) return "PENDING";
  return "PARTIAL";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: eventIdParam } = await params;
  const eventId = parseInt(eventIdParam);

  if (isNaN(eventId)) {
    return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentStatusParam = searchParams.get("paymentStatus");
    const arrivalFromParam = searchParams.get("arrivalFrom");
    const arrivalToParam = searchParams.get("arrivalTo");

    const paymentStatusFilter: HybridStatus | null =
      paymentStatusParam && paymentStatusParam !== "all" && (VALID_STATUS as ReadonlyArray<string>).includes(paymentStatusParam)
        ? (paymentStatusParam as HybridStatus)
        : null;
    const arrivalFrom = arrivalFromParam ? new Date(arrivalFromParam) : null;
    const arrivalTo = arrivalToParam ? new Date(arrivalToParam) : null;
    const hasArrivalFilter = (arrivalFrom && !isNaN(arrivalFrom.getTime())) || (arrivalTo && !isNaN(arrivalTo.getTime()));

    const eventInventoryItems = await prisma.eventInventoryItem.findMany({
      where: {
        eventInventory: {
          eventId: eventId,
        },
      },
      include: {
        bird: true,
        eventInventory: {
          include: {
            breeder: true,
            items: true,
            payments: true,
          },
        },
        raceItems: {
          include: { result: true },
        },
      },
      orderBy: {
        eventInventory: {
          signInDate: "desc",
        },
      },
    });

    const filtered = eventInventoryItems.filter((item) => {
      if (paymentStatusFilter) {
        const inv = item.eventInventory;
        if (!inv) return false;
        const status = computeHybridStatus(inv.items, inv.payments);
        if (status !== paymentStatusFilter) return false;
      }
      if (hasArrivalFilter) {
        const fromMs = arrivalFrom && !isNaN(arrivalFrom.getTime()) ? arrivalFrom.getTime() : -Infinity;
        const toMs = arrivalTo && !isNaN(arrivalTo.getTime()) ? arrivalTo.getTime() : Infinity;
        const matched = item.raceItems.some((ri) => {
          const t = ri.result?.arrivalTime;
          if (!t) return false;
          const ms = new Date(t).getTime();
          return ms >= fromMs && ms <= toMs;
        });
        if (!matched) return false;
      }
      return true;
    });

    return NextResponse.json(
      {
        eventInventoryItems: filtered,
        message: "Event inventory items fetched successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching event inventory items:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
