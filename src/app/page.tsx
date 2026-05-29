"use client";

import { useMemo } from "react";
import { useSettings } from "@/lib/settings-context";
import { useListBreederEvents, useListLiveRaces } from "@/lib/api/breeder";
import { useListBreederMessages } from "@/lib/api/event-messages";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import Link from "next/link";
import { Radio, MapPin, Clock, Newspaper } from "lucide-react";
import type { Event, Race } from "@/lib/types";

interface EventWithRaces extends Event {
  races: Race[];
  _count: {
    races: number;
  };
}

interface RaceWithEvent {
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

function LiveRaceCard({ race }: { race: RaceWithEvent }) {
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

const snippet = (b: string, n = 150) => (b.length > n ? b.slice(0, n).trimEnd() + "…" : b);

interface NewsMessage {
  id: number;
  eventId: number;
  title: string | null;
  body: string;
  mediaUrls: string[];
  createdAt: string;
  event: {
    id: number;
    name: string;
    shortName: string | null;
    logoImage: string | null;
    bannerImage: string | null;
  };
}

export default function Home() {
  const { data: eventsData, isPending: eventsLoading } = useListBreederEvents();
  const { data: liveRacesData, isPending: liveRacesLoading } = useListLiveRaces();
  const { data: newsData, isPending: newsLoading } = useListBreederMessages({ limit: 10 });

  const events = (eventsData?.events || []) as EventWithRaces[];
  const liveRaces = ((liveRacesData?.races || []) as RaceWithEvent[]).filter((r) => r.event);

  const sortedEvents = useMemo(() => {
    const arr = [...events];
    const ts = (d: string | Date | null | undefined) => (d ? new Date(d).getTime() : 0);
    const liveEventIds = new Set(liveRaces.map((r) => r.event.id));
    arr.sort((a, b) => ts(b.eventDate) - ts(a.eventDate));
    arr.sort((a, b) => Number(liveEventIds.has(b.id)) - Number(liveEventIds.has(a.id)));
    return arr;
  }, [events, liveRaces]);


  if (eventsLoading || liveRacesLoading) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const newsMessages: NewsMessage[] = newsData?.messages ?? [];
  const newsTotal: number = newsData?.total ?? 0;

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Featured Events — infinite marquee */}
      {sortedEvents.length > 0 && (
        <section>
          <style>{`
            @keyframes marquee-scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .marquee-track {
              display: flex;
              animation: marquee-scroll ${Math.max(20, sortedEvents.length * 3)}s linear infinite;
              width: max-content;
            }
            .marquee-track:hover {
              animation-play-state: paused;
            }
          `}</style>
          <h2 className="text-xl font-bold mb-4">Featured Events</h2>
          <div className="overflow-x-clip relative pt-14 pb-1">
            <div className="marquee-track">
              {[...sortedEvents, ...sortedEvents].map((event, i) => {
                const liveCount = liveRaces.filter((r) => r.event.id === event.id).length;
                return (
                  <Link
                    key={`${event.id}-${i}`}
                    href={`/events/${event.id}`}
                    className="relative group flex flex-col items-center mx-5 shrink-0"
                  >
                    <div className={`relative w-16 h-16 rounded-full overflow-hidden border-2 ${liveCount > 0 ? "border-red-500" : "border-border"} bg-white`}>
                      {event.logoImage ? (
                        <Image src={event.logoImage} alt={event.name ?? ""} fill className="object-contain p-1" />
                      ) : (
                        <div className="w-full h-full bg-linear-to-br from-indigo-500 via-purple-500 to-fuchsia-500 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">
                            {(event.shortName ?? event.name ?? "?").substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {liveCount > 0 && (
                        <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-500 animate-pulse border-2 border-background" />
                      )}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      <p className="font-semibold">{event.name}</p>
                      <p className="text-muted-foreground">{event._count?.races ?? 0} Races</p>
                      {liveCount > 0 && <p className="text-red-500 font-medium">{liveCount} Live</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Live Races + News 2-column */}
      {(liveRaces.length > 0 || newsLoading || newsMessages.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Races (left) */}
          {liveRaces.length > 0 && (
            <section className="min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                <h2 className="text-xl font-bold">Live Races</h2>
                <Badge variant="destructive" className="text-xs">{liveRaces.length}</Badge>
              </div>
              <div className="space-y-4">
                {liveRaces.slice(0, 20).map((race) => (
                  <LiveRaceCard key={race.id} race={race} />
                ))}
              </div>
            </section>
          )}

          {/* News & Updates (right) */}
          {newsLoading ? (
            <section className="min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <Newspaper className="h-5 w-5" />
                <h2 className="text-xl font-bold">News & Updates</h2>
              </div>
              <div className="rounded-md border divide-y">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-none" />
                ))}
              </div>
            </section>
          ) : newsMessages.length > 0 ? (
            <section className="min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <Newspaper className="h-5 w-5" />
                <h2 className="text-xl font-bold">News & Updates</h2>
                <Badge variant="secondary" className="text-xs">{newsTotal}</Badge>
                {newsTotal > 10 && (
                  <Link href="/news" className="ml-auto text-sm text-purple-600 hover:underline">
                    View All →
                  </Link>
                )}
              </div>
              <div className="rounded-md border divide-y">
                {newsMessages.map((m) => (
                  <Link
                    key={m.id}
                    href={`/events/${m.event.id}?tab=messages`}
                    className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
                  >
                    {m.event.logoImage ? (
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border bg-white shrink-0">
                        <Image src={m.event.logoImage} alt={m.event.name} fill className="object-contain p-1" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-xs">
                          {m.event.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {new Date(m.createdAt).toLocaleDateString()} — {m.event.name}
                        {m.title && <span className="text-muted-foreground"> · {m.title}</span>}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {snippet(m.body, 150)}
                      </p>
                      <span className="text-xs text-purple-600 mt-1 inline-block">Read More →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {/* Events Table */}
      {/* <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">Events</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "open" | "closed")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            {eventTypes.length > 0 && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {eventTypes.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#7c3aed] text-white">
                <th className="text-left px-4 py-3 font-medium">Event Name</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Event Date</th>
                <th className="text-left px-4 py-3 font-medium">End Date</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Fee Scheme</th>
                <th className="text-left px-4 py-3 font-medium">Betting Scheme</th>
                <th className="text-left px-4 py-3 font-medium">Final Prize</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, i) => {
                const liveCount = liveRaces.filter((r) => r.event.id === event.id).length;
                return (
                  <tr
                    key={event.id}
                    className={`border-t hover:bg-muted/50 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                    onClick={() => (window.location.href = `/events/${event.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium flex items-center gap-2">
                          {event.name}
                          {liveCount > 0 && (
                            <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0">
                              <Radio className="h-2.5 w-2.5 animate-pulse" />
                              {liveCount} Live
                            </Badge>
                          )}
                        </span>
                        {event.shortName && (
                          <span className="text-xs text-muted-foreground">{event.shortName}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.eventType?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.endDate ? new Date(event.endDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={event.isOpen === 1 ? "default" : "secondary"}>
                        {event.isOpen === 1 ? "Open" : "Closed"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.feeScheme?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.bettingScheme?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.finalPrize?.name ?? "-"}
                    </td>
                  </tr>
                );
              })}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No events match filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section> */}
    </div>
  );
}
