/**
 * Accounting — the reports behind WinCompanion's Accounting and Refunds columns.
 *
 * Paid Entry, Pay Entry, Entry Invoice, Prize Statements, Earned, Unpaid.
 *
 * These are reports over money the system already records, not a second ledger.
 * Every figure here traces to a Payment, a Refund, a RaceItemResult prize or
 * a class payout — nothing is stored twice, so nothing can disagree with itself.
 */

import { prisma } from "@/lib/prisma";
import { activeItem } from "@/lib/entry-filters";
import { prizeRoleOf, raceTypeWithRole, itemBetsValue, seasonAccounts } from "@/lib/hayloft-account";
import { hotspotOwedFor } from "@/lib/paymentStatus";
import { openHotspotGate } from "@/lib/hotspot-gates";

export interface LedgerLine {
  eventInventoryId: number;
  breederId: number | null;
  breederName: string;
  loft: string | null;
  /** Registration fees charged across all birds. */
  charged: number;
  /** Entry and hot spot refunds recorded on the bird entries themselves. */
  itemRefunds: number;
  /** Transfer charges recorded on the bird entries. */
  transferDue: number;
  /** HayLoft's total of payments (PAYMENT_CALC): payouts paid out count negative. */
  paid: number;
  /** Money returned through the refunds ledger. */
  refunded: number;
  /** Refunds recorded as owed but not yet paid back (rejected after paying). */
  refundOwed: number;
  /** Race prize money. */
  prizeEarned: number;
  /** Class payouts. */
  classEarned: number;
  /** HayLoft's BALANCE_VALUE (positive: they owe; negative: they are owed). */
  balance: number;
  /** What the organization owes them. */
  owedOut: number;
  cashPromised: boolean;
}

export interface LedgerTotals {
  charged: number;
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
 * One line per registration: HayLoft's account for it (lib/hayloft-account,
 * a port of EVENT_INVENTORY_GET), so every figure is HayLoft's.
 *
 *   charged  fees + class bets + transfer due (+ portal race fees and pool
 *            stakes), less the refunds set on the birds
 *   paid     HayLoft's total of payments (payouts paid out count negative)
 *   won      prizes HayLoft owes: final race, Hot Spot 1 and 2, average speed,
 *            and class-bet winnings (+ portal class payouts)
 *   balance  HayLoft's BALANCE_VALUE: charged − won − paid. Positive, the
 *            breeder owes; negative, the organization owes them. The portal's
 *            own refunds ledger adjusts it (issued: money back; owed: due).
 */
export async function seasonLedger(seasonId: number): Promise<Ledger> {
  const [{ accounts }, inventories] = await Promise.all([
    seasonAccounts(seasonId),
    prisma.eventInventory.findMany({
      where: { seasonId },
      select: {
        id: true,
        loft: true,
        cashPromised: true,
        breeder: { select: { firstName: true, lastName: true } },
        items: {
          where: { deletedAt: null },
          select: { raceClassEntries: { select: { payoutValue: true } } },
        },
        refunds: { select: { amount: true, status: true } },
      },
    }),
  ]);
  const invById = new Map(inventories.map((i) => [i.id, i]));

  const lines: LedgerLine[] = [];
  // The same figures unrounded: HayLoft totals its exact 4-decimal values.
  const exactLines: Array<Omit<LedgerLine, "breederName" | "loft" | "cashPromised" | "breederId" | "eventInventoryId">> = [];
  for (const a of accounts) {
    const inv = invById.get(a.eventInventoryId);
    if (!inv) continue;
    const refunded = inv.refunds.filter((r) => r.status === "ISSUED").reduce((s, r) => s + r.amount, 0);
    const refundOwed = inv.refunds.filter((r) => r.status === "OWED").reduce((s, r) => s + r.amount, 0);
    // Participants, plus anyone with money on the books: a registration that
    // is not approved is charged nothing, but what it paid or is owed stays.
    if (a.approvalStatus !== "APPROVED" && a.totalPayment === 0 && refundOwed === 0 && refunded === 0) continue;

    const classEarned = inv.items.reduce(
      (s, it) => s + it.raceClassEntries.reduce((t, ce) => t + (ce.payoutValue ?? 0), 0),
      0
    );
    const itemRefunds = a.entryRefund + a.betsRefund + a.hotSpotRefund;
    const charged =
      a.perchFee + a.entryFee + a.hotSpotFee + a.betsValue + a.raceFee + a.poolStakes + a.transferDue - itemRefunds;
    const balance = a.balance - classEarned + refunded - refundOwed;

    exactLines.push({
      charged, itemRefunds, transferDue: a.transferDue, paid: a.totalPayment, refunded, refundOwed,
      prizeEarned: a.winnerPayoutValue, classEarned, balance, owedOut: Math.max(0, -balance),
    });
    lines.push({
      eventInventoryId: a.eventInventoryId,
      breederId: a.breederId,
      breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
      loft: inv.loft,
      charged: round(charged),
      itemRefunds: round(itemRefunds),
      transferDue: round(a.transferDue),
      paid: round(a.totalPayment),
      refunded: round(refunded),
      refundOwed: round(refundOwed),
      prizeEarned: round(a.winnerPayoutValue),
      classEarned: round(classEarned),
      balance: round(balance),
      owedOut: round(Math.max(0, -balance)),
      cashPromised: inv.cashPromised === true,
    });
  }

  lines.sort((a, b) => a.breederName.localeCompare(b.breederName));

  // Totals are summed from the exact figures, then rounded once, as HayLoft
  // does; summing lines already rounded to the cent drifts by cents.
  const exact = (pick: (a: (typeof exactLines)[number]) => number) =>
    round(exactLines.reduce((s, l) => s + pick(l), 0));
  const totals: LedgerTotals = {
    charged: exact((l) => l.charged),
    paid: exact((l) => l.paid),
    refunded: exact((l) => l.refunded),
    prizeEarned: exact((l) => l.prizeEarned),
    classEarned: exact((l) => l.classEarned),
    balance: exact((l) => l.balance),
    owedOut: exact((l) => l.owedOut),
  };

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
  /** Prizes and class-bet winnings HayLoft owes this registration. */
  won: number;
  refunded: number;
  /** HayLoft's BALANCE_VALUE (positive: they owe; negative: they are owed). */
  balance: number;
}

