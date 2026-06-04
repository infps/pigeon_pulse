"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TruckTrackMap } from "@/components/map";
import { Play, Square, Truck, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";

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
  transportEndedAt?: string | null;
  latest: TrackPing | null;
  pings: TrackPing[];
  station: { name: string; lat: number; lng: number; miles?: number | null } | null;
  loft: { lat: number; lng: number; name?: string | null } | null;
}

// Buffered geolocation fix pending upload.
interface BufferedFix {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recordedAt: string;
}

const PING_FLUSH_MS = 15000;

function ageLabel(iso: string | null | undefined): string {
  if (!iso) return "-";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function TransportCard({ raceId }: { raceId: string }) {
  const queryClient = useQueryClient();
  const [broadcasting, setBroadcasting] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const bufferRef = useRef<BufferedFix[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pointsSent, setPointsSent] = useState(0);
  const [lastFix, setLastFix] = useState<BufferedFix | null>(null);

  const trackKey = ["admin", "race", raceId, "track"];

  const { data: track } = useQuery<TrackResponse>({
    queryKey: trackKey,
    queryFn: async () => {
      const res = await fetch(`/api/admin/race/${raceId}/track`);
      if (!res.ok) throw new Error("Failed to load track");
      return res.json();
    },
    refetchInterval: broadcasting ? 15000 : false,
  });

  const status = track?.transportStatus ?? "IDLE";
  const inTransit = status === "IN_TRANSIT";

  const startMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/race/${raceId}/transport/start`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to start transport");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Transport started");
      queryClient.invalidateQueries({ queryKey: trackKey });
      queryClient.invalidateQueries({ queryKey: ["races", "detail", raceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/race/${raceId}/transport/stop`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to stop transport");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Transport stopped");
      queryClient.invalidateQueries({ queryKey: trackKey });
      queryClient.invalidateQueries({ queryKey: ["races", "detail", raceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Flush buffered fixes to /ping (batched).
  const flush = useCallback(async () => {
    if (bufferRef.current.length === 0) return;
    const pings = bufferRef.current.map((f) => ({
      lat: f.lat,
      lng: f.lng,
      speed: f.speed,
      heading: f.heading,
      accuracy: f.accuracy,
      recordedAt: f.recordedAt,
    }));
    bufferRef.current = [];
    try {
      const res = await fetch(`/api/admin/race/${raceId}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pings }),
      });
      if (res.ok) {
        setPointsSent((n) => n + pings.length);
        queryClient.invalidateQueries({ queryKey: trackKey });
      } else {
        // Re-queue on failure.
        bufferRef.current = [...pings.map((p) => ({
          lat: p.lat, lng: p.lng, speed: p.speed, heading: p.heading, accuracy: p.accuracy, recordedAt: p.recordedAt,
        })), ...bufferRef.current];
      }
    } catch {
      bufferRef.current = [...pings.map((p) => ({
        lat: p.lat, lng: p.lng, speed: p.speed, heading: p.heading, accuracy: p.accuracy, recordedAt: p.recordedAt,
      })), ...bufferRef.current];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId, queryClient]);

  const stopBroadcast = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    // Final flush of anything buffered.
    void flush();
    setBroadcasting(false);
  }, [flush]);

  const startBroadcast = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation not available in this browser");
      return;
    }
    setBroadcasting(true);
    setPointsSent(0);
    bufferRef.current = [];
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: BufferedFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed ?? null,
          heading: pos.coords.heading ?? null,
          accuracy: pos.coords.accuracy ?? null,
          recordedAt: new Date(pos.timestamp || Date.now()).toISOString(),
        };
        bufferRef.current.push(fix);
        setLastFix(fix);
      },
      (err) => {
        toast.error(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    flushTimerRef.current = setInterval(() => void flush(), PING_FLUSH_MS);
  }, [flush]);

  // Start/Stop combined handlers: mutate transport state then toggle broadcast.
  const handleStart = () => {
    startMut.mutate(undefined, { onSuccess: () => startBroadcast() });
  };
  const handleStop = () => {
    stopBroadcast();
    stopMut.mutate();
  };

  // Cleanup watch on unmount.
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, []);

  const truck = track?.latest
    ? { lat: track.latest.lat, lng: track.latest.lng, heading: track.latest.heading }
    : lastFix
      ? { lat: lastFix.lat, lng: lastFix.lng, heading: lastFix.heading }
      : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Liberation / Transport
        </CardTitle>
        <div className="flex items-center gap-2">
          {status === "IDLE" && <Badge variant="secondary">Idle</Badge>}
          {status === "IN_TRANSIT" && (
            <Badge className="bg-green-600 animate-pulse gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              In Transit
            </Badge>
          )}
          {status === "ARRIVED" && <Badge variant="outline">Arrived</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {!inTransit ? (
            <Button
              onClick={handleStart}
              disabled={startMut.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4" />
              {startMut.isPending ? "Starting..." : "Start Transport"}
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              disabled={stopMut.isPending}
              variant="destructive"
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              {stopMut.isPending ? "Stopping..." : "Stop Transport"}
            </Button>
          )}
          <div className="text-sm text-muted-foreground space-y-0.5">
            <div>Departed: {track?.transportStartedAt ? new Date(track.transportStartedAt).toLocaleString() : "-"}</div>
            <div>
              Last ping: {track?.latest ? ageLabel(track.latest.recordedAt) : "-"}
              {broadcasting && ` · ${pointsSent} sent this session`}
            </div>
          </div>
        </div>

        {broadcasting && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Keep this tab open &amp; screen on — web broadcasting is foreground-only. For
              true background tracking, use the mobile app.
            </span>
          </div>
        )}

        {(truck || track?.station || track?.loft) && (
          <TruckTrackMap
            loft={track?.loft ?? null}
            station={track?.station ?? null}
            pings={(track?.pings ?? []).map((p) => ({ lat: p.lat, lng: p.lng }))}
            truck={truck}
            height={300}
          />
        )}

        {lastFix && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Current: {lastFix.lat.toFixed(5)}, {lastFix.lng.toFixed(5)}
            {lastFix.accuracy != null && ` (±${Math.round(lastFix.accuracy)}m)`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Static route-history map fed by the admin full breadcrumb. Renders only when
// pings exist. Start/end markers come from the loft + station (release point).
export function RouteHistoryCard({ raceId }: { raceId: string }) {
  const { data: track } = useQuery<TrackResponse>({
    queryKey: ["admin", "race", raceId, "track"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/race/${raceId}/track`);
      if (!res.ok) throw new Error("Failed to load track");
      return res.json();
    },
  });

  const pings = track?.pings ?? [];
  if (pings.length === 0) return null;

  const start = track?.transportStartedAt ? new Date(track.transportStartedAt) : null;
  const end = track?.transportEndedAt ? new Date(track.transportEndedAt) : null;
  let durationLabel = "-";
  if (start) {
    const ms = (end ?? new Date()).getTime() - start.getTime();
    const mins = Math.round(ms / 60000);
    durationLabel = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Route History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>Points: <span className="font-semibold text-foreground">{pings.length}</span></span>
          <span>
            Started:{" "}
            <span className="font-semibold text-foreground">
              {start ? start.toLocaleString() : "-"}
            </span>
          </span>
          <span>
            Ended:{" "}
            <span className="font-semibold text-foreground">
              {end ? end.toLocaleString() : "—"}
            </span>
          </span>
          <span>Duration: <span className="font-semibold text-foreground">{durationLabel}</span></span>
        </div>
        <TruckTrackMap
          loft={track?.loft ?? null}
          station={track?.station ?? null}
          pings={pings.map((p) => ({ lat: p.lat, lng: p.lng }))}
          truck={null}
          height={360}
        />
      </CardContent>
    </Card>
  );
}
