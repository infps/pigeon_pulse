import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { computePaymentStatus, VALID_PAYMENT_STATUS, type PaymentStatus } from "@/lib/paymentStatus";

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
        if (!session || !session.user || !["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const seasonIdParam = searchParams.get("seasonId");
        const paymentStatusParam = searchParams.get("paymentStatus");
        const arrivalFromParam = searchParams.get("arrivalFrom");
        const arrivalToParam = searchParams.get("arrivalTo");

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

        const eventInventory = await prisma.eventInventory.findMany({
            where: {
                seasonId,
            },
            include: {
                breeder: true,
                payments: true,
                items: {
                    include: {
                        bird: true,
                        raceItems: {
                            include: { result: true },
                        },
                    },
                },
            },
        });

        const filtered = eventInventory.filter((inv) => {
            if (paymentStatusFilter) {
                const status = computePaymentStatus(inv.items, inv.payments);
                if (status !== paymentStatusFilter) return false;
            }
            if (hasArrivalFilter) {
                const fromMs = arrivalFrom && !isNaN(arrivalFrom.getTime()) ? arrivalFrom.getTime() : -Infinity;
                const toMs = arrivalTo && !isNaN(arrivalTo.getTime()) ? arrivalTo.getTime() : Infinity;
                const matched = inv.items.some((it) =>
                    it.raceItems.some((ri) => {
                        const t = ri.result?.arrivalTime;
                        if (!t) return false;
                        const ms = new Date(t).getTime();
                        return ms >= fromMs && ms <= toMs;
                    })
                );
                if (!matched) return false;
            }
            return true;
        });

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
