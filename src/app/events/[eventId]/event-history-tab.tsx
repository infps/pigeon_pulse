"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History } from "lucide-react";

interface HistoryRace {
  id: number;
  name: string | null;
  description: string | null;
  location: string | null;
  startTime: string | null;
  distance: number | null;
  season: string | null;
  raceType: { id: number; name: string | null } | null;
}

function formatLiberation(d: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function deriveSeason(r: HistoryRace): string {
  if (r.season && r.season.trim()) return r.season.trim();
  if (r.startTime) {
    const y = new Date(r.startTime).getFullYear();
    return `YB${String(y).slice(2)}`;
  }
  return "Unknown";
}

export function EventHistoryTab({ eventId }: { eventId: string }) {
  const { data, isPending, isError } = useQuery<{ races: HistoryRace[] }>({
    queryKey: ["breeder", "event-history", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/breeder/event/${eventId}/history`);
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  const grouped = useMemo(() => {
    const races = data?.races ?? [];
    const map = new Map<string, HistoryRace[]>();
    for (const r of races) {
      const key = deriveSeason(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Sort each group by startTime asc, keep insertion order of seasons
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
        const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
        return ta - tb;
      });
    }
    return Array.from(map.entries());
  }, [data]);

  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (isError) return <p className="text-red-500 text-center py-8">Failed to load history.</p>;
  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-md">
        <History className="h-12 w-12 mb-3" />
        <p>No races recorded yet for this event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold text-center mb-2">List Archived Races</h2>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Cnt</TableHead>
              <TableHead>Report Name</TableHead>
              <TableHead>Liberation</TableHead>
              <TableHead>Season</TableHead>
              <TableHead>Station Name</TableHead>
              <TableHead className="text-right">Distance</TableHead>
              <TableHead>Race</TableHead>
              <TableHead className="w-24">Results</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map(([season, races]) => (
              <RaceGroup key={season} season={season} races={races} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RaceGroup({ season, races }: { season: string; races: HistoryRace[] }) {
  return (
    <>
      <TableRow className="bg-muted/60 hover:bg-muted/60">
        <TableCell colSpan={8} className="font-bold">
          Year: {season}
        </TableCell>
      </TableRow>
      {races.map((r, i) => (
        <TableRow key={r.id}>
          <TableCell>{i + 1}</TableCell>
          <TableCell className="font-medium">{r.description ?? r.name ?? "-"}</TableCell>
          <TableCell className="font-mono text-xs">{formatLiberation(r.startTime)}</TableCell>
          <TableCell>{deriveSeason(r)}</TableCell>
          <TableCell>{r.location ?? "-"}</TableCell>
          <TableCell className="text-right">{r.distance ?? "-"}</TableCell>
          <TableCell>{r.raceType?.name ?? "-"}</TableCell>
          <TableCell>
            <Link
              href={`/races/${r.id}`}
              className="text-blue-600 hover:underline"
            >
              Results
            </Link>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
