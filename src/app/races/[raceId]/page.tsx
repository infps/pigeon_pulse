"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Cloud, Thermometer, Wind, ArrowUpRight, TrendingUp, TrendingDown, Gauge, Building, Home as HomeIcon, Users, Bird as BirdIcon, Calendar, Trophy, ExternalLink, DollarSign, MapPin as MapPinIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { makeRaceResultsColumns, type EnrichedRaceItem } from "./race-results-columns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RaceBettingTab } from "./race-betting-tab";
// GPS disabled for now: import { LiveTransit } from "./live-transit";
import { useSettings } from "@/lib/settings-context";
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
  const [breederPopup, setBreederPopup] = useState<{ id: number; name: string } | null>(null);
  const [birdPopup, setBirdPopup] = useState<{ id: number; band: string } | null>(null);
  const { velocityUnit, sexTerminology } = useSettings();
  const columns = useMemo(() => makeRaceResultsColumns({
    velocityUnit,
    sexTerminology,
    onBreederClick: (id, name) => setBreederPopup({ id, name }),
    onBirdClick: (id, band) => setBirdPopup({ id, band }),
  }), [velocityUnit, sexTerminology]);

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
      breederId: it.bird?.breeder?.id ?? null,
      birdId: it.bird?.id ?? null,
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
                    {raceVelocity != null ? (velocityUnit === "MPM" ? (raceVelocity * 0.9144).toFixed(2) : raceVelocity.toFixed(2)) : "-"} <span className="text-sm">{velocityUnit}</span>
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

      {/* GPS disabled for now (re-enable after deploy/testing) */}
      {/* <LiveTransit raceId={raceId} /> */}

      {/* Results + Betting */}
      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="betting">Betting</TabsTrigger>
        </TabsList>
        <TabsContent value="results" className="mt-4">
          <Card>
            <CardContent className="p-4 md:p-6">
              <h2 className="text-center text-lg font-bold text-blue-600 mb-4">
                Race Results by Rank
              </h2>
              <DataTable
                columns={columns}
                data={myTeamOnly && currentUserId
                  ? enriched.filter((e) => e.bird?.breeder?.user?.id === currentUserId)
                  : enriched}
                searchKey="loftAndBand"
                searchPlaceholder="Loft Name or Bird Band"
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="betting" className="mt-4">
          <Card>
            <CardContent className="p-4 md:p-6">
              <RaceBettingTab raceId={raceId} currentUserId={currentUserId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {breederPopup && (
        <BreederBirdsModal
          loftName={breederPopup.name}
          loftImage={enriched.find((e) => e.breederId === breederPopup.id)?.loftImage ?? null}
          race={race}
          raceItems={enriched.filter((e) => e.breederId === breederPopup.id)}
          onClose={() => setBreederPopup(null)}
        />
      )}
      {birdPopup && (
        <BirdHistoryModal
          birdId={birdPopup.id}
          band={birdPopup.band}
          onClose={() => setBirdPopup(null)}
        />
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function fmsFlight(ms: number): string {
  const t = Math.round(ms);
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const ms3 = t % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms3).padStart(3, "0")}`;
}

function fmsArrival(d: string): string {
  const dt = new Date(d);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}:${String(dt.getSeconds()).padStart(2, "0")}.${String(dt.getMilliseconds()).padStart(3, "0")}`;
}

function fmsGap(ms: number): string {
  const t = Math.round(ms);
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const ms3 = t % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms3).padStart(3, "0")}`;
}

function fmsRaceDate(d: string): { date: string; time: string } {
  const dt = new Date(d);
  const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

// ── Breeder Birds Modal ────────────────────────────────────────────────────

function BreederBirdsModal({
  loftName,
  loftImage,
  race,
  raceItems,
  onClose,
}: {
  loftName: string;
  loftImage: string | null;
  race: Race;
  raceItems: EnrichedRaceItem[];
  onClose: () => void;
}) {
  const { velocityUnit } = useSettings();
  const sorted = [...raceItems].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  const banner = race.event?.bannerImage ?? race.event?.logoImage ?? null;
  const isTraining = race.raceType?.name === "T";
  const releaseDate = race.startTime
    ? (() => {
        const dt = new Date(race.startTime);
        return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}-${String(dt.getFullYear()).slice(2)}`;
      })()
    : "-";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 pr-12 border-b">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-100 shrink-0 border-2 border-white shadow">
            {loftImage ? (
              <Image src={loftImage} alt={loftName} width={48} height={48} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-blue-700">
                {loftName.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight">{loftName}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{race.description || race.name || "-"}</span>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{releaseDate}</span>
              </div>
              {race.distance != null && (
                <span className="flex items-center gap-0.5">
                  <span className="font-semibold">{race.distance.toFixed(2)}</span>MI
                </span>
              )}
              <span className="font-semibold">{sorted.filter((r) => r.rank != null).length}</span>
              {isTraining && <Badge variant="outline" className="text-xs">Training</Badge>}
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-blue-700 to-blue-900 relative overflow-hidden shrink-0">
          {banner && <Image src={banner} alt="Event banner" fill className="object-cover opacity-60" />}
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b z-10">
              <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left p-3 w-14">Rank</th>
                <th className="text-left p-3">Bird Band ID</th>
                <th className="text-right p-3">Arrival Time</th>
                <th className="text-right p-3">Speed {velocityUnit}</th>
                <th className="text-right p-3">Color</th>
                <th className="text-left p-3">Name</th>
                <th className="text-center p-3">Competitions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => {
                const arrival = item.arrivalTime ? fmsArrival(item.arrivalTime) : "-";
                const gapDisplay =
                  item.rank === 1
                    ? "+0"
                    : item.leaderTimeMs != null && item.arrivalTime
                    ? fmsGap(new Date(item.arrivalTime).getTime() - item.leaderTimeMs)
                    : "-";
                const speed =
                  item.ypm != null
                    ? velocityUnit === "MPM"
                      ? (item.ypm * 0.9144).toFixed(3)
                      : item.ypm.toFixed(3)
                    : null;
                const sexIcon = item.bandSex === 1 ? "♂" : item.bandSex === 2 ? "♀" : "";
                const sexColor = item.bandSex === 1 ? "text-blue-500" : "text-pink-500";
                return (
                  <tr key={item.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border ${item.rank != null && item.rank <= 10 ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-700"}`}>
                        {item.rank ?? "-"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="h-3 w-3 text-green-600 shrink-0" />
                        <span className="font-mono text-green-700 font-semibold">{item.band || "-"}</span>
                        {sexIcon && <span className={`text-xs font-medium ${sexColor}`}>{sexIcon}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-mono text-xs">{arrival}</div>
                      <div className={`text-xs font-semibold ${item.rank === 1 ? "text-green-600" : "text-red-500"}`}>{gapDisplay}</div>
                    </td>
                    <td className="p-3 text-right">
                      {speed ? (
                        <span className="font-semibold">{speed} <span className="text-xs text-muted-foreground font-normal">{velocityUnit}</span></span>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{item.color || "-"}</td>
                    <td className="p-3">{item.bird?.birdName || "-"}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="gap-1 border-red-300 text-red-600 text-xs">
                        <DollarSign className="h-3 w-3" />
                        RACE
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-3 text-center text-sm text-muted-foreground border-t">
            Total Birds in Loft: {sorted.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Bird History Modal ─────────────────────────────────────────────────────

interface BirdInfo {
  band: string;
  loftName: string;
  breederName: string;
  loftImage: string | null;
  eligible: boolean;
}

interface HistoryEntry {
  type: string;
  date: string;
  eventId?: number;
  eventName?: string;
  raceId?: number;
  raceName?: string;
  position?: number;
  prizeValue?: number;
  distance?: number;
  ypm?: number;
  gapMs?: number;
  raceTypeName?: string | null;
  startTime?: string;
  flightTimeMs?: number;
  eventBanner?: string | null;
}

function RaceHistoryTable({ entries, velocityUnit }: { entries: HistoryEntry[]; velocityUnit: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
            <th className="text-left pb-2 w-12">Rank</th>
            <th className="text-left pb-2">Release Name</th>
            <th className="text-right pb-2">Date &amp; Time</th>
            <th className="text-right pb-2">Arrival / Gap</th>
            <th className="text-right pb-2">Dist. (MI)</th>
            <th className="text-right pb-2">Speed</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const dt = e.startTime ? fmsRaceDate(e.startTime) : { date: "-", time: "-" };
            const arrival = e.date ? fmsArrival(e.date) : "-";
            const gapDisplay =
              e.gapMs === 0 ? "+0" : e.gapMs != null ? fmsGap(e.gapMs) : "-";
            const speed =
              e.ypm != null
                ? velocityUnit === "MPM"
                  ? (e.ypm * 0.9144).toFixed(4)
                  : e.ypm.toFixed(4)
                : "-";
            return (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2.5">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border ${e.position != null && e.position <= 10 ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-700"}`}>
                    {e.position ?? "-"}
                  </span>
                </td>
                <td className="py-2.5 font-medium pr-2">{e.raceName || "-"}</td>
                <td className="py-2.5 text-right text-muted-foreground">
                  <div className="text-xs">{dt.date}</div>
                  <div className="text-xs">{dt.time}</div>
                </td>
                <td className="py-2.5 text-right">
                  <div className="font-mono text-xs">{arrival}</div>
                  <div className={`text-xs font-semibold ${e.gapMs === 0 ? "text-green-600" : "text-red-500"}`}>{gapDisplay}</div>
                </td>
                <td className="py-2.5 text-right font-semibold">{e.distance?.toFixed(2) ?? "-"}</td>
                <td className="py-2.5 text-right font-semibold">{speed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BirdHistoryModal({
  birdId,
  band,
  onClose,
}: {
  birdId: number;
  band: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [birdInfo, setBirdInfo] = useState<BirdInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { velocityUnit } = useSettings();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/birds/${birdId}/history`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setBirdInfo(d.birdInfo ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [birdId]);

  const raceEntries = entries.filter((e) => e.type === "ARRIVED" && e.raceTypeName !== "T");
  const trainingEntries = entries.filter((e) => e.type === "ARRIVED" && e.raceTypeName === "T");
  const banner = entries.find((e) => e.eventBanner)?.eventBanner ?? null;

  function raceStats(items: HistoryEntry[]) {
    if (!items.length) return null;
    const ranked = items.filter((e) => e.position != null);
    const avgRank = ranked.length
      ? Math.round(ranked.reduce((s, e) => s + e.position!, 0) / ranked.length)
      : null;
    const totalFlight = items.reduce((s, e) => s + (e.flightTimeMs ?? 0), 0);
    const totalDist = items.reduce((s, e) => s + (e.distance ?? 0), 0);
    const speeds = items.filter((e) => e.ypm != null).map((e) => e.ypm!);
    const avgSpeed = speeds.length ? speeds.reduce((s, v) => s + v, 0) / speeds.length : null;
    return { avgRank, totalFlight, totalDist, avgSpeed };
  }

  function trainingStats(items: HistoryEntry[]) {
    const long = items.filter((e) => (e.distance ?? 0) >= 10);
    if (!long.length) return null;
    const ranked = long.filter((e) => e.position != null);
    const avgPos = ranked.length
      ? Math.round(ranked.reduce((s, e) => s + e.position!, 0) / ranked.length)
      : null;
    const totalFlight = long.reduce((s, e) => s + (e.flightTimeMs ?? 0), 0);
    const totalDist = long.reduce((s, e) => s + (e.distance ?? 0), 0);
    const speeds = long.filter((e) => e.ypm != null).map((e) => e.ypm!);
    const avgSpeed = speeds.length ? speeds.reduce((s, v) => s + v, 0) / speeds.length : null;
    return { avgPos, totalFlight, totalDist, avgSpeed };
  }

  const rs = raceStats(raceEntries);
  const ts = trainingStats(trainingEntries);

  const displayBand = birdInfo?.band || band;
  const displayLoft = birdInfo?.loftName || "-";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 pr-12 border-b">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-blue-100 shrink-0 border-2 border-white shadow-md">
            {birdInfo?.loftImage ? (
              <Image src={birdInfo.loftImage} alt={displayLoft} width={56} height={56} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-sm text-blue-700">
                {displayLoft.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base leading-tight">{displayLoft}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
            <p className="text-sm text-muted-foreground">{birdInfo?.breederName || "-"}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm">{displayBand}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
              {birdInfo?.eligible && (
                <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs px-2 py-0 h-5">ELIGIBLE</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-blue-700 to-blue-900 relative overflow-hidden shrink-0">
          {banner && <Image src={banner} alt="Event banner" fill className="object-cover opacity-70" />}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div>
              {/* RACES section */}
              {raceEntries.length > 0 && (
                <div className="p-4 space-y-3 border-b">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">RACES (AVERAGE SPEED)</h3>
                  </div>
                  {rs && (
                    <div className="grid grid-cols-4 gap-3 py-2">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">RANK</p>
                        <p className="text-2xl font-bold">{rs.avgRank ?? "-"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">TOTAL FLIGHT TIME</p>
                        <p className="text-xs font-bold">{fmsFlight(rs.totalFlight)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">TOTAL DISTANCE (MI)</p>
                        <p className="text-2xl font-bold">{rs.totalDist.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">AVG SPEED ({velocityUnit})</p>
                        <p className="text-xl font-bold text-purple-600">
                          {rs.avgSpeed != null
                            ? velocityUnit === "MPM"
                              ? (rs.avgSpeed * 0.9144).toFixed(4)
                              : rs.avgSpeed.toFixed(4)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  <RaceHistoryTable entries={raceEntries} velocityUnit={velocityUnit} />
                </div>
              )}

              {/* TRAINING section */}
              {trainingEntries.length > 0 && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BirdIcon className="h-4 w-4 text-blue-500" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">TRAINING</h3>
                    <span className="text-xs text-muted-foreground">Summary includes 10+ mile training</span>
                  </div>
                  {ts && (
                    <div className="grid grid-cols-4 gap-3 py-2">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">AVG POSITION</p>
                        <p className="text-2xl font-bold">{ts.avgPos ?? "-"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">TOTAL FLIGHT TIME</p>
                        <p className="text-xs font-bold">{fmsFlight(ts.totalFlight)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">TOTAL DISTANCE (MI)</p>
                        <p className="text-2xl font-bold">{ts.totalDist.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">AVG SPEED ({velocityUnit})</p>
                        <p className="text-xl font-bold text-purple-600">
                          {ts.avgSpeed != null
                            ? velocityUnit === "MPM"
                              ? (ts.avgSpeed * 0.9144).toFixed(4)
                              : ts.avgSpeed.toFixed(4)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  <RaceHistoryTable entries={trainingEntries} velocityUnit={velocityUnit} />
                </div>
              )}

              {raceEntries.length === 0 && trainingEntries.length === 0 && (
                <p className="text-center text-muted-foreground py-12">No history found</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
