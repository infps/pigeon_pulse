/**
 * The one definition of "takes part in the event".
 *
 * A registration counts only once an admin has approved it. Breeder
 * self-registrations sit in WAITING until then, and REJECTED ones are ignored
 * everywhere. Every list, count, bill and ranking of registrations or their
 * birds goes through these so the rule cannot drift between screens.
 */

import { Prisma } from "@/generated/prisma/client";

/** Where-clause for EventInventory rows that take part. */
export const approvedInventory = {
  approvalStatus: "APPROVED",
} as const satisfies Prisma.EventInventoryWhereInput;

/** Where-clause for EventInventoryItem rows (birds) that take part. */
export const activeItem = {
  eventInventory: approvedInventory,
} as const satisfies Prisma.EventInventoryItemWhereInput;

/**
 * Raw-SQL twin of `activeItem`, for queries that join "EventInventoryItem".
 * Pass the alias the query gave that table; rows with no item (foreign birds
 * scanned without an entry) are let through, as the joins already allow.
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
