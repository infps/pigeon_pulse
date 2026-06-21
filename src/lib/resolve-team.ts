import type { Prisma } from "@/generated/prisma/client";

/**
 * Resolve (or create) the Team for a breeder given a free-text loft name.
 * Registration stores a loft string; we bind it to a real Team row so the
 * Teams page can list birds/events by teamId instead of fragile name matching.
 * Returns null when loftName is empty.
 */
export async function resolveTeamId(
  tx: Prisma.TransactionClient,
  breederId: number,
  loftName: string | null | undefined
): Promise<number | null> {
  const name = (loftName ?? "").trim();
  if (!name) return null;

  const existing = await tx.team.findFirst({
    where: { breederId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.team.create({
    data: { name, breederId },
    select: { id: true },
  });
  return created.id;
}
