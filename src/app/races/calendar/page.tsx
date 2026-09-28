"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Printer,
} from "lucide-react";

interface CalendarEvent {
  id: number;
  title: string;
  start: string | null;
  status: string;
  category: string;
  categoryId: number | null;
  color: string | null;
  station: string | null;
  miles: number | null;
  eventName: string | null;
  seasonName: string | null;
  href: string;
}

interface Category {
  id: number | null;
  name: string;
  color: string | null;
}

type View = "grid" | "list";
type Span = "month" | "week" | "day";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-first weekday index, which is how the reference calendar reads. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function startOfSpan(date: Date, span: Span): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (span === "day") return d;
  if (span === "week") {
    d.setDate(d.getDate() - mondayIndex(d));
    return d;
  }
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfSpan(date: Date, span: Span): Date {
  const start = startOfSpan(date, span);
  const d = new Date(start);
  if (span === "day") d.setDate(d.getDate() + 1);
  else if (span === "week") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  d.setMilliseconds(-1);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** The cells a month grid needs: leading blanks, the month, trailing blanks. */
function monthCells(anchor: Date): Array<Date | null> {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const lead = mondayIndex(first);

  const cells: Array<Date | null> = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Race calendar.
 *
 * The reference calendar is decorative — an empty grid with a legend. This one
 * is driven by real races, so every marked day is a race that exists, and the
 * legend only offers categories actually present in the window.
 */
export default function RaceCalendarPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [span, setSpan] = useState<Span>("month");
  const [view, setView] = useState<View>("grid");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hidden, setHidden] = useState<Set<number | null>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = startOfSpan(anchor, span).toISOString();
      const to = endOfSpan(anchor, span).toISOString();
      const res = await fetch(`/api/public/calendar?from=${from}&to=${to}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(data.events ?? []);
      setCategories(data.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, [anchor, span]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => events.filter((e) => !hidden.has(e.categoryId)),
    [events, hidden]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of visible) {
      if (!e.start) continue;
      const key = new Date(e.start).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [visible]);

  const step = (direction: -1 | 1) => {
    const next = new Date(anchor);
    if (span === "day") next.setDate(next.getDate() + direction);
    else if (span === "week") next.setDate(next.getDate() + 7 * direction);
    else next.setMonth(next.getMonth() + direction);
    setAnchor(next);
  };

  const heading =
    span === "day"
      ? anchor.toLocaleDateString(undefined, { dateStyle: "full" })
      : span === "week"
        ? `Week of ${startOfSpan(anchor, "week").toLocaleDateString()}`
        : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const toggleCategory = (id: number | null) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const gridDays: Array<Date | null> =
    span === "month"
      ? monthCells(anchor)
      : span === "week"
        ? Array.from({ length: 7 }, (_, i) => {
            const d = startOfSpan(anchor, "week");
            d.setDate(d.getDate() + i);
            return d;
          })
        : [startOfSpan(anchor, "day")];

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6" />
          Race Calendar
        </h1>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Print
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-3 font-medium">{heading}</span>
            </div>

            <div className="flex items-center gap-1">
              {(["month", "week", "day"] as Span[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={span === s ? "default" : "outline"}
                  className="h-8 text-xs capitalize"
                  onClick={() => setSpan(s)}
                >
                  {s}
                </Button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              <Button
                size="sm"
                variant={view === "grid" ? "default" : "outline"}
                className="h-8"
                onClick={() => setView("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "default" : "outline"}
                className="h-8"
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : view === "list" ? (
            visible.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No races in this period.
              </p>
            ) : (
              <div className="divide-y">
                {visible.map((e) => (
                  <Link
                    key={e.id}
                    href={e.href}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 no-underline hover:bg-muted/40 px-2 -mx-2 rounded"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: e.color ?? "#94a3b8" }}
                      />
                      <span className="font-medium">{e.title}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {e.category}
                      </Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.start ? new Date(e.start).toLocaleString() : "unscheduled"}
                      {e.station ? ` · ${e.station}` : ""}
                      {e.miles ? ` · ${e.miles} mi` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )
          ) : (
            <div>
              {span !== "day" && (
                <div className="grid grid-cols-7 border-b">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {d}
                    </div>
                  ))}
                </div>
              )}

              <div className={span === "day" ? "" : "grid grid-cols-7"}>
                {gridDays.map((day, i) => {
                  const dayEvents = day ? (byDay.get(day.toDateString()) ?? []) : [];
                  const isToday = day ? sameDay(day, new Date()) : false;

                  return (
                    <div
                      key={i}
                      className={`min-h-24 border-b border-r p-1.5 ${
                        day ? "" : "bg-muted/30"
                      } ${isToday ? "ring-1 ring-inset ring-primary" : ""}`}
                    >
                      {day && (
                        <div className="text-xs text-muted-foreground mb-1">{day.getDate()}</div>
                      )}
                      <div className="space-y-1">
                        {dayEvents.map((e) => (
                          <Link
                            key={e.id}
                            href={e.href}
                            className="block rounded px-1.5 py-1 text-[11px] leading-tight no-underline hover:opacity-80"
                            style={{
                              background: (e.color ?? "#64748b") + "22",
                              borderLeft: `2px solid ${e.color ?? "#64748b"}`,
                            }}
                            title={`${e.title}${e.station ? ` · ${e.station}` : ""}`}
                          >
                            <span className="font-medium">{e.title}</span>
                            {e.start && (
                              <span className="block text-muted-foreground">
                                {new Date(e.start).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {categories.map((c) => {
                const off = hidden.has(c.id);
                return (
                  <button
                    key={String(c.id)}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className={`flex items-center gap-1.5 text-xs transition-opacity ${
                      off ? "opacity-40" : ""
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: c.color ?? "#94a3b8" }}
                    />
                    {c.name}
                  </button>
                );
              })}
              <span className="text-xs text-muted-foreground print:hidden">
                click to hide a category
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
