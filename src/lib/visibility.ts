import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Private event and race visibility.
 *
 * A private event is visible only to breeders holding a registration in one of
 * its seasons. A private race is visible only to breeders with a bird entered in
 * it. Admins and superadmins always see everything.
 *
 * Returns a Prisma filter fragment rather than post-filtering in memory, so
 * pagination and counts stay correct.
 */

export function isStaff(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

/**
 * Events this viewer may see: all public ones, plus any private event where the
 * viewer holds a registration.
 */
export async function eventVisibilityFilter(
  userId: string | null | undefined,
  role: string | null | undefined
): Promise<Prisma.EventWhereInput> {
  if (isStaff(role)) return {};

  const breeder = userId
    ? await prisma.breeder.findUnique({ where: { userId }, select: { id: true } })
    : null;

  if (!breeder) return { isPrivate: false };

  return {
    OR: [
      { isPrivate: false },
      { seasons: { some: { eventInventories: { some: { breederId: breeder.id } } } } },
    ],
  };
}

/**
 * Races this viewer may see: all public ones, plus any private race the viewer
 * has a bird entered in. A private event also hides its races.
 */
export async function raceVisibilityFilter(
  userId: string | null | undefined,
  role: string | null | undefined
): Promise<Prisma.RaceWhereInput> {
  if (isStaff(role)) return {};

  const breeder = userId
    ? await prisma.breeder.findUnique({ where: { userId }, select: { id: true } })
    : null;

  if (!breeder) {
    return { isPrivate: false, seasonRel: { event: { isPrivate: false } } };
  }

  const entered = { raceItems: { some: { inventoryItem: { eventInventory: { breederId: breeder.id } } } } };
  const registeredInEvent = {
    seasonRel: { event: { seasons: { some: { eventInventories: { some: { breederId: breeder.id } } } } } },
  };

  return {
    AND: [
      { OR: [{ isPrivate: false }, entered] },
      { OR: [{ seasonRel: { event: { isPrivate: false } } }, registeredInEvent] },
    ],
  };
}
