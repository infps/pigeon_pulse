"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Radio, ArrowLeft, List, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RacesMap, type MapRace } from "@/components/map";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListLiveRaces } from "@/lib/api/breeder";
import {
  LiveRaceCard,
  sortRaces,
  RACE_SORT_OPTIONS,
  type RaceWithEvent,
  type RaceSortKey,
} from "@/components/live-race-card";

export default function RacesPage() {
  const router = useRouter();
  const { data, isPending } = useListLiveRaces();
  const [raceSort, setRaceSort] = useState<RaceSortKey>("recentlyCreated");
  const [view, setView] = useState<"list" | "map">("list");

  const liveRaces = ((data?.races || []) as RaceWithEvent[]).filter((r) => r.event);
  const sortedLiveRaces = useMemo(() => sortRaces(liveRaces, raceSort), [liveRaces, raceSort]);

  const { data: mapData, isPending: mapPending } = useQuery<{ races: MapRace[] }>({
    queryKey: ["breeder", "races", "live-map"],
    queryFn: async () => {
      const res = await fetch("/api/breeder/races/live-map");
      if (!res.ok) throw new Error("Failed to load map");
      return res.json();
    },
    enabled: view === "map",
    refetchInterval: view === "map" ? 30000 : false,
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Button variant="ghost" onClick={() => router.push("/")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-red-500 animate-pulse" />
          <h1 className="text-2xl font-bold">Live Races</h1>
          {!isPending && (
            <Badge variant="destructive" className="text-xs">{liveRaces.length}</Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <Button
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded-none gap-1"
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5" />
                List
              </Button>
              <Button
                variant={view === "map" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded-none gap-1"
                onClick={() => setView("map")}
              >
                <MapIcon className="h-3.5 w-3.5" />
                Map
              </Button>
            </div>
            {view === "list" && (
              <Select value={raceSort} onValueChange={(v) => setRaceSort(v as RaceSortKey)}>
                <SelectTrigger className="h-8 w-42.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RACE_SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {view === "map" ? (
        mapPending ? (
          <Skeleton className="h-130 w-full" />
        ) : (mapData?.races?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-md">
            <MapIcon className="h-12 w-12 mb-3" />
            <p>No races to map right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 bg-red-600" /> Live route
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-dashed border-slate-400" /> Upcoming
              </span>
            </div>
            <RacesMap races={mapData?.races ?? []} />
          </div>
        )
      ) : isPending ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : liveRaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Radio className="h-12 w-12 mb-3" />
          <p>No live races right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedLiveRaces.map((race) => (
            <LiveRaceCard key={race.id} race={race} />
          ))}
        </div>
      )}
    </div>
  );
}
