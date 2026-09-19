"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, MapPin } from "lucide-react";

interface Station {
  id: number;
  name: string;
  miles: number | null;
  km: number | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  raceTypes: string[];
  mapUrl: string | null;
  recentRaces: Array<{ id: number; name: string; startTime: string | null; status: string }>;
}

/**
 * Liberation points, shortest first.
 *
 * The coordinate caveat is carried through from the source data rather than
 * being dropped: a breeder reading a latitude off a screen should know the
 * handler confirms the actual release point.
 */
export default function EventStationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [stations, setStations] = useState<Station[]>([]);
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/event/${eventId}/stations`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setStations(data.stations ?? []);
        setSeasonName(data.season?.name ?? null);
        setNote(data.note ?? null);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          Race Stations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {stations.length} liberation point{stations.length === 1 ? "" : "s"}
          {seasonName ? ` · ${seasonName}` : ""}
        </p>
      </div>

      {stations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">No stations have been set up for this season.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3">Station</th>
                    <th className="text-right py-2 px-3">Miles</th>
                    <th className="text-right py-2 px-3">Kilometres</th>
                    <th className="text-left py-2 px-3">Latitude</th>
                    <th className="text-left py-2 px-3">Longitude</th>
                    <th className="text-left py-2 px-3">Map</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {stations.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={s.isActive ? "" : "text-muted-foreground"}>
                            {s.name}
                          </span>
                          {!s.isActive && (
                            <Badge variant="outline" className="text-[10px]">
                              retired
                            </Badge>
                          )}
                          {s.recentRaces.length > 0 && (
                            <Link
                              href={`/races/${s.recentRaces[0].id}`}
                              className="text-xs text-primary hover:underline"
                            >
                              latest race
                            </Link>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">{s.miles ?? "—"}</td>
                      <td className="py-2 px-3 text-right">
                        {s.km != null ? s.km.toFixed(3) : "—"}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs">{s.latitude ?? "—"}</td>
                      <td className="py-2 px-3 font-mono text-xs">{s.longitude ?? "—"}</td>
                      <td className="py-2 px-3">
                        {s.mapUrl ? (
                          <a
                            href={s.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {note && <p className="mt-4 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
