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
 * What one bird owes for hotspots.
 *
 * The four gate prices are four chances to settle one obligation, not four
 * charges — so exactly one of them is owed: the gate already settled, or the
 * cheapest still on offer.
 *
 * Registrations written before the gates were split have only the old bucket
 * column filled. Those fall back to it, because the alternative is their
 * hotspot charge silently becoming zero.
 */
export function hotspotOwedFor(item: PaymentStatusItem, hotspotsPaidMask = 0): number {
    const gates = [
        item.hotSpot1FeeValue ?? 0,
        item.hotSpot2FeeValue ?? 0,
        item.hotSpot3FeeValue ?? 0,
        item.hotSpotFinalFeeValue ?? 0,
    ];

    if (gates.every((g) => g === 0)) return item.hotSpotFeeValue ?? 0;

    if (hotspotsPaidMask !== 0) {
        const settledAt = gates.findIndex((_, i) => (hotspotsPaidMask & (1 << i)) !== 0);
        if (settledAt >= 0) return gates[settledAt];
    }

    return gates.find((g) => g > 0) ?? 0;
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
    hotspotsPaidMask = 0
): PaymentTotals {
    const owed = items.reduce(
        (s, i) =>
            s +
            (i.entryFeeValue ?? 0) +
            (i.perchFeeValue ?? 0) +
            (i.raceFeeValue ?? 0) +
            hotspotOwedFor(i, hotspotsPaidMask),
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
    hotspotsPaidMask = 0
): PaymentStatus {
    return computePaymentTotals(items, payments, hotspotsPaidMask).status;
}
