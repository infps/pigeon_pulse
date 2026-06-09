"use client";

import { useSettings } from "@/lib/settings-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock } from "lucide-react";

export interface RaceWithEvent {
  id: number;
  name: string;
  location: string | null;
  startTime: string;
  distance: number | null;
  isClosed: number;
  arrivedCount: number;
  event: {
    id: number;
    name: string;
    shortName: string | null;
    logoImage: string | null;
    isOpen: number;
  };
  raceType: {
    id: number;
    name: string;
  } | null;
  _count: {
    raceItems: number;
  };
}

export type RaceSortKey = "recentlyCreated" | "longestRunning" | "mostBirds" | "longestDistance";

export const RACE_SORT_OPTIONS: { value: RaceSortKey; label: string }[] = [
  { value: "recentlyCreated", label: "Recently Created" },
  { value: "longestRunning", label: "Longest Running" },
  { value: "mostBirds", label: "Most Birds" },
  { value: "longestDistance", label: "Longest Distance" },
];

export function sortRaces(races: RaceWithEvent[], key: RaceSortKey): RaceWithEvent[] {
  const arr = [...races];
  const ts = (d: string) => new Date(d).getTime();
  switch (key) {
    case "recentlyCreated":
      arr.sort((a, b) => b.id - a.id); // id autoincrement → newest first
      break;
    case "mostBirds":
      arr.sort((a, b) => (b._count.raceItems ?? 0) - (a._count.raceItems ?? 0));
      break;
    case "longestDistance":
      arr.sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0));
      break;
    case "longestRunning":
    default:
      // oldest-started first = running longest = closing soonest
      arr.sort((a, b) => ts(a.startTime) - ts(b.startTime));
      break;
  }
  return arr;
}

function formatElapsed(startTime: string): string {
  const elapsed = Date.now() - new Date(startTime).getTime();
  if (elapsed < 0) return "+00:00:00";
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  return `+${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDistance(dist: number | null): string {
  if (!dist) return "—";
  return `${(dist / 1000).toFixed(2)} MI`;
}

function calcVelocity(dist: number | null, startTime: string, unit: "YPM" | "MPM"): string {
  if (!dist) return "—";
  const elapsedMin = (Date.now() - new Date(startTime).getTime()) / 60000;
  if (elapsedMin <= 0) return "—";
  if (unit === "MPM") {
    return `${(dist / elapsedMin).toFixed(2)} MPM`;
  }
  const yards = dist * 1.09361;
  return `${(yards / elapsedMin).toFixed(2)} YPM`;
}

export function LiveRaceCard({ race }: { race: RaceWithEvent }) {
  const { velocityUnit } = useSettings();
  const total = race._count.raceItems ?? 0;
  const arrived = race.arrivedCount ?? 0;
  const progress = total > 0 ? (arrived / total) * 100 : 0;
  const elapsed = formatElapsed(race.startTime);

  return (
    <Link href={`/races/${race.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border border-border p-0">
        <CardContent className="p-0">
          <div className="flex items-center gap-4 px-4 pt-4 pb-3">
            {race.event.logoImage ? (
              <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-red-500 shrink-0">
                <Image src={race.event.logoImage} alt={race.event.name} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-linear-to-br from-amber-600 to-amber-800 flex items-center justify-center shrink-0 border-2 border-red-500">
                <span className="text-white font-bold text-lg">
                  {race.event.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight truncate">{race.event.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground truncate">{race.name}</span>
                {race.raceType && (
                  <Badge variant="outline" className="text-xs shrink-0 px-1.5 py-0">
                    {race.raceType.name}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {race.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {race.location}
                  </span>
                )}
                <span className="flex items-center gap-1 text-red-500 font-medium">
                  <Clock className="h-3 w-3" />
                  {elapsed}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-5 shrink-0">
              <div className="text-center">
                <p className="text-sm font-bold">{formatDistance(race.distance)}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Distance</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold">{calcVelocity(race.distance, race.startTime, velocityUnit)}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Race Velocity</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold">{arrived}/{total}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Returned</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-red-500">In Progress</span>
              </div>
            </div>
          </div>

          <div className="h-1 w-full bg-muted">
            <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