/**
 * An entry invoice for one registration: what was charged, what was paid, and
 * what is left. Built per bird so a breeder can see which entry cost what.
 * The lines add up to HayLoft's charges for the registration, and paid, won
 * and balance are HayLoft's account for it (lib/hayloft-account).
 */
export async function entryInvoice(eventInventoryId: number): Promise<Invoice | null> {
  const inv = await prisma.eventInventory.findUnique({
    where: { id: eventInventoryId },
    select: {
      id: true,
      loft: true,
      breeder: { select: { firstName: true, lastName: true } },
      seasonId: true,
      approvalStatus: true,
      hotspotsPaidMask: true,
      season: {
        select: {
          name: true,
          event: { select: { name: true } },
          bettingScheme: true,
        },
      },
      items: {
        where: { deletedAt: null },
        select: {
          birdNo: true,
          hotSpot1FeeValue: true,
          hotSpot2FeeValue: true,
          hotSpot3FeeValue: true,
          hotSpotFinalFeeValue: true,
          betsRefund: true,
          belgianShowBet1: true, belgianShowBet2: true, belgianShowBet3: true, belgianShowBet4: true,
          belgianShowBet5: true, belgianShowBet6: true, belgianShowBet7: true,
          standardShowBet1: true, standardShowBet2: true, standardShowBet3: true,
          standardShowBet4: true, standardShowBet5: true, standardShowBet6: true,
          wtaBet1: true, wtaBet2: true, wtaBet3: true, wtaBet4: true, wtaBet5: true,
          entryFeeValue: true,
          perchFeeValue: true,
          hotSpotFeeValue: true,
          raceFeeValue: true,
          entryRefund: true,
          hotSpotRefund: true,
          transferDue: true,
          bird: { select: { band1: true, band2: true, band3: true, band4: true, band: true } },
          raceClassEntries: {
            select: { feeCharged: true, raceClass: { select: { code: true } } },
          },
        },
        orderBy: { birdNo: "asc" },
      },
      refunds: { select: { amount: true, status: true } },
    },
  });
  if (!inv || inv.seasonId == null) return null;

  const [{ accounts }, openGate] = await Promise.all([
    seasonAccounts(inv.seasonId, { inventoryIds: [inv.id] }),
    openHotspotGate(inv.seasonId),
  ]);
  const account = accounts[0];
  const billable = inv.approvalStatus === "APPROVED";
  const scheme = inv.season?.bettingScheme ?? null;

  const lines: InvoiceLine[] = [];

  for (const item of inv.items) {
    const band =
      [item.bird?.band1, item.bird?.band2, item.bird?.band3, item.bird?.band4]
        .filter(Boolean)
        .join("-") || item.bird?.band || "";
    const label = `Bird ${item.birdNo ?? "?"}${band ? ` — ${band}` : ""}`;

    // A registration that is not approved is charged nothing.
    if (!billable) continue;
    const hotSpot = hotspotOwedFor(item, inv.hotspotsPaidMask, openGate);
    const bets = itemBetsValue(item, scheme);
    if (item.entryFeeValue) lines.push({ label, detail: "Entry fee", amount: item.entryFeeValue });
    if (item.perchFeeValue) lines.push({ label, detail: "Perch fee", amount: item.perchFeeValue });
    if (hotSpot) lines.push({ label, detail: "Hot spot fee", amount: hotSpot });
    if (bets) lines.push({ label, detail: "Class bets", amount: bets });
    if (item.raceFeeValue) lines.push({ label, detail: "Race fee", amount: item.raceFeeValue });
    if (item.transferDue) lines.push({ label, detail: "Transfer due", amount: item.transferDue });
    if (item.entryRefund) lines.push({ label, detail: "Entry refund", amount: -item.entryRefund });
    if (item.betsRefund) lines.push({ label, detail: "Bets refund", amount: -item.betsRefund });
    if (item.hotSpotRefund)
      lines.push({ label, detail: "Hot spot refund", amount: -item.hotSpotRefund });

    for (const ce of item.raceClassEntries) {
      if (!ce.feeCharged) continue;
      lines.push({ label, detail: `Class ${ce.raceClass?.code ?? "?"}`, amount: ce.feeCharged });
    }
  }

  if (billable && account?.poolStakes) {
    lines.push({ label: "Registration", detail: "Pool bet stakes", amount: account.poolStakes });
  }

  const charged = round(lines.reduce((sum, l) => sum + l.amount, 0));
  const refunded = round(inv.refunds.filter((r) => r.status === "ISSUED").reduce((s, r) => s + r.amount, 0));
  const refundOwed = inv.refunds.filter((r) => r.status === "OWED").reduce((s, r) => s + r.amount, 0);
  const paid = round(account?.totalPayment ?? 0);
  const won = round(account?.winnerPayoutValue ?? 0);

  return {
    eventInventoryId: inv.id,
    breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
    loft: inv.loft,
    eventName: inv.season?.event?.name ?? null,
    seasonName: inv.season?.name ?? null,
    lines,
    charged,
    paid,
    won,
    refunded,
    balance: round((account?.balance ?? 0) + refunded - refundOwed),
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
 * Prize statements: everything HayLoft owes the breeders of a season, one line
 * per prize, because a breeder is owed one cheque and does not care which pot
 * it came from. The lines are HayLoft's prize components (lib/hayloft-account,
 * WINNER_PRIZE_PAYOUT_BIRD_GET + RACE_BETS_CALC): final race, Hot Spot 1 and 2,
 * average speed, and class-bet winnings; plus portal class payouts. The total
 * equals the ledger's "Won" column.
 */
export async function prizeStatements(seasonId: number): Promise<{
  rows: PrizeStatementRow[];
  total: number;
}> {
  const { accounts } = await seasonAccounts(seasonId);
  const itemIds = accounts.flatMap((a) => a.birdPrizes.map((p) => p.inventoryItemId));

  const [items, classRows] = await Promise.all([
    prisma.eventInventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        bird: { select: { band1: true, band2: true, band3: true, band4: true, band: true } },
        eventInventory: { select: { loft: true, breeder: { select: { firstName: true, lastName: true } } } },
        raceItems: {
          where: { race: { raceType: raceTypeWithRole("FINAL", "HOTSPOT_1", "HOTSPOT_2") } },
          select: { race: { select: { raceType: { select: { id: true, prizeRole: true } } } }, result: { select: { birdPosition: true } } },
        },
      },
    }),
    prisma.raceClassEntry.findMany({
      where: { payoutValue: { not: null }, raceClass: { seasonId }, inventoryItem: activeItem },
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
  const itemById = new Map(items.map((i) => [i.id, i]));

  const bandOf = (b: { band1?: string | null; band2?: string | null; band3?: string | null; band4?: string | null; band?: string | null } | null | undefined) =>
    b ? [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") || b.band || "" : "";

  const rows: PrizeStatementRow[] = [];
  let exactTotal = 0;
  for (const a of accounts) {
    for (const p of a.birdPrizes) {
      const it = itemById.get(p.inventoryItemId);
      const breeder = it?.eventInventory?.breeder;
      const posIn = (t: string) => it?.raceItems.find((r) => prizeRoleOf(r.race?.raceType) === t)?.result?.birdPosition ?? null;
      const base = {
        breederName: `${breeder?.firstName ?? ""} ${breeder?.lastName ?? ""}`.trim(),
        loft: it?.eventInventory?.loft ?? null,
        band: bandOf(it?.bird),
      };
      const parts: Array<[string, number, number | null]> = [
        ["Final race", p.capital, posIn("FINAL")],
        ["Hot Spot 1", p.hotSpot1, posIn("HOTSPOT_1")],
        ["Hot Spot 2", p.hotSpot2, posIn("HOTSPOT_2")],
        ["Average speed", p.avgSpeed, null],
        ["Class bets", p.bets, posIn("FINAL")],
      ];
      for (const [source, amount, position] of parts) {
        if (!amount) continue;
        exactTotal += amount;
        rows.push({ ...base, source, position, amount: round(amount) });
      }
    }
  }
  for (const c of classRows) {
    const breeder = c.inventoryItem?.eventInventory?.breeder;
    exactTotal += c.payoutValue ?? 0;
    rows.push({
      breederName: `${breeder?.firstName ?? ""} ${breeder?.lastName ?? ""}`.trim(),
      loft: c.inventoryItem?.eventInventory?.loft ?? null,
      band: bandOf(c.inventoryItem?.bird),
      source: `Class ${c.raceClass?.code ?? "?"}`,
      position: c.position,
      amount: round(c.payoutValue ?? 0),
    });
  }

  rows.sort((a, b) => a.breederName.localeCompare(b.breederName) || b.amount - a.amount);

  // Summed from the exact values, then rounded once, as the ledger and HayLoft do.
  return { rows, total: round(exactTotal) };
}
