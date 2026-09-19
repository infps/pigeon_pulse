/**
 * Escalating late-payment penalties.
 *
 * From the 2026-07-02 client meeting: "Late payment after deadline incurs
 * escalating fee; admin can waive with proof."
 *
 * The deadline is the payment-required race's start time — the same anchor the
 * defaulter window already uses, which opens seven days before it. Nothing is
 * charged until the grace period after that deadline has passed.
 *
 * Penalties are assessed rows rather than a number computed on read, so an
 * assessment can be waived, audited and reversed without rewriting history. A
 * waived row is kept; only live rows count toward what is owed.
 */

import { prisma } from "@/lib/prisma";
import type { LatePenaltyMode } from "@/generated/prisma/enums";
import { notifyPaymentDue } from "@/lib/notifications";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PenaltyConfig {
  mode: LatePenaltyMode;
  amount: number | null;
  cap: number | null;
  graceDays: number;
}

/**
 * What a registration owes in penalty for being `daysLate` past the deadline.
 *
 * Returns 0 when nothing is due — no mode, no amount, or still inside grace.
 */
export function penaltyFor(config: PenaltyConfig, daysLate: number): number {
  const { mode, amount, cap, graceDays } = config;
  if (mode === "NONE" || amount == null || amount <= 0) return 0;

  const chargeableDays = daysLate - Math.max(0, graceDays);
  if (chargeableDays <= 0) return 0;

  let value: number;
  switch (mode) {
    case "FLAT":
      value = amount;
      break;
    case "PER_DAY":
      value = amount * chargeableDays;
      break;
    case "PER_WEEK":
      // A part-week counts as a week — the point is to push payment along.
      value = amount * Math.ceil(chargeableDays / 7);
      break;
    default:
      return 0;
  }

  if (cap != null && cap > 0) value = Math.min(value, cap);
  return Math.round(value * 100) / 100;
}

export interface AssessmentRow {
  eventInventoryId: number;
  breederId: number | null;
  breederName: string;
  loft: string | null;
  outstanding: number;
  daysLate: number;
  penalty: number;
  existingPenaltyId: number | null;
  cashPromised: boolean;
}

export interface AssessmentResult {
  seasonId: number;
  raceId: number | null;
  raceName: string;
  deadline: Date | null;
  daysLate: number;
  config: PenaltyConfig;
  rows: AssessmentRow[];
  applied: number;
  skippedCashPromised: number;
  warnings: string[];
}

/**
 * Work out who is late and by how much, and optionally record the penalties.
 *
 * With `dryRun`, nothing is written — the caller gets the same rows back so an
 * operator can see the charge before it lands on anyone's account.
 */
