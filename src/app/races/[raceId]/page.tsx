"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Cloud, Thermometer, Wind, ArrowUpRight, TrendingUp, TrendingDown, Gauge, Building, Home as HomeIcon, Users } from "lucide-react";
import { raceResultsColumns, type EnrichedRaceItem } from "./race-results-columns";
import type { Race, RaceItem } from "@/lib/types";
import Image from "next/image";

function raceTypeLabel(code?: string | null): string {
  if (!code) return "";
  const c = code.toUpperCase();
  if (["A", "B", "C"].includes(c)) return "Average Speed";
  if (c === "T") return "Trainer";
  if (c === "D") return "Not Average Speed";
  if (c === "Z") return "Private";
  return code;
}

function formatTime(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleTimeString([], { hour12: false });
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  const date = `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${String(dt.getFullYear()).slice(2)}`;
  const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export default function PublicRacePage() {
  const params = useParams();
  const router = useRouter();
  const raceId = params?.raceId as string;
  const { data: sessionData } = authClient.useSession();
  const currentUserId = sessionData?.user?.id ?? null;
  const [myTeamOnly, setMyTeamOnly] = useState(false);

  const { data: raceData, isPending: raceLoading } = useApiQuery({
    endpoint: apiEndpoints.breeder.races,
    queryKey: ["breeder", "races", "detail", raceId],
    params: { raceId },
  });

  const race = raceData?.race as Race;
  const isLive = race?.status === "STARTED";

  const { data: raceItemsData, isPending: raceItemsLoading } = useApiQuery({
    endpoint: apiEndpoints.breeder.raceItems(raceId),
    queryKey: ["breeder", "raceItems", raceId],
    refetchInterval: isLive ? 15000 : false,
  });

  if (raceLoading || raceItemsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const raceItems = (raceItemsData?.raceItems || []) as RaceItem[];

  if (!race) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-red-500">
          <p>Race not found</p>
        </div>
      </div>
    );
  }

  // --- Enrich items: rank, gap, ypm ---
  const arrived = raceItems
    .filter((it) => !!it.arrivalTime)
    .sort((a, b) => new Date(a.arrivalTime!).getTime() - new Date(b.arrivalTime!).getTime());

  const leaderTimeMs = arrived[0]?.arrivalTime ? new Date(arrived[0].arrivalTime).getTime() : null;
  const startMs = race.startTime ? new Date(race.startTime).getTime() : null;
  const distanceMi = race.distance ?? 0;
  const distanceYards = distanceMi * 1760;

  const rankMap = new Map<number, number>();
  arrived.forEach((it, idx) => rankMap.set(it.id, idx + 1));

  const enriched: EnrichedRaceItem[] = raceItems.map((it) => {
    const arrivalMs = it.arrivalTime ? new Date(it.arrivalTime).getTime() : null;
    let ypm: number | null = null;
    if (arrivalMs && startMs && distanceYards > 0) {
      const minutes = (arrivalMs - startMs) / 60000;
      if (minutes > 0) ypm = distanceYards / minutes;
    }
    const breeder = it.bird?.breeder;
    const loftName = breeder?.user?.loftName || (breeder ? `${breeder.firstName ?? ""} ${breeder.lastName ?? ""}`.trim() : "");
    return {
      ...it,
      rank: rankMap.get(it.id) ?? null,
      leaderTimeMs,
      ypm,
      loftName: loftName || "-",
      countryCode: breeder?.country ?? null,
      loftImage: breeder?.user?.image ?? breeder?.image ?? null,
      band: it.bird?.band ?? "",
      bandSex: it.bird?.sex ?? null,
      color: it.bird?.color ?? null,
      previousPosition: it.previousPosition ?? null,
    };
  });

  // --- Stats ---
  const releasedStatuses = new Set(["RELEASED", "ARRIVED", "FOREIGN_BIRD"]);
  const released = raceItems.filter((it) => releasedStatuses.has((it.status as string) || "")).length;
  const returned = arrived.length;
  const awaiting = Math.max(0, released - returned);
  const returnedPct = released > 0 ? Math.round((returned / released) * 100) : 0;
  const awaitingPct = released > 0 ? 100 - returnedPct : 0;
  const activeLofts = new Set(
    arrived.map((it) => it.bird?.breeder?.id).filter(Boolean)
  ).size;

  const raceVelocity = enriched.find((e) => e.rank === 1)?.ypm ?? null;

  const completedTime = race.status === "ENDED" && race.endTime ? formatTime(race.endTime) : null;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      {/* Race Header */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            {/* Event Logo */}
            <div className="shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden shadow-lg border-4 border-white">
                {race.event?.logoImage ? (
                  <Image
                    src={race.event.logoImage}
                    alt={race.event.name ?? "Event"}
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-2xl md:text-3xl font-bold text-gray-600">
                    {(race.event?.name ?? race.description ?? "").substring(0, 3).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Main info column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    {race.event?.name || race.description}
                  </h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-sm font-semibold text-red-600 uppercase tracking-wide">
                      {race.description}
                    </span>
                    {race.raceType?.name && (
                      <Badge variant="outline" className="text-xs">
                        {raceTypeLabel(race.raceType.name)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm md:text-base mt-1">
                    Release Station:{" "}
                    <span className="font-semibold text-blue-600">{race.location || "-"}</span>
                  </p>
                </div>
                <div>
                  {race.status === "REGISTERING" && (
                    <Badge variant="default" className="bg-blue-600">Registering</Badge>
                  )}
                  {race.status === "STARTED" && (
                    <Badge variant="default" className="bg-red-600 animate-pulse gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                      LIVE
                    </Badge>
                  )}
                  {completedTime && (
                    <Badge variant="outline" className="text-sm gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-gray-500" />
                      Completed {completedTime}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Info row: weather block + date + distance + velocity */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3 mt-4">
                {/* Weather */}
                <div className="border rounded-lg p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-gray-500" />
                    <Cloud className="h-3.5 w-3.5 text-blue-500" />
                    <span>{race.weather || "-"}</span>
                    <Thermometer className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-600 font-semibold">{race.temperature ? `${race.temperature}°F` : "-"}</span>
                    <Wind className="h-3.5 w-3.5" />
                    <span>{race.wind || "-"}</span>
                    <ArrowUpRight className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <HomeIcon className="h-3.5 w-3.5 text-gray-500" />
                    <Cloud className="h-3.5 w-3.5 text-blue-500" />
                    <span>{race.arrivalWeather || "-"}</span>
                    <Thermometer className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-600 font-semibold">{race.arrivalTemperature ? `${race.arrivalTemperature}°F` : "-"}</span>
                    <Wind className="h-3.5 w-3.5" />
                    <span>{race.arrivalWind || "-"}</span>
                    <ArrowUpRight className="h-3 w-3 text-blue-600" />
                  </div>
                </div>

                {/* Release Date & Time */}
                <div className="border rounded-lg p-2 md:p-3 text-center">
                  <div className="text-sm md:text-base font-bold">
                    {formatDateTime(race.startTime)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Release Date & Time</div>
                </div>

                {/* Distance */}
                <div className="border rounded-lg p-2 md:p-3 text-center">
                  <div className="text-lg md:text-xl font-bold">
                    {distanceMi.toFixed(3)} <span className="text-sm">MI</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Distance</div>
                </div>

                {/* Race Velocity */}
                <div className="border rounded-lg p-2 md:p-3 text-center">
                  <div className="text-lg md:text-xl font-bold text-red-600">
                    {raceVelocity != null ? raceVelocity.toFixed(2) : "-"} <span className="text-sm">YPM</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Race Velocity</div>
                </div>
              </div>

              {/* Stats line */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>Active Lofts: <span className="font-bold">{activeLofts}</span></span>
                <span>Released: <span className="font-bold">{released}</span></span>
                <span className="flex items-center gap-1">
                  Returned: <span className="font-bold">{returned}</span>
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-600 font-semibold">{returnedPct}%</span>
                </span>
                <span className="flex items-center gap-1">
                  Awaiting: <span className="font-bold">{awaiting}</span>
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-red-600 font-semibold">{awaitingPct}%</span>
                </span>
              </div>
            </div>

            {/* Competitions side panel */}
            <div className="flex flex-col items-end gap-2 md:w-40 shrink-0">
              <span className="text-xs text-gray-500">Competitions</span>
              <Button
                variant="default"
                className="bg-green-500 hover:bg-green-600 text-white gap-1.5"
                onClick={() => race.eventId && router.push(`/events/${race.eventId}/avg-speed`)}
              >
                <Gauge className="h-4 w-4" />
                Avg. Speed
              </Button>
              {currentUserId && (
                <Button
                  variant={myTeamOnly ? "default" : "outline"}
                  className={myTeamOnly ? "bg-purple-600 hover:bg-purple-700 text-white gap-1.5 w-full" : "gap-1.5 w-full"}
                  onClick={() => setMyTeamOnly((v) => !v)}
                >
                  <Users className="h-4 w-4" />
                  {myTeamOnly ? "Show All" : "My Team"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Race Results Table */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <h2 className="text-center text-lg font-bold text-blue-600 mb-4">
            Race Results by Rank
          </h2>
          <DataTable
            columns={raceResultsColumns}
            data={myTeamOnly && currentUserId
              ? enriched.filter((e) => e.bird?.breeder?.user?.id === currentUserId)
              : enriched}
            searchKey="loftAndBand"
            searchPlaceholder="Loft Name or Bird Band"
          />
        </CardContent>
      </Card>
    </div>
  );
}
