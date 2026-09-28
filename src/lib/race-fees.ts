import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Race fees, charged to the birds that actually fly.
 *
 * Registration used to divide the season's total race fee across every bird
 * reserved, whether or not it ever left the loft. A breeder who entered ten and
 * basketed six was billed for ten, and nothing ever corrected it.
 *
 * So the charge moved to the two moments where the answer is known:
 *
 *   basketed  -> the bird is going, bill it            (`writeRaceFeeForBasketedBird`)
 *   lost      -> it is not coming back, stop billing it (`clearRaceFeeForLostBird`)
 *
 * Both write the same column the ledger already sums, so `computePaymentStatus`
 * picks the change up with no further work.
 */

/**
 * What one bird owes for the season's races.
 *
 * `FLAT_PER_RACE` is a fee for the race itself rather than per bird, so it is
 * divided across the birds flying it — otherwise a flat fee would be charged
 * once per bird and collect many times what it names. `PER_BIRD_PER_RACE`
 * charges each bird the full rate, which is what it says.
 */
async function perBirdRaceFee(tx: Tx, seasonId: number): Promise<number> {
  const season = await tx.season.findUnique({
    where: { id: seasonId },
    select: {
      feeScheme: {
        select: {
          raceFeeMode: true,
          raceTypeFees: { select: { raceTypeId: true, fee: true } },
        },
      },
      races: { select: { raceTypeId: true } },
    },
  });

  const scheme = season?.feeScheme;
  if (!scheme) return 0;

  let total = 0;
  for (const race of season?.races ?? []) {
    if (race.raceTypeId == null) continue;
    const rate = scheme.raceTypeFees.find((r) => r.raceTypeId === race.raceTypeId);
    if (!rate) continue;
    total += rate.fee;
  }

  if (scheme.raceFeeMode === "FLAT_PER_RACE") {
    // Split across everyone basketed for the season, so the flat fee is
    // collected once in aggregate rather than once per bird.
    const flying = await tx.raceItem.count({
      where: {
        race: { seasonId },
        status: { in: ["LOFT_BASKETED", "RELEASED", "ARRIVED"] },
      },
    });
    return flying > 0 ? total / flying : 0;
  }

  return total;
}

/** Bill a bird that has just been basketed. */
export async function writeRaceFeeForBasketedBird(
  tx: Tx,
  seasonId: number,
  eventInventoryItemId: number
): Promise<void> {
  const fee = await perBirdRaceFee(tx, seasonId);
  await tx.eventInventoryItem.update({
    where: { id: eventInventoryItemId },
    data: { raceFeeValue: fee },
  });
}

/**
 * Stop billing a bird that was lost.
 *
 * Scoped by item ids rather than done one at a time: a race close can mark
 * hundreds lost at once, and a round trip each would make ending a race slow
 * enough to look broken.
 */
export async function clearRaceFeeForLostBirds(
  tx: Tx,
  eventInventoryItemIds: number[]
): Promise<number> {
  if (eventInventoryItemIds.length === 0) return 0;
  const result = await tx.eventInventoryItem.updateMany({
    where: { id: { in: eventInventoryItemIds }, raceFeeValue: { not: 0 } },
    data: { raceFeeValue: 0 },
  });
  return result.count;
}
