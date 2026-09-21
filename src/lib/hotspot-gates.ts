import { prisma } from "@/lib/prisma";
import { HOTSPOT_GATES, type HotspotGate } from "@/lib/fee-calculator";

/** The prize role that marks a race type as a given gate's race. */
const GATE_PRIZE_ROLE: Record<HotspotGate, string> = {
  HS1: "HOTSPOT_1",
  HS2: "HOTSPOT_2",
  HS3: "HOTSPOT_3",
  FINAL: "FINAL",
};

/**
 * A bird past either of these has been basketed. Asking it this way round
 * means a new RaceItemStatus counts as basketed by default, which is the safe
 * direction: the alternative silently reopens a gate that has closed.
 */
const NOT_YET_BASKETED = ["REGISTERED", "CHECKED_IN"] as const;

/**
 * Which hotspot gate is still open for a season.
 *
 * A gate shuts when basketing opens for its race. A breeder who has not paid
 * by the time birds go into the basket has missed that gate, and the
 * obligation moves to the next one at its higher price — that escalation is
 * the whole point of the four prices, and without this it never bites.
 *
 * The final race is the last gate. Once the season reaches it the price stops
 * climbing, because there is nothing after it to move to.
 *
 * Returns the earliest gate whose race has not been basketed, or FINAL when
 * every gate's race has. A season with no hotspot races mapped yet returns
 * HS1, which bills as the scheme was written.
 */
export async function openHotspotGate(seasonId: number): Promise<HotspotGate> {
  const basketed = await prisma.race.findMany({
    where: {
      seasonId,
      raceType: { prizeRole: { in: ["HOTSPOT_1", "HOTSPOT_2", "HOTSPOT_3", "FINAL"] } },
      raceItems: { some: { status: { notIn: [...NOT_YET_BASKETED] } } },
    },
    select: { raceType: { select: { prizeRole: true } } },
  });

  const closed = new Set<string>(
    basketed
      .map((r) => r.raceType?.prizeRole)
      .filter((role): role is NonNullable<typeof role> => !!role)
  );

  return HOTSPOT_GATES.find((g) => !closed.has(GATE_PRIZE_ROLE[g])) ?? "FINAL";
}
