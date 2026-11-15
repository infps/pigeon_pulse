"use client";

import { BirdPopup } from "@/components/bird-popup";

/**
 * The bird popup (components/bird-popup): every detail of a bird, its race
 * history, perch, baskets, owners, fees and account, and — for admins — moving
 * it between perches, loft groups, baskets and owners. Kept under this name for
 * the screens that already open it; new lists use <BirdLink> / useBirdPopup.
 */
export function BirdDetailDialog({
  open,
  onOpenChange,
  birdId,
  eventId,
  seasonId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birdId: number | string | null;
  eventId?: number | null;
  seasonId?: number | null;
}) {
  const id = birdId == null || birdId === "" ? null : Number(birdId);
  return <BirdPopup open={open} onOpenChange={onOpenChange} birdId={id} eventId={eventId ?? null} seasonId={seasonId ?? null} />;
}
