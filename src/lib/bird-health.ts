import type { BirdHealthStatus } from "@/generated/prisma/enums";

/**
 * Bird fitness — the guard the spec deferred.
 *
 * Health lives on the bird and is independent of race status: a bird can be
 * present at the loft and still unfit to fly. Only a HEALTHY bird may be
 * basketted; the rest are held back with a reason the operator can see.
 *
 * Derived rather than stored, so it can never drift from the health status.
 */

export function isFitToFly(status: BirdHealthStatus | null | undefined): boolean {
  return (status ?? "HEALTHY") === "HEALTHY";
}

export function unfitReason(status: BirdHealthStatus | null | undefined): string | null {
  switch (status) {
    case "INJURED":
      return "injured";
    case "HOSPITALIZED":
      return "hospitalized";
    case "DEAD":
      return "recorded as dead";
    default:
      return null;
  }
}

export interface UnfitBird {
  inventoryItemId: number;
  band: string;
  reason: string;
}

/**
 * Split candidate birds into those that may be basketted and those that may not.
 * Basketting callers use this to skip unfit birds and report why.
 */
export function partitionByFitness<
  T extends {
    id: number;
    bird?: {
      healthStatus?: BirdHealthStatus | null;
      band1?: string | null;
      band2?: string | null;
      band3?: string | null;
      band4?: string | null;
      band?: string | null;
    } | null;
  }
>(items: T[]): { fit: T[]; unfit: UnfitBird[] } {
  const fit: T[] = [];
  const unfit: UnfitBird[] = [];

  for (const item of items) {
    const status = item.bird?.healthStatus;
    if (isFitToFly(status)) {
      fit.push(item);
      continue;
    }
    const parts = [item.bird?.band1, item.bird?.band2, item.bird?.band3, item.bird?.band4].filter(
      Boolean
    );
    unfit.push({
      inventoryItemId: item.id,
      band: parts.length > 0 ? parts.join("-") : (item.bird?.band ?? String(item.id)),
      reason: unfitReason(status) ?? "unfit",
    });
  }

  return { fit, unfit };
}
