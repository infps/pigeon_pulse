import { auth } from "@/lib/auth";
import { requireAnyPermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { computePaymentTotals, hotspotOwedFor, VALID_PAYMENT_STATUS, type PaymentStatus } from "@/lib/paymentStatus";
import { openHotspotGate } from "@/lib/hotspot-gates";

type HybridStatus = PaymentStatus;

const VALID_STATUS = VALID_PAYMENT_STATUS;

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId: eventIdParam } = await params;
    const eventId = parseInt(eventIdParam);

    if (isNaN(eventId)) {
        return NextResponse.json({ message: "Invalid event ID" }, { status: 400 });
    }

    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });
        const guard = await requireAnyPermission(["breeders.view", "breeders.manage"]);
        if ("error" in guard) return guard.error;

        const { searchParams } = new URL(request.url);
        const seasonIdParam = searchParams.get("seasonId");
        const paymentStatusParam = searchParams.get("paymentStatus");
        const arrivalFromParam = searchParams.get("arrivalFrom");
        const arrivalToParam = searchParams.get("arrivalTo");
        // Participants by default; the waiting and rejected lists ask for theirs.
        const approvalParam = searchParams.get("approval");
        const approvalStatus =
            approvalParam === "WAITING" || approvalParam === "REJECTED" ? approvalParam : "APPROVED";

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

        const paymentStatusFilter: HybridStatus | null =
            paymentStatusParam && paymentStatusParam !== "all" && (VALID_STATUS as ReadonlyArray<string>).includes(paymentStatusParam)
                ? (paymentStatusParam as HybridStatus)
                : null;
        const arrivalFrom = arrivalFromParam ? new Date(arrivalFromParam) : null;
        const arrivalTo = arrivalToParam ? new Date(arrivalToParam) : null;
        const hasArrivalFilter = (arrivalFrom && !isNaN(arrivalFrom.getTime())) || (arrivalTo && !isNaN(arrivalTo.getTime()));

        const fromMs = arrivalFrom && !isNaN(arrivalFrom.getTime()) ? arrivalFrom.getTime() : null;
        const toMs = arrivalTo && !isNaN(arrivalTo.getTime()) ? arrivalTo.getTime() : null;

        const eventInventory = await prisma.eventInventory.findMany({
            where: {
                seasonId,
                approvalStatus,
                ...(hasArrivalFilter && {
                    items: {
                        some: {
                            raceItems: {
                                some: {
                                    result: {
                                        arrivalTime: {
                                            ...(fromMs ? { gte: new Date(fromMs) } : {}),
                                            ...(toMs ? { lte: new Date(toMs) } : {}),
                                        },
                                    },
                                },
                            },
                        },
                    },
                }),
            },
            orderBy: approvalStatus === "WAITING" ? { waitingDate: "asc" } : undefined,
            include: {
                breeder: true,
                payments: true,
                items: {
                    select: {
                        id: true,
                        entryFeeValue: true,
                        perchFeeValue: true,
                        raceFeeValue: true,
                        hotSpotFeeValue: true,
                        hotSpot1FeeValue: true,
                        hotSpot2FeeValue: true,
                        hotSpot3FeeValue: true,
                        hotSpotFinalFeeValue: true,
                        birdId: true,
                        eventInventoryId: true,
                    },
                },
            },
        });

        // Per-registration fee totals + hybrid status, computed once here so the
        // table needs no per-row queries. Same calc as defaulters / fee-breakdown.
        const openGate = await openHotspotGate(seasonId);
        const withTotals = eventInventory.map((inv) => {
            const t = computePaymentTotals(inv.items, inv.payments, inv.hotspotsPaidMask, openGate);
            const sum = (f: (i: (typeof inv.items)[number]) => number) => inv.items.reduce((s, i) => s + f(i), 0);
            return {
                ...inv,
                feeTotals: {
                    entry: sum((i) => i.entryFeeValue ?? 0),
                    perBird: sum((i) => i.perchFeeValue ?? 0),
                    perchHotspot: sum((i) => hotspotOwedFor(i, inv.hotspotsPaidMask, openGate)),
                    race: sum((i) => i.raceFeeValue ?? 0),
                    owed: t.owed,
                    paid: t.totalPaid,
                    status: t.status,
                },
            };
        });

        const filtered = paymentStatusFilter
            ? withTotals.filter((inv) => inv.feeTotals.status === paymentStatusFilter)
            : withTotals;

        return NextResponse.json(
            { eventInventory: filtered, message: "Event inventory fetched successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching event inventory:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}
