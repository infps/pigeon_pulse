/**
 * Accounting — the reports behind WinCompanion's Accounting and Refunds columns.
 *
 * Paid Entry, Pay Entry, Entry Invoice, Prize Statements, Earned, Unpaid.
 *
 * These are reports over money the system already records, not a second ledger.
 * Every figure here traces to a Payment, a Refund, a PaymentPenalty, a
 * RaceItemResult prize or a class payout — nothing is stored twice, so nothing
 * can disagree with itself.
 */

import { prisma } from "@/lib/prisma";

export interface LedgerLine {
  eventInventoryId: number;
  breederId: number | null;
  breederName: string;
  loft: string | null;
  /** Registration fees charged across all birds. */
  charged: number;
  /** Fee-level refunds recorded on the bird entries themselves. */
  itemRefunds: number;
  /** Late-payment penalties still standing. */
  penalties: number;
  /** Payments marked PAID. */
  paid: number;
  /** Money returned through the refunds ledger. */
  refunded: number;
  /** Race prize money. */
  prizeEarned: number;
  /** Class payouts. */
  classEarned: number;
  /** charged + penalties − itemRefunds − paid  (positive means they owe). */
  balance: number;
  /** What the organization owes them. */
  owedOut: number;
  cashPromised: boolean;
}

export interface LedgerTotals {
  charged: number;
  penalties: number;
  paid: number;
  refunded: number;
  prizeEarned: number;
  classEarned: number;
  balance: number;
  owedOut: number;
}

export interface Ledger {
  seasonId: number;
  lines: LedgerLine[];
  totals: LedgerTotals;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * One line per registration, covering everything owed in both directions.
 *
 * Money owed to a breeder is kept separate from money they owe rather than
 * netted off, because an organizer needs to see both: a breeder can be owed
 * prize money and still be behind on fees, and collapsing that into one number
 * hides the collection problem.
 */
export async function seasonLedger(seasonId: number): Promise<Ledger> {
  const inventories = await prisma.eventInventory.findMany({
    where: { seasonId },
    select: {
      id: true,
      loft: true,
      breederId: true,
      cashPromised: true,
      breeder: { select: { firstName: true, lastName: true } },
      items: {
        select: {
          entryFeeValue: true,
          perchFeeValue: true,
          hotSpotFeeValue: true,
          raceFeeValue: true,
          entryRefund: true,
          hotSpotRefund: true,
          betsRefund: true,
          raceItems: { select: { result: { select: { prizeValue: true } } } },
          raceClassEntries: { select: { payoutValue: true } },
        },
      },
      payments: { select: { paymentValue: true, status: true } },
      refunds: { select: { amount: true } },
      penalties: { where: { waivedAt: null }, select: { amount: true } },
    },
  });

  const lines: LedgerLine[] = inventories.map((inv) => {
    const charged = inv.items.reduce(
      (sum, it) =>
        sum +
        (it.entryFeeValue ?? 0) +
        (it.perchFeeValue ?? 0) +
        (it.hotSpotFeeValue ?? 0) +
        (it.raceFeeValue ?? 0),
      0
    );
    const itemRefunds = inv.items.reduce(
      (sum, it) => sum + (it.entryRefund ?? 0) + (it.hotSpotRefund ?? 0) + (it.betsRefund ?? 0),
      0
    );
    const prizeEarned = inv.items.reduce(
      (sum, it) =>
        sum + it.raceItems.reduce((s, ri) => s + (ri.result?.prizeValue ?? 0), 0),
      0
    );
    const classEarned = inv.items.reduce(
      (sum, it) => sum + it.raceClassEntries.reduce((s, ce) => s + (ce.payoutValue ?? 0), 0),
      0
    );
    const paid = inv.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + (p.paymentValue ?? 0), 0);
    const refunded = inv.refunds.reduce((sum, r) => sum + r.amount, 0);
    const penalties = inv.penalties.reduce((sum, p) => sum + p.amount, 0);

    return {
      eventInventoryId: inv.id,
      breederId: inv.breederId ?? null,
      breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
      loft: inv.loft,
      charged: round(charged),
      itemRefunds: round(itemRefunds),
      penalties: round(penalties),
      paid: round(paid),
      refunded: round(refunded),
      prizeEarned: round(prizeEarned),
      classEarned: round(classEarned),
      balance: round(charged + penalties - itemRefunds - paid),
      owedOut: round(prizeEarned + classEarned - refunded),
      cashPromised: inv.cashPromised === true,
    };
  });

