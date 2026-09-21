import {
    chargeableGate,
    GATE_BIT,
    HOTSPOT_CASCADE,
    type HotspotGate,
} from "@/lib/fee-calculator";

export type PaymentStatus = "PAID" | "OVERPAID" | "PENDING" | "PARTIAL" | "NA";

export const VALID_PAYMENT_STATUS: ReadonlyArray<PaymentStatus> = [
    "PAID",
    "OVERPAID",
    "PENDING",
    "PARTIAL",
    "NA",
];

export interface PaymentStatusItem {
    entryFeeValue?: number | null;
    perchFeeValue?: number | null;
    raceFeeValue?: number | null;
    /** Total of the four gates. Not what is owed — see `hotspotOwedFor`. */
    hotSpotFeeValue?: number | null;
    hotSpot1FeeValue?: number | null;
    hotSpot2FeeValue?: number | null;
    hotSpot3FeeValue?: number | null;
    hotSpotFinalFeeValue?: number | null;
}

export interface PaymentStatusPayment {
    paymentValue?: number | null;
    paymentDesc?: string | null;
    paymentType?: number | null;
}

/**
 * What one bird owes for hotspots, under the active cascade rule.
 *
 * Cumulative — every priced gate is its own charge, so the bird owes the sum of
 * the gates, less any already settled. Paying Final settles everything before
 * it, which `maskAfterPaying` encodes, so it needs no special case here.
 *
 * Single — one obligation with four prices, so exactly one gate is owed: the
 * one already settled, or the one the season has reached. `openGate` is that
 * one; it defaults to HS1, which is the scheme as written and what callers
 * with no season to hand should charge.
 *
 * Registrations written before the gates were split have only the old bucket
 * column filled. Those fall back to it, because the alternative is their
 * hotspot charge silently becoming zero.
 */
export function hotspotOwedFor(
    item: PaymentStatusItem,
    hotspotsPaidMask = 0,
    openGate: HotspotGate = "HS1"
): number {
    const gates = [
        item.hotSpot1FeeValue ?? 0,
        item.hotSpot2FeeValue ?? 0,
        item.hotSpot3FeeValue ?? 0,
        item.hotSpotFinalFeeValue ?? 0,
    ];

    if (gates.every((g) => g === 0)) return item.hotSpotFeeValue ?? 0;

    if (HOTSPOT_CASCADE === "CUMULATIVE") {
        return gates.reduce(
            (sum, amount, i) => sum + ((hotspotsPaidMask & (1 << i)) !== 0 ? 0 : amount),
            0
        );
    }

    if (hotspotsPaidMask !== 0) {
        const settledAt = gates.findIndex((_, i) => (hotspotsPaidMask & (1 << i)) !== 0);
        if (settledAt >= 0) return gates[settledAt];
    }

    const gate = chargeableGate(
        { HS1: gates[0], HS2: gates[1], HS3: gates[2], FINAL: gates[3] },
        openGate
    );
    return gate ? gates[GATE_BIT[gate]] : 0;
}

export interface PaymentTotals {
    owed: number;
    totalPaid: number;
    balance: number;
    status: PaymentStatus;
}

/**
 * The ledger for one registration.
 *
 * Payouts (type 3) are money going the other way and are netted off rather than
 * counted as receipts. Bet stakes ride on the same payment row as registration
 * fees but are not a registration fee, so they are excluded by description —
 * which is fragile, and the reason bets should carry their own type.
 */
export function computePaymentTotals(
    items: ReadonlyArray<PaymentStatusItem>,
    payments: ReadonlyArray<PaymentStatusPayment>,
    hotspotsPaidMask = 0,
    openGate: HotspotGate = "HS1"
): PaymentTotals {
    const owed = items.reduce(
        (s, i) =>
            s +
            (i.entryFeeValue ?? 0) +
            (i.perchFeeValue ?? 0) +
            (i.raceFeeValue ?? 0) +
            hotspotOwedFor(i, hotspotsPaidMask, openGate),
        0
    );

    const refundsOut = payments
        .filter((p) => p.paymentType === 3)
        .reduce((s, p) => s + Math.abs(p.paymentValue ?? 0), 0);

    const totalPaid =
        payments
            .filter((p) => !p.paymentDesc?.toLowerCase().includes("bet stake") && p.paymentType !== 3)
            .reduce((s, p) => s + (p.paymentValue ?? 0), 0) - refundsOut;

    let status: PaymentStatus;
    if (owed === 0) status = "NA";
    else if (totalPaid > owed) status = "OVERPAID";
    else if (totalPaid === owed && totalPaid > 0) status = "PAID";
    else if (totalPaid > 0 && totalPaid < owed) status = "PARTIAL";
    else status = "PENDING";

    return {
        owed: Math.round(owed * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        balance: Math.round((owed - totalPaid) * 100) / 100,
        status,
    };
}

export function computePaymentStatus(
    items: ReadonlyArray<PaymentStatusItem>,
    payments: ReadonlyArray<PaymentStatusPayment>,
    hotspotsPaidMask = 0,
    openGate: HotspotGate = "HS1"
): PaymentStatus {
    return computePaymentTotals(items, payments, hotspotsPaidMask, openGate).status;
}
