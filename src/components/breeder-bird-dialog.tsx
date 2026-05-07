"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetBreederBird } from "@/lib/api/breeder";
import { useBirdHistory, type BirdHistoryEntry } from "@/lib/api/birds";
import { Bird as BirdIcon } from "lucide-react";
import type { Bird } from "@/lib/types";

interface BreederBirdDialogProps {
  birdId: number | string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BreederBirdDialog({
  birdId,
  open,
  onOpenChange,
}: BreederBirdDialogProps) {
  const effectiveId = birdId ?? "";

  const { data: birdData, isPending: birdLoading } = useGetBreederBird({
    birdId: effectiveId,
  });
  const { data: historyData, isPending: historyLoading } = useBirdHistory(
    effectiveId
  );

  const bird: Bird | undefined = birdData?.bird;

  const latestArrived = useMemo<BirdHistoryEntry | null>(() => {
    const entries =
      (historyData as { entries?: BirdHistoryEntry[] } | undefined)?.entries ??
      [];
    const arrived = entries.filter((e) => e.type === "ARRIVED");
    if (arrived.length === 0) return null;
    return arrived.reduce((latest, e) =>
      new Date(e.date).getTime() > new Date(latest.date).getTime() ? e : latest
    );
  }, [historyData]);

  const bandDisplay = bird
    ? [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bird Details</DialogTitle>
        </DialogHeader>

        {birdLoading || !bird ? (
          <div className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
              {bird.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bird.image}
                  alt={bird.birdName ?? "Bird"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <BirdIcon className="h-16 w-16 text-muted-foreground" />
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold">
                {bird.birdName || "Unnamed Bird"}
              </h2>
              <p className="font-mono text-sm text-muted-foreground">
                {bandDisplay || "No band"}
              </p>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Latest Race
              </p>
              {historyLoading ? (
                <Skeleton className="h-5 w-3/4" />
              ) : latestArrived ? (
                <p className="text-sm">
                  {latestArrived.position
                    ? `Position #${latestArrived.position}`
                    : "Arrived"}
                  {latestArrived.raceName ? ` — ${latestArrived.raceName}` : ""}
                  {latestArrived.eventName ? ` (${latestArrived.eventName})` : ""}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No race results yet
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
