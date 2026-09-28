"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, MapPin } from "lucide-react";

interface ArchivedRace {
  id: number;
  name: string;
  liberation: string | null;
  station: string | null;
  miles: number | null;
  raceType: string | null;
  prizeRole: string;
  status: string;
  birdCount: number;
}

interface ArchivedSeason {
  seasonId: number;
  seasonName: string;
  races: ArchivedRace[];
}

const ALL = "all";

/**
 * Race history, grouped by season.
 *
 * WinCompanion groups theirs by year label; seasons are our equivalent, so the
 * grouping follows the season a race belongs to and the picker narrows to one.
 */
export default function RaceArchivePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [seasons, setSeasons] = useState<ArchivedSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonFilter, setSeasonFilter] = useState<string>(ALL);

  useEffect(() => {
    fetch(`/api/public/event/${eventId}/archive`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setSeasons(data.seasons ?? []);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const shown = useMemo(
    () =>
      seasonFilter === ALL
        ? seasons
        : seasons.filter((s) => String(s.seasonId) === seasonFilter),
    [seasons, seasonFilter]
  );

  const totalRaces = seasons.reduce((sum, s) => sum + s.races.length, 0);

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Race History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalRaces} race{totalRaces === 1 ? "" : "s"} across {seasons.length} season
            {seasons.length === 1 ? "" : "s"}
          </p>
        </div>

        {seasons.length > 1 && (
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All seasons</SelectItem>
              {seasons.map((s) => (
                <SelectItem key={s.seasonId} value={String(s.seasonId)}>
                  {s.seasonName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <History className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">No races have been flown yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {shown.map((season) => (
            <Card key={season.seasonId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {season.seasonName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {season.races.length} race{season.races.length === 1 ? "" : "s"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-1.5 pr-3">#</th>
                        <th className="text-left py-1.5 pr-3">Race</th>
                        <th className="text-left py-1.5 pr-3">Liberation</th>
                        <th className="text-left py-1.5 pr-3">Station</th>
                        <th className="text-right py-1.5 pr-3">Miles</th>
                        <th className="text-right py-1.5 pr-3">Birds</th>
                        <th className="text-left py-1.5">Results</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {season.races.map((race, i) => (
                        <tr key={race.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                          <td className="py-1.5 pr-3">
                            <span className="flex flex-wrap items-center gap-1.5">
                              {race.name}
                              {race.prizeRole !== "NONE" && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {race.prizeRole.replace("_", " ").toLowerCase()}
                                </Badge>
                              )}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">
                            {race.liberation
                              ? new Date(race.liberation).toLocaleString()
                              : "—"}
                          </td>
                          <td className="py-1.5 pr-3">
                            {race.station ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {race.station}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-right">{race.miles ?? "—"}</td>
                          <td className="py-1.5 pr-3 text-right">{race.birdCount}</td>
                          <td className="py-1.5">
                            <Link
                              href={`/races/${race.id}`}
                              className="text-primary hover:underline"
                            >
                              Results
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
