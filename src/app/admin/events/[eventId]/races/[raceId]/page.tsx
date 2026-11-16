"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { useListRaceItems } from "@/lib/api/race-items";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ExportButton } from "@/components/export-button";
import { useUpdateRace } from "@/lib/api/races";
import { shortBand } from "@/lib/bird-constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { BasketTabs } from "./basket-tabs";
import { StartRaceDialog } from "./start-race-dialog";
// GPS disabled for now: import { TransportCard, RouteHistoryCard } from "./transport-card";
import { createRaceItemsColumns } from "./race-items-columns";
import { RaceStatusDialog } from "./race-status-dialog";
import { RaceStatusFilter } from "./race-status-filter";
import { RecalculateDialog } from "./recalculate-dialog";
import { CorrectionsDialog } from "./corrections-dialog";
import { getWeatherIcon } from "@/lib/weather-constants";
import type { Race, Event, RaceItem } from "@/lib/types";
import Image from "next/image";
import { ArrowLeft, Link2, Pencil, Printer, Radio, Square, StopCircle, Usb } from "lucide-react";
import { RaceWindButton } from "@/components/map/race-wind-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useWebSerial } from "@/hooks/useWebSerial";
import { LinksDialog } from "@/components/race-links-dialog";
import { cToF } from "@/lib/temperature";

/** Entry fees not settled: the bird's registration is unpaid or only partly paid (hybrid status). */
const isUnpaid = (ri: RaceItem) => ri.paymentStatus === "PENDING" || ri.paymentStatus === "PARTIAL";

