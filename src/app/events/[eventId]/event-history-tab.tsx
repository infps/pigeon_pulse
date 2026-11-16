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
import { RaceCalendar, type CalendarRace } from "@/components/race-calendar";

interface HistoryRace {
  id: number;
  raceNumber: number | null;
  name: string | null;
  description: string | null;
  location: string | null;
  startTime: string | null;
  distance: number | null;
  season: string | null;
  status: string | null;
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

  // Same grouping as the app's Trainings and Races page: live, upcoming, then results by day.
  const sections = useMemo(() => {
    const races = data?.races ?? [];
    const t = (r: HistoryRace) => (r.startTime ? new Date(r.startTime).getTime() : 0);
    const live = races.filter((r) => r.status === "STARTED").sort((a, b) => t(a) - t(b));
    const upcoming = races
      .filter((r) => r.status !== "STARTED" && r.status !== "ENDED")
      .sort((a, b) => (t(a) || Infinity) - (t(b) || Infinity));
    const byDay = new Map<string, HistoryRace[]>();
    for (const r of races.filter((r) => r.status === "ENDED").sort((a, b) => t(b) - t(a))) {
      const day = r.startTime ? new Date(r.startTime).toLocaleDateString(undefined, { dateStyle: "full" }) : "Date not set";
      byDay.set(day, [...(byDay.get(day) ?? []), r]);
    }
    return { live, upcoming, byDay: [...byDay.entries()] };
  }, [data]);

  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (isError) return <p className="text-red-500 text-center py-8">Failed to load history.</p>;
  if (!data?.races.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-md">
        <History className="h-12 w-12 mb-3" />
        <p>No races recorded yet for this event.</p>
      </div>
    );
  }

  const calendarRaces: CalendarRace[] = (data?.races ?? []).map((r) => ({
    id: r.id,
    raceNumber: r.raceNumber,
    name: r.name,
    description: r.description,
    startTime: r.startTime,
    distance: r.distance,
    status: r.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-center mb-2">Race Calendar</h2>
        <RaceCalendar races={calendarRaces} />
      </div>

      {sections.live.length > 0 && (
        <Section title="Flying now">
          <RaceTable races={sections.live} />
        </Section>
      )}
      {sections.upcoming.length > 0 && (
        <Section title="Coming up">
          <RaceTable races={sections.upcoming} />
        </Section>
      )}
      {sections.byDay.length > 0 && (
        <Section title="Results">
          {sections.byDay.map(([day, races]) => (
            <div key={day} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{day}</h3>
              <RaceTable races={races} />
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function RaceTable({ races }: { races: HistoryRace[] }) {
  return (
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
          {races.map((r, i) => (
            <TableRow key={r.id}>
              <TableCell>{i + 1}</TableCell>
              <TableCell className="font-medium">{r.description || r.name || `Race ${r.raceNumber ?? r.id}`}</TableCell>
              <TableCell className="font-mono text-xs">{formatLiberation(r.startTime)}</TableCell>
              <TableCell>{deriveSeason(r)}</TableCell>
              <TableCell>{r.location ?? "-"}</TableCell>
              <TableCell className="text-right">{r.distance ?? "-"}</TableCell>
              <TableCell>{r.raceType?.name ?? "-"}</TableCell>
              <TableCell>
                <Link href={`/races/${r.id}`} className="text-blue-600 hover:underline">
                  Results
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
