"use client";

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
import { MapPin } from "lucide-react";

interface Station {
  id: number;
  name: string;
  miles: number | null;
  km: number | null;
  latitude: number | null;
  longitude: number | null;
}

export function EventStationsTab({ eventId }: { eventId: string }) {
  const { data, isPending, isError } = useQuery<{ stations: Station[] }>({
    queryKey: ["breeder", "stations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/breeder/event/${eventId}/stations`);
      if (!res.ok) throw new Error("Failed to load stations");
      return res.json();
    },
  });

  const stations = data?.stations ?? [];

  if (isPending) {
    return <Skeleton className="h-64 w-full" />;
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Station Name</TableHead>
              <TableHead className="text-right">Miles</TableHead>
              <TableHead className="text-right">Kilometers</TableHead>
              <TableHead>Latitude</TableHead>
              <TableHead>Longitude</TableHead>
              <TableHead className="w-32">Map</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stations.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right">{s.miles ?? "-"}</TableCell>
                <TableCell className="text-right">{s.km ?? "-"}</TableCell>
                <TableCell>{s.latitude ?? "-"}</TableCell>
                <TableCell>{s.longitude ?? "-"}</TableCell>
                <TableCell>
                  {s.latitude != null && s.longitude != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <MapPin className="h-4 w-4" /> Open
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        GPS coordinates are informational. Contact handler to verify actual release point.
      </p>
    </div>
  );
}
