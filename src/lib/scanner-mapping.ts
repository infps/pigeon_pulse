/**
 * Scanner-to-group mapping and per-group statistics.
 *
 * From the 2026-07-02 client meeting:
 *   - "Map scanner serial number to loft section; auto-assign birds on scan."
 *   - "Scanner serial not logged on connect; per-scan serial not shown in log."
 *   - "Per-group stats: total birds, active, lost, foreign, stray, medical."
 *
 * The serial was already stored on every RfidScan row; what was missing was a
 * way to make it mean something. A mapping turns a serial into a loft section so
 * scanning at a pen files the bird there without anybody typing, and every scan
 * bumps the mapping's last-seen stamp so an operator can tell which readers are
 * actually alive.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export interface MappingHit {
  mappingId: number;
  eventGroupId: number | null;
  groupName: string | null;
  label: string | null;
}

/**
 * Resolve a scanner serial to its loft section for a season, and record that the
 * reader was heard from.
 *
 * Returns null when the serial is unknown or the mapping is switched off, which
 * is the normal case for a reader nobody has configured yet.
 */
export async function resolveScannerGroup(
  tx: Tx,
  seasonId: number | null | undefined,
  scannerSerial: string | null | undefined
): Promise<MappingHit | null> {
  if (seasonId == null || !scannerSerial) return null;

  const mapping = await tx.scannerMapping.findUnique({
    where: { seasonId_scannerSerial: { seasonId, scannerSerial } },
    select: {
      id: true,
      isActive: true,
      eventGroupId: true,
      label: true,
      eventGroup: { select: { name: true, status: true } },
    },
  });

  // Heard from, whether or not it maps anywhere — that is the point of the log.
  if (mapping) {
    await tx.scannerMapping.update({
      where: { id: mapping.id },
      data: { lastSeenAt: new Date(), scanCount: { increment: 1 } },
    });
  }

  if (!mapping || !mapping.isActive || mapping.eventGroupId == null) return null;

  return {
    mappingId: mapping.id,
    eventGroupId: mapping.eventGroupId,
    groupName: mapping.eventGroup?.name ?? null,
    label: mapping.label,
  };
}

/**
 * File a bird into the section its scanner represents.
 *
 * Moving between sections is logged, so the history shows where a bird has been
 * rather than only where it ended up.
 */
export async function autoAssignToScannerGroup(
  tx: Tx,
  inventoryItemId: number,
  hit: MappingHit,
  performedById?: string | null
): Promise<boolean> {
  const item = await tx.eventInventoryItem.findUnique({
    where: { id: inventoryItemId },
    select: { id: true, currentGroupId: true, currentGroup: { select: { name: true } } },
  });
  if (!item) return false;
  if (item.currentGroupId === hit.eventGroupId) return false;

  const movedFrom = item.currentGroup?.name ?? null;

  await tx.eventInventoryItem.update({
    where: { id: inventoryItemId },
    data: { currentGroupId: hit.eventGroupId },
  });

  // fromGroupName is required, so only the move out of a section is logged here;
  // the first assignment is captured by BirdEventHistory below.
  if (movedFrom) {
    await tx.birdGroupHistory.create({
      data: { inventoryItemId, fromGroupName: movedFrom },
    });
  }

  await tx.birdEventHistory.create({
    data: {
      eventInventoryItemId: inventoryItemId,
      action: movedFrom ? "GROUP_MOVED" : "GROUP_ASSIGNED",
      detail: movedFrom
        ? `Scanner ${hit.label ?? hit.mappingId} moved the bird from ${movedFrom} to ${hit.groupName ?? "a section"}`
        : `Scanner ${hit.label ?? hit.mappingId} filed the bird into ${hit.groupName ?? "a section"}`,
      groupId: hit.eventGroupId,
      performedById: performedById ?? null,
    },
  });

  return true;
}

export interface GroupStats {
  groupId: number;
  name: string;
  type: string;
  status: string;
  capacity: number | null;
  color: string | null;
  notes: string | null;
  total: number;
  active: number;
  lost: number;
  foreign: number;
  stray: number;
  ignored: number;
  medical: number;
  backup: number;
  unpaid: number;
}

/**
 * Per-group counts for the season.
 *
 * "Medical" is a bird-level health state rather than a race status, so a bird can
 * be counted both present and medical — that is the point of the column.
 */
export async function groupStats(seasonId: number): Promise<GroupStats[]> {
  const groups = await prisma.eventGroup.findMany({
    where: { seasonId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      capacity: true,
      color: true,
      notes: true,
      members: {
        select: {
          id: true,
          isBackup: true,
          entryFeePaid: true,
          bird: { select: { isLost: true, isActive: true, healthStatus: true } },
          raceItems: { select: { status: true } },
        },
      },
    },
  });

  return groups.map((group) => {
    const stats: GroupStats = {
      groupId: group.id,
      name: group.name,
      type: group.type,
      status: group.status,
      capacity: group.capacity,
      color: group.color,
      notes: group.notes,
      total: group.members.length,
      active: 0,
      lost: 0,
      foreign: 0,
      stray: 0,
      ignored: 0,
      medical: 0,
      backup: 0,
      unpaid: 0,
    };

    for (const member of group.members) {
      const statuses = new Set(member.raceItems.map((ri) => ri.status));
      const lost = member.bird?.isLost === 1 || statuses.has("LOST");

      if (lost) stats.lost++;
      else if (member.bird?.isActive !== 0) stats.active++;

      if (statuses.has("FOREIGN_BIRD")) stats.foreign++;
      if (statuses.has("STRAY")) stats.stray++;
      if (statuses.has("IGNORED")) stats.ignored++;
      if (member.bird?.healthStatus && member.bird.healthStatus !== "HEALTHY") stats.medical++;
      if (member.isBackup === 1) stats.backup++;
      if (member.entryFeePaid !== 1) stats.unpaid++;
    }

    return stats;
  });
}
