"use client";

import { useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useApiQuery } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { useListRaceItems } from "@/lib/api/race-items";
import { colorForGroupId } from "@/lib/arrivalGrouping";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { BasketTabs } from "./basket-tabs";
import { BasketRaceItemsDialog } from "./basket-race-items-dialog";
import { raceItemsColumns } from "./race-items-columns";
import { getWeatherIcon } from "@/lib/weather-constants";
import type { Race, Event, RaceItem } from "@/lib/types";
import type { RowSelectionState } from "@tanstack/react-table";
import Image from "next/image";
import { Layers, Package, Play, Radio, Square, StopCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ArrivalGroup {
  id: number;
  name: string;
  start: string; // datetime-local value
  end: string;
}

export default function RaceDetailsPage() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const raceId = params?.raceId as string;

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [basketDialogOpen, setBasketDialogOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [arrivalFrom, setArrivalFrom] = useState<string>("");
  const [arrivalTo, setArrivalTo] = useState<string>("");
  const [arrivalGroups, setArrivalGroups] = useState<ArrivalGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupStart, setNewGroupStart] = useState("");
  const [newGroupEnd, setNewGroupEnd] = useState("");
  const lastScannedRfidRef = useRef<string | null>(null);
  const scannerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Fetch race details
  const { data: raceData, isPending: raceLoading } = useApiQuery({
    endpoint: apiEndpoints.races.base,
    queryKey: ["races", "detail", raceId],
    params: { raceId },
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
  const handleScan = useCallback(async (rfid: string) => {
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');

    try {
      const res = await fetch(`/api/admin/race/${raceId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ringNo: rfid, timestamp }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Scan failed');
        return;
      }

      const birdName = data.raceItem?.bird?.birdName || rfid;
      if (data.isNewScan) {
        if (data.scanType === "loft") {
          toast.success(`${birdName} added to loft basket`);
        } else {
          toast.success(`${birdName} arrived! Position: ${data.raceItem?.birdPosition}`);
        }
        queryClient.invalidateQueries({ queryKey: ["raceItems", "list", `raceId-${raceId}`] });
      } else {
        toast.info(data.message || 'Bird already scanned');
      }
    } catch {
      toast.error('Scan request failed');
    }
  }, [raceId, queryClient]);

  const stopScanner = useCallback(() => {
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }
    setIsScanning(false);
    lastScannedRfidRef.current = null;
    toast.info('Scanner stopped');
  }, []);

  const startScanner = useCallback(() => {
    setIsScanning(true);
    lastScannedRfidRef.current = null;
    toast.success('Scanner started');

    scannerIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/scanner/poll', { method: 'POST' });
        const data = await res.json();

        if (data && data.length > 0 && data[0].el) {
          const rfid = data[0].el;
          if (rfid !== lastScannedRfidRef.current) {
            lastScannedRfidRef.current = rfid;
            handleScan(rfid);
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

  const fromMs = arrivalFrom ? new Date(`${arrivalFrom}T00:00:00`).getTime() : NaN;
  const toMs = arrivalTo ? new Date(`${arrivalTo}T23:59:59.999`).getTime() : NaN;
  const hasArrivalFilter = !isNaN(fromMs) || !isNaN(toMs);
  const raceItems: RaceItem[] = hasArrivalFilter
    ? allRaceItems.filter((ri) => {
        const t = ri.arrivalTime ?? ri.result?.arrivalTime ?? null;
        if (!t) return false;
        const ms = new Date(t).getTime();
        if (!isNaN(fromMs) && ms < fromMs) return false;
        if (!isNaN(toMs) && ms > toMs) return false;
        return true;
      })
    : allRaceItems;

  // Get selected race items
  const selectedRaceItems = raceItems.filter((_, index) => rowSelection[index]);

  const handleBasketSuccess = () => {
    setRowSelection({});
  };

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
      {/* Compact Race Header */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
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
                  <span className="text-2xl md:text-3xl font-bold text-gray-600">
                    {(race.description ?? "").substring(0, 3).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Race Info */}
            <div className="flex-1 min-w-0">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{race.description}</h1>
                    {race.status === "REGISTERING" && (
                      <Badge variant="default" className="text-sm bg-blue-600">Registering</Badge>
                    )}
                    {race.status === "STARTED" && (
                      <Badge variant="default" className="text-sm bg-green-600 animate-pulse">LIVE</Badge>
                    )}
                    {race.status === "ENDED" && (
                      <Badge variant="secondary" className="text-sm">Ended</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm md:text-base text-gray-600 font-medium">{event.name}</span>
                    <Badge variant={race.status === "ENDED" ? "secondary" : "default"}>
                      {race.raceType?.name || "Race"}
                    </Badge>
                    {race.status === "REGISTERING" && (
                      <Button
                        onClick={() => startRace({})}
                        disabled={isStartingRace}
                        size="sm"
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-4 w-4" />
                        {isStartingRace ? "Starting..." : "Start Race"}
                      </Button>
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
                  </div>
                  <p className="text-sm md:text-base text-blue-600 mt-1">
                    Location: <span className="font-medium">{race.location}</span>
                  </p>
                </div>

                {/* Weather & Conditions - Compact Layout */}
                <div className="border rounded-lg p-3 bg-transparent space-y-2">
                  {/* Release Conditions */}
                  <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 text-gray-600">
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
                        <span className="text-gray-700">{race.weather}</span>
                      </div>
                    )}
                    {race.temperature && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-500">
                          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
                        </svg>
                        <span className="font-medium text-gray-900">{race.temperature}°F</span>
                      </div>
                    )}
                    {race.wind && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500">
                          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
                          <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
                          <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
                        </svg>
                        <span className="text-gray-700">{race.wind}</span>
                      </div>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-600">
                      <path d="m3 8 4-4 4 4"/>
                      <path d="M7 4v16"/>
                      <path d="M11 12h4"/>
                      <path d="M11 16h7"/>
                      <path d="M11 20h10"/>
                    </svg>
                  </div>

                  {/* Arrival Conditions */}
                  <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 text-gray-600">
                        <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                        <path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/>
                        <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>
                      </svg>
                    </div>
                    {race.arrivalWeather && (
                      <div className="flex items-center gap-1.5">
                        {getWeatherIcon(race.arrivalWeather)}
                        <span className="text-gray-700">{race.arrivalWeather}</span>
                      </div>
                    )}
                    {race.arrivalTemperature && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-500">
                          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>
                        </svg>
                        <span className="font-medium text-gray-900">{race.arrivalTemperature}°F</span>
                      </div>
                    )}
                    {race.arrivalWind && (
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500">
                          <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
                          <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
                          <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
                        </svg>
                        <span className="text-gray-700">{race.arrivalWind}</span>
                      </div>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-600">
                      <path d="m3 8 4-4 4 4"/>
                      <path d="M7 4v16"/>
                      <path d="M11 12h4"/>
                      <path d="M11 16h7"/>
                      <path d="M11 20h10"/>
                    </svg>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                  <div className="border rounded-lg p-2 md:p-3 bg-transparent text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">
                      {race.startTime ? new Date(race.startTime).toLocaleDateString() : "-"}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600">
                      {race.startTime ? new Date(race.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Start Time</div>
                  </div>
                  <div className="border rounded-lg p-2 md:p-3 bg-transparent text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">{race.distance}</div>
                    <div className="text-xs md:text-sm text-gray-600">Mi</div>
                    <div className="text-xs text-gray-500 mt-1">Distance</div>
                  </div>
                  <div className="border rounded-lg p-2 md:p-3 bg-transparent text-center">
                    <div className="text-lg md:text-xl font-bold text-gray-900">
                      {race.sunrise ? new Date(race.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </div>
                    <div className="text-xs md:text-sm text-gray-600">
                      {race.sunset ? new Date(race.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Sunrise / Sunset</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-4 md:gap-6">
        {/* Left Side */}
        <div className="space-y-4 md:space-y-6 min-w-0">

          {/* Race Items Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Race Items ({raceItems.length})</CardTitle>
              {selectedRaceItems.length > 0 && (
                <Button
                  onClick={() => setBasketDialogOpen(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Package className="h-4 w-4" />
                  Basket ({selectedRaceItems.length})
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="flex flex-wrap items-end gap-3 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Arrival From</Label>
                  <Input
                    type="date"
                    className="h-9 w-44"
                    value={arrivalFrom}
                    onChange={(e) => setArrivalFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Arrival To</Label>
                  <Input
                    type="date"
                    className="h-9 w-44"
                    value={arrivalTo}
                    onChange={(e) => setArrivalTo(e.target.value)}
                  />
                </div>
                {(arrivalFrom || arrivalTo) && (
                  <Button variant="outline" size="sm" onClick={() => { setArrivalFrom(""); setArrivalTo(""); }}>
                    Clear
                  </Button>
                )}
              </div>
              <DataTable
                columns={raceItemsColumns}
                data={raceItems}
                filterableColumns={[
                  { id: "band", title: "Band" },
                  { id: "birdName", title: "Bird Name" },
                  { id: "breeder", title: "Breeder" },
                ]}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
              />
            </CardContent>
          </Card>
          {/* Arrival Groups Card — UI-only, time-window based */}
          <Card>
            <CardHeader>
              <CardTitle>Arrival Groups ({arrivalGroups.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Group creation form */}
              <div className="flex flex-wrap items-end gap-3 border rounded p-3 bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-9 w-40"
                    placeholder="Group A"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start (Time A)</Label>
                  <Input
                    type="datetime-local"
                    className="h-9 w-56"
                    value={newGroupStart}
                    onChange={(e) => setNewGroupStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End (Time B)</Label>
                  <Input
                    type="datetime-local"
                    className="h-9 w-56"
                    value={newGroupEnd}
                    onChange={(e) => setNewGroupEnd(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="gap-1"
                  disabled={!newGroupStart || !newGroupEnd}
                  onClick={() => {
                    if (!newGroupStart || !newGroupEnd) return;
                    if (new Date(newGroupStart).getTime() > new Date(newGroupEnd).getTime()) {
                      toast.error("Start must be before end");
                      return;
                    }
                    setArrivalGroups((prev) => [
                      ...prev,
                      {
                        id: Date.now(),
                        name: newGroupName.trim() || `Group ${prev.length + 1}`,
                        start: newGroupStart,
                        end: newGroupEnd,
                      },
                    ]);
                    setNewGroupName("");
                    setNewGroupStart("");
                    setNewGroupEnd("");
                  }}
                >
                  <Layers className="h-4 w-4" />
                  Add Group
                </Button>
              </div>

              {/* Render groups + matching birds */}
              {(() => {
                const arrived = raceItems.filter((ri) => ri.arrivalTime);
                if (arrivalGroups.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No groups defined. Add a time window above.
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {arrivalGroups.map((g) => {
                      const c = colorForGroupId(g.id);
                      const startMs = new Date(g.start).getTime();
                      const endMs = new Date(g.end).getTime();
                      const items = arrived
                        .filter((ri) => {
                          const t = ri.arrivalTime ? new Date(ri.arrivalTime).getTime() : NaN;
                          return !isNaN(t) && t >= startMs && t <= endMs;
                        })
                        .sort((a, b) => {
                          const at = a.arrivalTime ? new Date(a.arrivalTime).getTime() : 0;
                          const bt = b.arrivalTime ? new Date(b.arrivalTime).getTime() : 0;
                          return at - bt;
                        });
                      return (
                        <div
                          key={g.id}
                          className={cn("rounded border-2 overflow-hidden", c.border)}
                        >
                          <div className={cn("flex items-center justify-between px-3 py-2", c.bg)}>
                            <div>
                              <p className={cn("font-medium text-sm", c.text)}>
                                {g.name}
                                <span className="ml-2 text-xs opacity-80">
                                  ({items.length} bird{items.length === 1 ? "" : "s"})
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(g.start).toLocaleString()} →{" "}
                                {new Date(g.end).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setArrivalGroups((prev) => prev.filter((x) => x.id !== g.id))
                              }
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                          {items.length > 0 ? (
                            <div className={cn("divide-y", c.bg, "bg-opacity-40")}>
                              {items.map((ri) => (
                                <ArrivalRow key={ri.id} ri={ri} />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground px-3 py-2">
                              No birds arrived in this window.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Right Side - 30% */}
        <div className="min-w-0">
          <BasketTabs eventId={eventId} />
        </div>
      </div>

      {/* Basket Dialog */}
      <BasketRaceItemsDialog
        open={basketDialogOpen}
        onOpenChange={setBasketDialogOpen}
        selectedItems={selectedRaceItems}
        eventId={eventId}
        onSuccess={handleBasketSuccess}
      />
    </div>
  );
}

function ArrivalRow({ ri }: { ri: RaceItem }) {
  const band = ri.bird?.band ?? "—";
  const name = ri.bird?.birdName ?? "";
  const pos = ri.birdPosition ?? null;
  const t = ri.arrivalTime ? new Date(ri.arrivalTime) : null;
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        {pos != null && (
          <span className="font-mono text-xs text-muted-foreground w-6 text-right">
            #{pos}
          </span>
        )}
        <span className="font-medium truncate">{band}</span>
        {name && <span className="text-muted-foreground truncate">{name}</span>}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t ? t.toLocaleTimeString() : "—"}
      </span>
    </div>
  );
}
