"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TruckTrackMap } from "@/components/map";
import { Truck } from "lucide-react";

interface TrackPing {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  recordedAt: string;
}

interface TrackResponse {
  transportStatus: "IDLE" | "IN_TRANSIT" | "ARRIVED";
  transportStartedAt: string | null;
  latest: TrackPing | null;
  pings: TrackPing[];
  station: { name: string; lat: number; lng: number; miles?: number | null } | null;
  loft: { lat: number; lng: number; name?: string | null } | null;
}

function ageLabel(iso: string | null | undefined): string {
  if (!iso) return "-";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function LiveTransit({ raceId }: { raceId: string }) {
  const { data: track } = useQuery<TrackResponse>({
    queryKey: ["public", "race", raceId, "track"],
    queryFn: async () => {
      const res = await fetch(`/api/public/race/${raceId}/track`);
      if (!res.ok) throw new Error("Failed to load track");
      return res.json();
    },
    refetchInterval: 20000,
  });

  // Hide entirely unless actively in transit.
  if (!track || track.transportStatus !== "IN_TRANSIT") return null;

  const truck = track.latest
    ? { lat: track.latest.lat, lng: track.latest.lng, heading: track.latest.heading }
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-blue-600">
          <Truck className="h-5 w-5" />
          Live Transit
        </CardTitle>
        <Badge className="bg-green-600 animate-pulse gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white animate-ping" />
          In Transit
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            Departed:{" "}
            <span className="font-semibold text-foreground">
              {track.transportStartedAt ? new Date(track.transportStartedAt).toLocaleString() : "-"}
            </span>
          </span>
          <span>
            Last update:{" "}
            <span className="font-semibold text-foreground">
              {track.latest ? ageLabel(track.latest.recordedAt) : "-"}
            </span>
          </span>
        </div>
        <TruckTrackMap
          loft={track.loft}
          station={track.station}
          pings={track.pings.map((p) => ({ lat: p.lat, lng: p.lng }))}
          truck={truck}
          height={360}
        />
      </CardContent>
    </Card>
  );
}
