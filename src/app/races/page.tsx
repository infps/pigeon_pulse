"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

  const liveRaces = ((data?.races || []) as RaceWithEvent[]).filter((r) => r.event);
  const sortedLiveRaces = useMemo(() => sortRaces(liveRaces, raceSort), [liveRaces, raceSort]);

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
          <div className="ml-auto">
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
          </div>
        </div>
      </div>

      {isPending ? (
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
