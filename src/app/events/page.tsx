"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useListBreederEvents } from "@/lib/api/breeder";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Radio } from "lucide-react";
import type { Event } from "@/lib/types";

interface EventWithRaces extends Event {
  _count?: { seasons: number };
}

export default function EventsPage() {
  const { data, isPending } = useListBreederEvents();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");

  const events = (data?.events ?? []) as EventWithRaces[];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter((e) => {
      if (statusFilter === "open" && e.isOpen !== 1) return false;
      if (statusFilter === "closed" && e.isOpen === 1) return false;
      if (q) {
        return (
          e.name?.toLowerCase().includes(q) ||
          e.shortName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, search, statusFilter]);

  if (isPending) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold flex-1">Events</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-52"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-20 text-center text-muted-foreground">
          {search || statusFilter !== "all" ? "No events match your filters." : "No events available."}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#7c3aed] text-white">
                <th className="text-left px-4 py-3 font-medium">Event</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Races</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event, i) => {
                const liveCount = (event.races ?? []).filter((r) => !r.isClosed).length;
                return (
                  <tr
                    key={event.id}
                    className={`border-t hover:bg-muted/50 cursor-pointer transition-colors ${i % 2 !== 0 ? "bg-muted/20" : ""}`}
                    onClick={() => (window.location.href = `/events/${event.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {event.logoImage ? (
                          <div className="relative w-8 h-8 rounded-full overflow-hidden border bg-white shrink-0">
                            <Image src={event.logoImage} alt={event.name ?? ""} fill className="object-contain p-0.5" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                            <span className="text-white font-bold text-xs">
                              {(event.shortName ?? event.name ?? "?").substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {event.name}
                            {liveCount > 0 && (
                              <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0">
                                <Radio className="h-2.5 w-2.5 animate-pulse" />
                                {liveCount} Live
                              </Badge>
                            )}
                          </div>
                          {event.shortName && (
                            <div className="text-xs text-muted-foreground">{event.shortName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(event.races?.length ?? 0) > 0 ? event.races!.length : (event._count?.seasons ?? "—")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={event.isOpen === 1 ? "default" : "secondary"}>
                        {event.isOpen === 1 ? "Open" : "Closed"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