// Only the printable race sheet (#race-print) survives window.print(); the admin chrome is hidden.
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #race-print, #race-print * { visibility: visible !important; }
  #race-print { position: absolute; left: 0; top: 0; width: 100%; }
  [data-slot="sidebar-wrapper"], [data-slot="sidebar-inset"], main { overflow: visible !important; height: auto !important; }
}`;

/** Show and edit Race.description. */
function RaceDescriptionEditor({ raceId, description }: { raceId: number; description: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const update = useUpdateRace();

  const save = async () => {
    if (!update.mutateAsync) return;
    try {
      await update.mutateAsync({ raceId, description: value.trim() });
      toast.success("Description updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update description");
    }
  };

  if (!editing) {
    return (
      <div className="flex items-start gap-2 text-sm">
        <span className="text-muted-foreground shrink-0">Description / Note:</span>
        <span className="whitespace-pre-wrap">{description || "-"}</span>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 shrink-0" onClick={() => { setValue(description ?? ""); setEditing(true); }}>
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={update.isPending}>Cancel</Button>
      </div>
    </div>
  );
}

export default function RaceDetailsPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const raceId = params?.raceId as string;
  const router = useRouter();

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [arrivalFrom, setArrivalFrom] = useState<string>("");
  const [arrivalTo, setArrivalTo] = useState<string>("");
  const [arrivalDefaultSet, setArrivalDefaultSet] = useState(false);
  const [tableResetKey, setTableResetKey] = useState(0);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [statusItem, setStatusItem] = useState<RaceItem | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const lastScannedRfidRef = useRef<string | null>(null);
  const scannerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  // Live while STARTED: poll so arrivals/End from other devices/scanner tabs show up.
  // Status read from cache (last render's race) since a hook can't see its own result.
  const isLive =
    queryClient.getQueryData<{ race?: Race }>(["races", "detail", raceId])?.race?.status === "STARTED";

  // Scan reliability: scans that fail to reach the server (offline / 5xx) wait
  // in a localStorage queue with their ORIGINAL timestamp and are retried.
  // Re-sends are safe: the scan route ignores a bird that already arrived.
  const queueKey = `scan-queue-${raceId}`;
  const queueRef = useRef<{ ringNo: string; timestamp: string }[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const recentScansRef = useRef(new Map<string, number>());
  // server − browser clock, ms. Applied to browser-stamped scans only.
  const clockOffsetRef = useRef(0);
  const [clockOffset, setClockOffset] = useState<number | null>(null);

  const saveQueue = useCallback(() => {
    setQueuedCount(queueRef.current.length);
    try { localStorage.setItem(queueKey, JSON.stringify(queueRef.current)); } catch { /* memory copy still holds it */ }
  }, [queueKey]);

  useEffect(() => {
    try { queueRef.current = JSON.parse(localStorage.getItem(queueKey) ?? "[]"); } catch { queueRef.current = []; }
    setQueuedCount(queueRef.current.length);

    const t0 = Date.now();
    fetch("/api/time").then((r) => r.json()).then(({ now }) => {
      // ponytail: one round-trip midpoint, ~RTT/2 error; resample on scanner start if drift matters
      const offset = now - (t0 + Date.now()) / 2;
      clockOffsetRef.current = offset;
      setClockOffset(offset);
    }).catch(() => {});
  }, [queueKey]);

  // Fetch race details
  const { data: raceData, isPending: raceLoading } = useApiQuery({
    endpoint: apiEndpoints.races.base,
    queryKey: ["races", "detail", raceId],
    params: { raceId },
    refetchInterval: isLive ? 15000 : false,
  });

  // Fetch event details
  const { data: eventData, isPending: eventLoading } = useApiQuery({
    endpoint: apiEndpoints.events.base,
    queryKey: ["events", "detail", eventId],
    params: { eventId },
  });

  // Fetch race items
  const { data: raceItemsData, isPending: raceItemsLoading } = useListRaceItems({
    params: { raceId },
    refetchInterval: (raceData?.race as Race | undefined)?.status === "STARTED" ? 5000 : false,
  });

  // Start race mutation
  const { mutate: startRace, isPending: isStartingRace } = useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.races.start(raceId),
    queryKey: ["races", "detail", raceId],
    onSuccess: () => {
      toast.success("Race started successfully!");
    },
    onError: (error) => {
      toast.error(error?.message || "Failed to start race");
    },
  });

  // End race mutation
  const { mutate: endRace, isPending: isEndingRace } = useApiMutation({
    method: "POST",
    endpoint: apiEndpoints.races.end(raceId),
    queryKey: ["races", "detail", raceId],
    onSuccess: () => {
      toast.success("Race ended successfully!");
    },
    onError: (error) => {
      toast.error(error?.message || "Failed to end race");
    },
  });

  // Scanner functions
  // timestamp: compact UTC string from Web Serial, else ISO from scanTime/now (server parses both)
  const handleScan = useCallback(async (rfid: string, scanTime?: Date | string) => {
    // Antenna re-reads: ignore the same tag within 30s.
    const nowMs = Date.now();
    const last = recentScansRef.current.get(rfid);
    if (last && nowMs - last < 30_000) return;
    recentScansRef.current.set(rfid, nowMs);

    const timestamp = typeof scanTime === "string"
      ? scanTime
      : (scanTime ?? new Date(nowMs + clockOffsetRef.current)).toISOString();

    try {
      const res = await fetch(`/api/admin/race/${raceId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ringNo: rfid, timestamp }),
      });
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Scan failed');
        return;
      }

      const birdName = data.raceItem?.bird?.birdName || rfid;
      if (data.isNewScan) {
        if (data.scanType === "phantom") {
          // Tag matched no bird — it is queued under Corrections for matching.
          toast.warning(data.message || `Tag ${rfid} does not match any bird`);
        } else if (data.scanType === "loft") {
          toast.success(`${birdName} added to loft basket`);
        } else {
          toast.success(`${birdName} arrived! Position: ${data.birdPosition ?? "—"}`);
        }
        queryClient.invalidateQueries({ queryKey: ["raceItems", "list", `raceId-${raceId}`] });
      } else {
        toast.info(data.message || 'Bird already scanned');
      }
    } catch {
      queueRef.current.push({ ringNo: rfid, timestamp });
      saveQueue();
      toast.warning(`Connection problem — ${rfid} queued, will retry (${queueRef.current.length} waiting)`);
    }
  }, [raceId, queryClient, saveQueue]);

  // Drain the queue in order; stop at the first failure and try again later.
  const flushingRef = useRef(false);
  const flushQueue = useCallback(async () => {
    if (flushingRef.current || queueRef.current.length === 0) return;
    flushingRef.current = true;
    let sent = 0;
    try {
      while (queueRef.current.length > 0) {
        const scan = queueRef.current[0];
        const res = await fetch(`/api/admin/race/${raceId}/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scan),
        });
        if (res.status >= 500) break;
        queueRef.current.shift(); // 2xx or 4xx: server has decided, drop it
        saveQueue();
        sent++;
      }
    } catch { /* still offline */ }
    flushingRef.current = false;
    if (sent > 0) {
      toast.success(`${sent} queued scan${sent > 1 ? "s" : ""} sent`);
      queryClient.invalidateQueries({ queryKey: ["raceItems", "list", `raceId-${raceId}`] });
    }
  }, [raceId, queryClient, saveQueue]);

  useEffect(() => {
    const id = setInterval(flushQueue, 5000);
    window.addEventListener("online", flushQueue);
    return () => { clearInterval(id); window.removeEventListener("online", flushQueue); };
  }, [flushQueue]);

  const { isConnected: isSerial, connect: connectSerial, disconnect: disconnectSerial } =
    useWebSerial({ onScan: handleScan });

  const stopScanner = useCallback(() => {
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }
    setIsScanning(false);
    lastScannedRfidRef.current = null;
    pollStartedAtRef.current = null;
    toast.info('Scanner stopped');
  }, []);

  const startScanner = useCallback(() => {
    if (isSerial) disconnectSerial();
    setIsScanning(true);
    lastScannedRfidRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success('Scanner started');

    scannerIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/scanner/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
        });
        const data = await res.json();

        if (data && data.length > 0) {
          for (const scan of data) {
            if (scan.el && scan.el !== lastScannedRfidRef.current) {
              lastScannedRfidRef.current = scan.el;
              // Browser parses ISO/local strings; compact YYYYMMDDHHmmss falls through raw for the server.
              const at = scan.timestamp ? new Date(scan.timestamp) : undefined;
              handleScan(scan.el, at && isNaN(at.getTime()) ? String(scan.timestamp) : at);
            }
          }
        }
      } catch {
        // silent fail on poll
      }
    }, 2000);
  }, [handleScan]);

  if (raceLoading || eventLoading || raceItemsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const race = raceData?.race as Race;
  const event = eventData?.event as Event;
  const allRaceItems = (raceItemsData?.raceItems || []) as RaceItem[];
  const homeCount = allRaceItems.filter((ri) => ri.status === "ARRIVED").length;
  // Denominator: birds released (incl. arrived/foreign); before release, loft-basketed birds.
  const outCount =
    allRaceItems.filter((ri) => ["RELEASED", "ARRIVED", "FOREIGN_BIRD"].includes(ri.status ?? "")).length ||
    allRaceItems.filter((ri) => ri.status === "LOFT_BASKETED").length;

  // Set default arrivalFrom to first bird's arrival time once data loads
  if (!arrivalDefaultSet && allRaceItems.length > 0) {
    const firstArrival = allRaceItems
      .map((ri) => ri.arrivalTime ?? ri.result?.arrivalTime ?? null)
      .filter(Boolean)
      .map((t) => new Date(t!).getTime())
      .sort((a, b) => a - b)[0];
    if (firstArrival) {
      const d = new Date(firstArrival);
      const pad = (n: number) => String(n).padStart(2, "0");
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setArrivalFrom(local);
    }
    setArrivalDefaultSet(true);
  }

  const fromMs = arrivalFrom ? new Date(arrivalFrom).getTime() : NaN;
  const toMs = arrivalTo ? new Date(arrivalTo).getTime() : NaN;
  const hasArrivalFilter = !isNaN(fromMs) || !isNaN(toMs);
  const raceItems: RaceItem[] = allRaceItems.filter((ri) => {
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(ri.status ?? "")) return false;
    if (unpaidOnly && !isUnpaid(ri)) return false;
    if (hasArrivalFilter) {
      const t = ri.arrivalTime ?? ri.result?.arrivalTime ?? null;
      if (t) {
        const ms = new Date(t).getTime();
        if (!isNaN(fromMs) && ms < fromMs) return false;
        if (!isNaN(toMs) && ms > toMs) return false;
      }
    }
    return true;
  });

  if (!race || !event) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-red-500">
          <p>Race or Event not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 space-y-4 max-w-[100vw] overflow-x-hidden">
      <style>{PRINT_CSS}</style>

      {/* Printable sheet — invisible on screen, the only thing window.print() shows */}
      <div id="race-print" className="hidden print:block text-black bg-white p-4">
        <h1 className="text-xl font-bold">{race.description || race.name}</h1>
        <p className="text-sm mb-3">
          {event.name} · {race.startTime ? new Date(race.startTime).toLocaleString() : "-"} · {race.distance ?? "-"} mi · {raceItems.length} birds
        </p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {["Pos", "Status", "Band", "Bird", "Breeder", "Loft", "Arrival", "Prize"].map((h) => (
                <th key={h} className="border border-black px-1.5 py-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {raceItems.map((ri) => (
              <tr key={ri.id}>
                <td className="border border-black px-1.5 py-0.5">{ri.birdPosition ?? ""}</td>
                <td className="border border-black px-1.5 py-0.5">{ri.status}</td>
                <td className="border border-black px-1.5 py-0.5 font-mono">{shortBand(ri.bird?.band)}</td>
                <td className="border border-black px-1.5 py-0.5">{ri.bird?.birdName ?? ""}</td>
                <td className="border border-black px-1.5 py-0.5">{[ri.bird?.breeder?.firstName, ri.bird?.breeder?.lastName].filter(Boolean).join(" ")}</td>
                <td className="border border-black px-1.5 py-0.5">{ri.eventInventoryItem?.eventInventory?.loft ?? ""}</td>
                <td className="border border-black px-1.5 py-0.5">{ri.arrivalTime ? new Date(ri.arrivalTime).toLocaleString() : ""}</td>
                <td className="border border-black px-1.5 py-0.5">{ri.prizeValue != null ? ri.prizeValue.toFixed(2) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Back: history if came from in-app, else event page (new tab / direct link) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          window.history.length > 1
            ? router.back()
            : router.push(`/admin/events/${eventId}`)
        }
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      {/* Compact Race Header */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
            {/* Event Logo */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden shadow-lg border-4 border-white">
                {event.logoImage ? (
                  <Image
                    src={event.logoImage}
                    alt={event.name ?? "Event"}
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-2xl md:text-3xl font-bold text-muted-foreground">
                    {(race.description ?? "").substring(0, 3).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Race Info */}
            <div className="flex-1 min-w-0">
              <div className="space-y-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">{race.description}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm md:text-base text-muted-foreground font-medium">{event.name}</span>
                    {race.status === "REGISTERING" && (
                      <Badge variant="default" className="text-sm bg-blue-600">Registering</Badge>
                    )}
                    {race.status === "STARTED" && (
                      <Badge variant="default" className="text-sm bg-green-600 animate-pulse">LIVE</Badge>
                    )}
                    {race.status === "ENDED" && (
                      <Badge variant="secondary" className="text-sm">Ended</Badge>
                    )}
                    <Badge variant={race.status === "ENDED" ? "secondary" : "default"}>
                      {race.raceType?.name || "Race"}
                    </Badge>
                    {race.status === "REGISTERING" && (
                      <StartRaceDialog
                        eventId={eventId}
                        raceId={raceId}
                        isPending={isStartingRace}
                        onStart={(basketIds, liberatedAt) => startRace({ liberatedAt, ...(basketIds ? { basketIds } : {}) })}
                      />
                    )}
                    {race.status === "STARTED" && (
                      <Button
                        onClick={() => endRace({})}
                        disabled={isEndingRace}
                        size="sm"
                        variant="destructive"
                        className="gap-2"
                      >
                        <StopCircle className="h-4 w-4" />
                        {isEndingRace ? "Ending..." : "End Race"}
                      </Button>
                    )}
                    {race.status !== "REGISTERING" && (
                      <>
                        <CorrectionsDialog raceId={raceId} raceItems={allRaceItems} />
                        <RecalculateDialog raceId={raceId} />
                      </>
                    )}
                    {isScanning ? (
                      <Button
                        onClick={stopScanner}
                        size="sm"
                        className="gap-2 bg-red-600 hover:bg-red-700"
                      >
                        <Square className="h-4 w-4" />
                        Stop Scanner
                      </Button>
                    ) : (
                      <Button
                        onClick={startScanner}
                        size="sm"
                        className="gap-2"
                      >
                        <Radio className="h-4 w-4" />
                        {race.status === "REGISTERING" ? "Loft Scanner" : "Start Scanner"}
                      </Button>
                    )}
                    <Button
                      onClick={isSerial ? disconnectSerial : () => { stopScanner(); connectSerial(); }}
                      size="sm"
                      variant={isSerial ? "default" : "outline"}
                      className="gap-2"
                    >
                      <Usb className="h-4 w-4" />
                      {isSerial ? "USB Connected" : "USB Serial"}
                    </Button>
                    {queuedCount > 0 && (
                      <Badge variant="destructive" title="Scans waiting to reach the server; retried every 5s">
                        {queuedCount} scan{queuedCount > 1 ? "s" : ""} queued
                      </Badge>
                    )}
                    {clockOffset != null && Math.abs(clockOffset) > 2000 && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600" title="Browser-stamped scans are corrected to server time. Scanner hardware clocks are not — check the reader's clock.">
                        PC clock {clockOffset > 0 ? "behind" : "ahead"} by {(Math.abs(clockOffset) / 1000).toFixed(1)}s
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <p className="text-sm md:text-base text-blue-600">
                      Location: <span className="font-medium">{race.location}</span>
                    </p>
                    <p className="text-sm md:text-base text-muted-foreground">
                      Race ID: <span className="font-mono font-medium">{race.id}</span>
                    </p>
                  </div>
                  <div className="mt-2 print:hidden">
                    <RaceDescriptionEditor key={race.description ?? ""} raceId={race.id} description={race.description} />
                  </div>
                </div>

                {/* Weather & Conditions - Compact Layout */}
                <div className="border border-border rounded-lg p-3 bg-card text-card-foreground space-y-2">
                  {/* Release Conditions */}
                  <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground">
                        <path d="M14 18V6a4 4 0 0 0-8 0v12"/>
                        <path d="M10 2v4"/>
                        <path d="M10 18h4"/>
                        <path d="M10 22v-4"/>
                        <path d="M14 6h4"/>
                      </svg>
                    </div>
                    {race.weather && (
                      <div className="flex items-center gap-1.5">
                        {getWeatherIcon(race.weather)}
                        <span className="text-foreground">{race.weather}</span>
                      </div>
                    )}
                    {race.temperature && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-500">
                          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
                        </svg>
                        <span className="font-medium text-foreground">{cToF(race.temperature)}</span>
                      </div>
                    )}
                    {race.wind && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500">
                          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
                          <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
                          <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
                        </svg>
                        <span className="text-foreground">{race.wind}</span>
                      </div>
                    )}
                  </div>

                  {/* Arrival Conditions */}
                  <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground">
                        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                        <path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/>
                        <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>
                      </svg>
                    </div>
                    {race.arrivalWeather && (
                      <div className="flex items-center gap-1.5">
                        {getWeatherIcon(race.arrivalWeather)}
                        <span className="text-foreground">{race.arrivalWeather}</span>
                      </div>
                    )}
                    {race.arrivalTemperature && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-500">
                          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
                        </svg>
                        <span className="font-medium text-foreground">{cToF(race.arrivalTemperature)}</span>
                      </div>
                    )}
                    {race.arrivalWind && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500">
                          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
                          <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
                          <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
                        </svg>
                        <span className="text-foreground">{race.arrivalWind}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                  <div className="border border-border rounded-lg p-2 md:p-3 bg-card text-card-foreground text-center">
                    <div className="text-lg md:text-xl font-bold text-foreground">
                      {race.startTime ? new Date(race.startTime).toLocaleDateString() : "-"}
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">
                      {race.startTime ? new Date(race.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Start Time</div>
                  </div>
                  <div className="border border-border rounded-lg p-2 md:p-3 bg-card text-card-foreground text-center">
                    <div className="text-lg md:text-xl font-bold text-foreground">{race.distance}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Mi</div>
                    <div className="text-xs text-muted-foreground mt-1">Distance</div>
                  </div>
                  <div className="border border-border rounded-lg p-2 md:p-3 bg-card text-card-foreground text-center">
                    <div className="text-lg md:text-xl font-bold text-foreground">
                      {race.sunrise ? new Date(race.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground">
                      {race.sunset ? new Date(race.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Sunrise / Sunset</div>
                  </div>
                  <div className="border border-border rounded-lg p-2 md:p-3 bg-card text-card-foreground text-center">
                    <div className="text-lg md:text-xl font-bold text-foreground">{homeCount}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">home of {outCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">Arrivals</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Side panel — route map with weather */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">Tools</span>
              <RaceWindButton raceId={race.id} />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLinksOpen(true)}>
                <Link2 className="h-3.5 w-3.5" />
                Links
              </Button>
              <LinksDialog open={linksOpen} onClose={() => setLinksOpen(false)} race={race} />
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Main Layout */}
      <div className="space-y-4 md:space-y-6">

        {/* GPS disabled for now (re-enable after deploy/testing) */}
        {/* <TransportCard raceId={raceId} /> */}
        {/* <RouteHistoryCard raceId={raceId} /> */}

        {/* Race Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Race Items ({raceItems.length})</CardTitle>
            <div className="flex items-center gap-2">
              <ExportButton kind="results" eventId={eventId} raceId={raceId} />
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {/* Row 1: status chips + status filter */}
            {(() => {
              const rawCounts: Record<string, number> = {};
              allRaceItems.forEach((ri) => {
                if (ri.status) rawCounts[ri.status] = (rawCounts[ri.status] ?? 0) + 1;
              });
              const loftCount     = rawCounts["LOFT_BASKETED"] ?? 0;
              const arrivedCount  = rawCounts["ARRIVED"] ?? 0;
              const foreignCount  = rawCounts["FOREIGN_BIRD"] ?? 0;
              const releasedCount = (rawCounts["RELEASED"] ?? 0) + arrivedCount + foreignCount;
              const CHIPS = [
                { values: ["LOFT_BASKETED"],                     label: "Loft Basketed", count: loftCount,     color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
                { values: ["RELEASED","ARRIVED","FOREIGN_BIRD"], label: "Released",      count: releasedCount, color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
                { values: ["ARRIVED"],                           label: "Arrived",       count: arrivedCount,  color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
                { values: ["FOREIGN_BIRD"],                      label: "Foreign",       count: foreignCount,  color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
              ] as const;
              return (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {CHIPS.map((chip) => {
                    const active = chip.values.length === selectedStatuses.length &&
                      chip.values.every((v) => selectedStatuses.includes(v));
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setSelectedStatuses(active ? [] : [...chip.values])}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${chip.color} ${active ? "ring-2 ring-offset-1 ring-current" : "opacity-80 hover:opacity-100"}`}
                      >
                        <span className="text-base font-bold">{chip.count}</span>
                        <span>{chip.label}</span>
                      </button>
                    );
                  })}
                  <RaceStatusFilter
                    raceId={raceId}
                    selectedStatuses={selectedStatuses}
                    onSelectedChange={setSelectedStatuses}
                  />
                </div>
              );
            })()}

            {/* Unpaid filter — unpaid/partial registrations are shown red in the table */}
            <div className="flex items-center gap-2 mb-2">
              <Switch id="unpaid-only" checked={unpaidOnly} onCheckedChange={setUnpaidOnly} />
              <label htmlFor="unpaid-only" className="text-sm font-medium text-muted-foreground cursor-pointer">
                Unpaid only
              </label>
              <span className="text-xs text-muted-foreground">(entry fees not fully paid are shown in red)</span>
            </div>

            {/* Row 2: arrival time */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Arrival Time:</span>
              <span className="text-sm text-muted-foreground">From:</span>
              <Input
                type="datetime-local"
                className="h-8 w-48"
                value={arrivalFrom}
                onChange={(e) => setArrivalFrom(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">To:</span>
              <Input
                type="datetime-local"
                className="h-8 w-48"
                value={arrivalTo}
                onChange={(e) => setArrivalTo(e.target.value)}
              />
            </div>

            {/* Row 3: search + clear — via DataTable toolbarExtra */}
            <DataTable
              tableId="race-items"
              columns={createRaceItemsColumns((item) => {
                setStatusItem(item);
                setStatusOpen(true);
              })}
              data={raceItems}
              emptyState={allRaceItems.length === 0 ? "No birds in this race yet." : undefined}
              rowClassName={(ri) => (isUnpaid(ri) ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50" : undefined)}
              resetFiltersKey={tableResetKey}
              filterableColumns={[
                { id: "band", title: "Band" },
                { id: "birdName", title: "Bird Name" },
                { id: "breeder", title: "Breeder" },
              ]}
              toolbarExtra={
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  setArrivalFrom("");
                  setArrivalTo("");
                  setArrivalDefaultSet(false);
                  setSelectedStatuses([]);
                  setUnpaidOnly(false);
                  setTableResetKey((k) => k + 1);
                }}>
                  Clear All
                </Button>
              }
            />
          </CardContent>
        </Card>

        {/* Basketting List */}
        <BasketTabs eventId={eventId} />
      </div>


      <RaceStatusDialog
        item={statusItem}
        open={statusOpen}
        onOpenChange={setStatusOpen}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ["raceItems", "list", `raceId-${raceId}`] });
        }}
      />
    </div>
  );
}

