/**
 * The one definition of "takes part in the event".
 *
 * A registration counts only once an admin has approved it. Breeder
 * self-registrations sit in WAITING until then, and REJECTED ones are ignored
 * everywhere. A bird also drops out when its event entry is soft-deleted.
 * Every list, count, bill and ranking of registrations or their birds goes
 * through these so the rule cannot drift between screens.
 */

import { Prisma } from "@/generated/prisma/client";

/** Where-clause for EventInventory rows that take part. */
export const approvedInventory = {
  approvalStatus: "APPROVED",
} as const satisfies Prisma.EventInventoryWhereInput;

/**
 * A bird whose registration is approved, deleted or not. For things that
 * outlive a delete: bets on the bird (they are never voided by a delete) and
 * its results in races that have ended.
 */
export const approvedItem = {
  eventInventory: approvedInventory,
} as const satisfies Prisma.EventInventoryItemWhereInput;

/** Where-clause for EventInventoryItem rows (birds) that take part now. */
export const activeItem = {
  ...approvedItem,
  deletedAt: null,
} as const satisfies Prisma.EventInventoryItemWhereInput;

/**
 * `OR` branches for RaceItem lists: entries with no item (foreign birds scanned
 * without an entry), birds taking part now, and deleted birds in races that
 * have already ended, so history stays intact.
 */
export const activeRaceItemOr = [
  { inventoryItemId: null },
  { inventoryItem: activeItem },
  { inventoryItem: approvedItem, race: { status: "ENDED" } },
] satisfies Prisma.RaceItemWhereInput[];

/**
 * Raw-SQL twin of `approvedItem`, for ranking queries that join
 * "EventInventoryItem". Pass the alias the query gave that table; rows with no
 * item are let through, as the joins already allow. Deleted birds are not
 * excluded here: one can only hold an arrival from before it was deleted, and
 * that result is history.
 */
export function activeItemSql(itemAlias: string): Prisma.Sql {
  const alias = Prisma.raw(`"${itemAlias}"`);
  return Prisma.sql`(
    ${alias}."ID_EVENT_INVENTORY" IS NULL OR EXISTS (
      SELECT 1 FROM "EventInventory" ei
      WHERE ei."ID_EVENT_INVENTORY" = ${alias}."ID_EVENT_INVENTORY"
        AND ei."APPROVAL_STATUS" = 'APPROVED'
    )
  )`;
}