export async function assessLatePenalties(
  seasonId: number,
  options: { raceId?: number; dryRun?: boolean; assessedBy?: string | null } = {}
): Promise<AssessmentResult> {
  const warnings: string[] = [];

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      eventId: true,
      feeScheme: {
        select: {
          latePenaltyMode: true,
          latePenaltyAmount: true,
          latePenaltyCap: true,
          latePenaltyGraceDays: true,
        },
      },
    },
  });
  if (!season) throw new Error("That season no longer exists.");

  const config: PenaltyConfig = {
    mode: season.feeScheme?.latePenaltyMode ?? "NONE",
    amount: season.feeScheme?.latePenaltyAmount ?? null,
    cap: season.feeScheme?.latePenaltyCap ?? null,
    graceDays: season.feeScheme?.latePenaltyGraceDays ?? 0,
  };

  // The deadline race: the one the operator named, else the earliest
  // payment-required race in the season.
  const race = options.raceId
    ? await prisma.race.findFirst({
        where: { id: options.raceId, seasonId },
        select: { id: true, name: true, raceNumber: true, startTime: true },
      })
    : await prisma.race.findFirst({
        where: {
          seasonId,
          raceType: { isPaymentRequired: true },
          startTime: { not: null },
        },
        orderBy: { startTime: "asc" },
        select: { id: true, name: true, raceNumber: true, startTime: true },
      });

  const raceName =
    race?.name || (race?.raceNumber != null ? `Race ${race.raceNumber}` : null) || "the deadline race";
  const deadline = race?.startTime ?? null;

  if (config.mode === "NONE") {
    warnings.push("This season's fee scheme has no late-payment penalty configured.");
  }
  if (!deadline) {
    warnings.push("No payment-required race with a start time, so there is no deadline to measure against.");
  }

  const daysLate = deadline
    ? Math.max(0, Math.floor((Date.now() - deadline.getTime()) / MS_PER_DAY))
    : 0;

  // Everyone in the season with their charges, payments and any live penalty.
  const inventories = await prisma.eventInventory.findMany({
    where: { seasonId },
    select: {
      id: true,
      loft: true,
      cashPromised: true,
      breederId: true,
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
        },
      },
      payments: { select: { paymentValue: true, status: true } },
      penalties: {
        where: { waivedAt: null, raceId: race?.id ?? null },
        select: { id: true },
      },
    },
  });

  const rows: AssessmentRow[] = [];

  for (const inv of inventories) {
    const charged = inv.items.reduce(
      (sum, item) =>
        sum +
        (item.entryFeeValue ?? 0) +
        (item.perchFeeValue ?? 0) +
        (item.hotSpotFeeValue ?? 0) +
        (item.raceFeeValue ?? 0),
      0
    );
    const refunds = inv.items.reduce(
      (sum, item) =>
        sum + (item.entryRefund ?? 0) + (item.hotSpotRefund ?? 0) + (item.betsRefund ?? 0),
      0
    );
    const paid = inv.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + (p.paymentValue ?? 0), 0);

    const outstanding = Math.round((charged - refunds - paid) * 100) / 100;
    if (outstanding <= 0) continue;

    rows.push({
      eventInventoryId: inv.id,
      breederId: inv.breederId ?? null,
      breederName: `${inv.breeder?.firstName ?? ""} ${inv.breeder?.lastName ?? ""}`.trim(),
      loft: inv.loft,
      outstanding,
      daysLate,
      penalty: penaltyFor(config, daysLate),
      existingPenaltyId: inv.penalties[0]?.id ?? null,
      cashPromised: inv.cashPromised === true,
    });
  }

  let applied = 0;
  let skippedCashPromised = 0;

  if (!options.dryRun) {
    for (const row of rows) {
      // A breeder who has promised cash is trusted, exactly as the defaulter
      // list treats them — no penalty while that stands.
      if (row.cashPromised) {
        skippedCashPromised++;
        continue;
      }
      if (row.penalty <= 0) continue;

      if (row.existingPenaltyId != null) {
        // Re-assessing an escalating penalty updates the live row rather than
        // stacking a second charge for the same race.
        await prisma.paymentPenalty.update({
          where: { id: row.existingPenaltyId },
          data: {
            daysLate: row.daysLate,
            amount: row.penalty,
            outstandingAtAssessment: row.outstanding,
            assessedAt: new Date(),
            assessedBy: options.assessedBy ?? null,
          },
        });
      } else {
        await prisma.paymentPenalty.create({
          data: {
            eventInventoryId: row.eventInventoryId,
            raceId: race?.id ?? null,
            daysLate: row.daysLate,
            amount: row.penalty,
            outstandingAtAssessment: row.outstanding,
            assessedBy: options.assessedBy ?? null,
          },
        });
      }
      applied++;
    }

    if (applied > 0) {
      await notifyPaymentDue(
        rows.filter((r) => !r.cashPromised && r.penalty > 0)
          .map((r) => r.breederId)
          .filter((id): id is number => id != null),
        seasonId,
        race?.id ?? null,
        raceName,
        season.eventId
      );
    }
  }

  return {
    seasonId,
    raceId: race?.id ?? null,
    raceName,
    deadline,
    daysLate,
    config,
    rows,
    applied,
    skippedCashPromised,
    warnings,
  };
}

/** Live penalty total for a registration, for balance displays. */
export async function livePenaltyTotal(eventInventoryId: number): Promise<number> {
  const result = await prisma.paymentPenalty.aggregate({
    where: { eventInventoryId, waivedAt: null },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}
