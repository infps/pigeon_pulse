"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search } from "lucide-react";
import { StationsMap } from "@/components/map";
import type { Event } from "@/lib/types";

interface Station {
  id: number;
  name: string;
  miles: number | null;
  km: number | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
}

export function EventStationsTab({ eventId, event }: { eventId: string; event?: Event }) {
  const { data, isPending, isError } = useQuery<{ stations: Station[] }>({
    queryKey: ["breeder", "stations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/breeder/event/${eventId}/stations`);
      if (!res.ok) throw new Error("Failed to load stations");
      return res.json();
    },
  });

  const [search, setSearch] = useState("");
  const stations = data?.stations ?? [];

  const base =
    event?.latitude != null && event?.longitude != null
      ? { lat: event.latitude, lng: event.longitude, name: event.name ?? "Event" }
      : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stations.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [stations, search]);

  if (isPending) {
    return <Skeleton className="h-115 w-full" />;
  }
  if (isError) {
    return <p className="text-red-500 text-center py-8">Failed to load stations.</p>;
  }
  if (stations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-md">
        <MapPin className="h-12 w-12 mb-3" />
        <p>No release stations listed for this event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Release Station Map</h2>
        <p className="text-sm text-muted-foreground">{stations.length} stations available</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* List */}
        <div className="border rounded-md flex flex-col max-h-140">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search stations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 px-3 py-3 border-b">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{s.name}</span>
                    {s.isActive && <Badge variant="default">active</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {s.miles != null ? `${s.miles.toFixed(2)} MI` : "— MI"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 text-xs text-muted-foreground border-t">
            Showing {filtered.length} of {stations.length} stations
          </div>
        </div>

        {/* Map */}
        <div className="border rounded-md overflow-hidden">
          <StationsMap base={base} stations={filtered} height={560} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        GPS coordinates are informational. Contact handler to verify actual release point.
      </p>
    </div>
  );
}