  lines.sort((a, b) => a.breederName.localeCompare(b.breederName));

  const totals = lines.reduce<LedgerTotals>(
    (acc, l) => ({
      charged: round(acc.charged + l.charged),
      penalties: round(acc.penalties + l.penalties),
      paid: round(acc.paid + l.paid),
      refunded: round(acc.refunded + l.refunded),
      prizeEarned: round(acc.prizeEarned + l.prizeEarned),
      classEarned: round(acc.classEarned + l.classEarned),
      balance: round(acc.balance + l.balance),
      owedOut: round(acc.owedOut + l.owedOut),
    }),
    {
      charged: 0,
      penalties: 0,
      paid: 0,
      refunded: 0,
      prizeEarned: 0,
      classEarned: 0,
      balance: 0,
      owedOut: 0,
    }
  );

  return { seasonId, lines, totals };
}

export interface InvoiceLine {
  label: string;
  detail: string | null;
  amount: number;
}

export interface Invoice {
  eventInventoryId: number;
  breederName: string;
  loft: string | null;
  eventName: string | null;
  seasonName: string | null;
  lines: InvoiceLine[];
  charged: number;
  paid: number;
  refunded: number;
  balance: number;
}

/**
 * An entry invoice for one registration: what was charged, what was paid, and
 * what is left. Built per bird so a breeder can see which entry cost what.
 */
export async function entryInvoice(eventInventoryId: number): Promise<Invoice | null> {
  const inv = await prisma.eventInventory.findUnique({
    where: { id: eventInventoryId },
    select: {
      id: true,
      loft: true,
      breeder: { select: { firstName: true, lastName: true } },
      season: { select: { name: true, event: { select: { name: true } } } },
      items: {
        select: {
          birdNo: true,
          entryFeeValue: true,
          perchFeeValue: true,
          hotSpotFeeValue: true,
          raceFeeValue: true,
          bird: { select: { band1: true, band2: true, band3: true, band4: true, band: true } },
          raceClassEntries: {
            select: { feeCharged: true, raceClass: { select: { code: true } } },
          },
        },
        orderBy: { birdNo: "asc" },
      },
      payments: { select: { paymentValue: true, status: true } },
      refunds: { select: { amount: true } },
      penalties: { where: { waivedAt: null }, select: { amount: true, daysLate: true } },
    },
  });
  if (!inv) return null;

  const lines: InvoiceLine[] = [];

  for (const item of inv.items) {
    const band =
      [item.bird?.band1, item.bird?.band2, item.bird?.band3, item.bird?.band4]
        .filter(Boolean)
        .join("-") || item.bird?.band || "";
    const label = `Bird ${item.birdNo ?? "?"}${band ? ` — ${band}` : ""}`;

    if (item.entryFeeValue) lines.push({ label, detail: "Entry fee", amount: item.entryFeeValue });
    if (item.perchFeeValue) lines.push({ label, detail: "Perch fee", amount: item.perchFeeValue });
    if (item.hotSpotFeeValue)
      lines.push({ label, detail: "Hotspot fee", amount: item.hotSpotFeeValue });
    if (item.raceFeeValue) lines.push({ label, detail: "Race fee", amount: item.raceFeeValue });

    for (const ce of item.raceClassEntries) {
      if (!ce.feeCharged) continue;
      lines.push({ label, detail: `Class ${ce.raceClass?.code ?? "?"}`, amount: ce.feeCharged });
    }
  }

  for (const penalty of inv.penalties) {
    lines.push({
      label: "Late payment penalty",
      detail: `${penalty.daysLate} days past the deadline`,
      amount: penalty.amount,
    });
  }

  const charged = round(lines.reduce((sum, l) => sum + l.amount, 0));
  const paid = round(
    inv.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.paymentValue ?? 0), 0)
  );
  const refunded = round(inv.refunds.reduce((s, r) => s + r.amount, 0));

  return {
    eventInventoryId: inv.id,
    breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
    loft: inv.loft,
    eventName: inv.season?.event?.name ?? null,
    seasonName: inv.season?.name ?? null,
    lines,
    charged,
    paid,
    refunded,
    balance: round(charged - paid + refunded),
  };
}

