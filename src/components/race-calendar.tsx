"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface CalendarRace {
  id: number;
  name?: string | null;
  description?: string | null;
  startTime: string | null;
  distance?: number | null;
  status?: string | null;
  eventName?: string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function raceLabel(r: CalendarRace): string {
  return r.description || r.name || "Race";
}

export function RaceCalendar({
  races,
  showEventName = false,
}: {
  races: CalendarRace[];
  showEventName?: boolean;
}) {
  // Index races by local day; pick initial month from latest race (or now via a dated race).
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarRace[]>();
    for (const r of races) {
      if (!r.startTime) continue;
      const k = dayKey(new Date(r.startTime));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [races]);

  // Anchor month: latest race date, else first race date. Avoids Date.now() reliance.
  const anchor = useMemo(() => {
    const dated = races
      .map((r) => (r.startTime ? new Date(r.startTime) : null))
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime());
    return dated[0] ?? new Date();
  }, [races]);

  const [month, setMonth] = useState<Date>(() => startOfMonth(anchor));
  const [selected, setSelected] = useState<string | null>(() =>
    races.length ? dayKey(anchor) : null,
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedRaces = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      {/* Calendar grid */}
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {format(month, "MMMM yyyy")}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            const inMonth = isSameMonth(d, month);
            const isSel = selected === k;
            const hasRaces = list.length > 0;
            const live = list.some((r) => r.status === "STARTED");
            return (
              <button
                key={k}
                type="button"
                onClick={() => hasRaces && setSelected(k)}
                disabled={!hasRaces}
                className={[
                  "relative aspect-square rounded-md text-sm flex flex-col items-center justify-center transition-colors",
                  inMonth ? "" : "text-muted-foreground/40",
                  hasRaces ? "hover:bg-muted cursor-pointer" : "cursor-default",
                  isSel ? "bg-blue-600 text-white hover:bg-blue-600" : "",
                  !isSel && isToday(d) ? "ring-1 ring-blue-400" : "",
                ].join(" ")}
              >
                <span>{format(d, "d")}</span>
                {hasRaces && (
                  <span
                    className={[
                      "mt-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold",
                      isSel
                        ? "bg-white text-blue-600"
                        : live
                          ? "bg-red-500 text-white"
                          : "bg-blue-100 text-blue-700",
                    ].join(" ")}
                  >
                    {list.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected-day races */}
      <div className="rounded-md border p-3">
        <h3 className="font-semibold text-sm mb-3">
          {selected
            ? format(new Date(selected + "T00:00:00"), "EEEE, MMM d, yyyy")
            : "Select a day"}
        </h3>
        {selectedRaces.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No races on this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedRaces.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/races/${r.id}`}
                  className="block rounded-md border p-2.5 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {raceLabel(r)}
                    </span>
                    {r.status === "STARTED" && (
                      <Badge className="bg-red-600 text-white text-[10px] gap-1 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        LIVE
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {r.startTime && (
                      <span>{format(new Date(r.startTime), "HH:mm")}</span>
                    )}
                    {r.distance != null && (
                      <span className="flex items-center gap-0.5">
                        <Trophy className="h-3 w-3" />
                        {r.distance} mi
                      </span>
                    )}
                    {showEventName && r.eventName && (
                      <span className="truncate">{r.eventName}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
