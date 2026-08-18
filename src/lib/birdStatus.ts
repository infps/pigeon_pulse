import { prisma } from "./prisma";

// Resolve the active BirdStatusPreset id for a season + lifecycle trigger.
// Falls back to a global (seasonId null) preset if the season has none.
export async function presetIdFor(
  seasonId: number | null | undefined,
  trigger: "REGISTER" | "CHECKIN" | "RELEASE" | "ARRIVE" | "LOST" | "INJURED" | "MANUAL",
): Promise<number | null> {
  const p = await prisma.birdStatusPreset.findFirst({
    where: {
      trigger,
      isActive: true,
      OR: [{ seasonId: seasonId ?? undefined }, { seasonId: null }],
    },
    orderBy: [{ seasonId: "desc" }, { sortOrder: "asc" }], // prefer season-specific over global
  });
  return p?.id ?? null;
}
