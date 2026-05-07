"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBirdLocation, type BirdLocation, type BirdLocationStatus } from "@/lib/api/birds";
import { MapPin } from "lucide-react";

const STATUS_VARIANT: Record<BirdLocationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  BASKETED: "secondary",
  ARRIVED: "default",
  LOST: "destructive",
  HELD: "outline",
};

function formatSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

export function BirdLocationCard({ birdId }: { birdId: string | number }) {
  const { data, isPending, isError } = useBirdLocation(birdId);
  const loc = data as BirdLocation | undefined;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          Current Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : isError || !loc ? (
          <p className="text-sm text-muted-foreground">Location unavailable.</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[loc.status]}>{loc.status}</Badge>
              <span className="font-medium">{loc.label}</span>
            </div>
            {(loc.eventName || loc.raceName) && (
              <p className="text-sm text-muted-foreground">
                {[loc.eventName, loc.raceName].filter(Boolean).join(" • ")}
              </p>
            )}
            {loc.basketLabel && loc.phase && (
              <p className="text-xs text-muted-foreground">
                {loc.phase} basket: {loc.basketLabel}
              </p>
            )}
            {formatSince(loc.since) && (
              <p className="text-xs text-muted-foreground">since {formatSince(loc.since)}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