export interface PrizeStatementRow {
  breederName: string;
  loft: string | null;
  band: string;
  source: string;
  position: number | null;
  amount: number;
}

/**
 * Prize statements: every payout owed across a season, race prizes and class
 * payouts together, because a breeder is owed one cheque and does not care
 * which pot it came from.
 */
export async function prizeStatements(seasonId: number): Promise<{
  rows: PrizeStatementRow[];
  total: number;
}> {
  const [raceRows, classRows] = await Promise.all([
    prisma.raceItemResult.findMany({
      where: {
        prizeValue: { not: null },
        raceItem: { race: { seasonId } },
      },
      select: {
        prizeValue: true,
        birdPosition: true,
        raceItem: {
          select: {
            race: { select: { name: true, raceNumber: true } },
            inventoryItem: {
              select: {
                bird: { select: { band1: true, band2: true, band3: true, band4: true, band: true } },
                eventInventory: {
                  select: {
                    loft: true,
                    breeder: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.raceClassEntry.findMany({
      where: { payoutValue: { not: null }, raceClass: { seasonId } },
      select: {
        payoutValue: true,
        position: true,
        raceClass: { select: { code: true } },
        inventoryItem: {
          select: {
            bird: { select: { band1: true, band2: true, band3: true, band4: true, band: true } },
            eventInventory: {
              select: { loft: true, breeder: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    }),
  ]);

  const bandOf = (b: { band1?: string | null; band2?: string | null; band3?: string | null; band4?: string | null; band?: string | null } | null | undefined) =>
    b ? [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") || b.band || "" : "";

  const rows: PrizeStatementRow[] = [
    ...raceRows.map((r) => {
      const inv = r.raceItem?.inventoryItem;
      const breeder = inv?.eventInventory?.breeder;
      const race = r.raceItem?.race;
      return {
        breederName: `${breeder?.firstName ?? ""} ${breeder?.lastName ?? ""}`.trim(),
        loft: inv?.eventInventory?.loft ?? null,
        band: bandOf(inv?.bird),
        source: race?.name || (race?.raceNumber != null ? `Race ${race.raceNumber}` : "Race"),
        position: r.birdPosition,
        amount: round(r.prizeValue ?? 0),
      };
    }),
    ...classRows.map((c) => {
      const breeder = c.inventoryItem?.eventInventory?.breeder;
      return {
        breederName: `${breeder?.firstName ?? ""} ${breeder?.lastName ?? ""}`.trim(),
        loft: c.inventoryItem?.eventInventory?.loft ?? null,
        band: bandOf(c.inventoryItem?.bird),
        source: `Class ${c.raceClass?.code ?? "?"}`,
        position: c.position,
        amount: round(c.payoutValue ?? 0),
      };
    }),
  ];

  rows.sort(
    (a, b) => a.breederName.localeCompare(b.breederName) || b.amount - a.amount
  );

  return { rows, total: round(rows.reduce((sum, r) => sum + r.amount, 0)) };
}
