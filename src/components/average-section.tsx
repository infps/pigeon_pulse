"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { shortBand, SEX_LABELS } from "@/lib/bird-constants";
import { BirdLink } from "@/components/bird-popup";
import { useListPublicAverages, usePublicAverageResults } from "@/lib/api/averages";
import type { AverageResultRow } from "@/lib/computeAverages";

export function AverageResultsTable({ rows }: { rows: AverageResultRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-xs uppercase text-muted-foreground">
            <th className="px-4 py-3 text-left w-12">Rank</th>
            <th className="px-4 py-3 text-left">Loft · Band · Sex · Color</th>
            <th className="px-4 py-3 text-right">Races</th>
            <th className="px-4 py-3 text-right">Avg Speed (YPM)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const isDNP = row.avgSpeedYPM === null;
            return (
              <tr
                key={row.birdId}
                className={`hover:bg-muted/30 transition-colors ${isDNP ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3">
                  {isDNP ? (
                    <span className="text-muted-foreground">—</span>
                  ) : row.rank === 1 ? (
                    <Trophy className="h-4 w-4 text-yellow-500" />
                  ) : row.rank === 2 ? (
                    <Trophy className="h-4 w-4 text-slate-400" />
                  ) : row.rank === 3 ? (
                    <Trophy className="h-4 w-4 text-amber-600" />
                  ) : (
                    <span className="font-medium tabular-nums">{row.rank}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.loft ?? row.breederName}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    <BirdLink birdId={row.birdId} band={row.band}>{shortBand(row.band)}</BirdLink>
                    {row.sex != null && (
                      <span className="ml-2">{SEX_LABELS[row.sex as keyof typeof SEX_LABELS]}</span>
                    )}
                    {row.color && <span className="ml-2">{row.color}</span>}
                  </p>
                  {isDNP && (
                    <span className="text-xs text-muted-foreground italic">Did Not Participate</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{row.racesFlown}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {row.avgSpeedYPM != null ? row.avgSpeedYPM.toFixed(4) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PublicAverageConfig {
  id: number;
  name: string;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-16 text-center text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

export function AverageSection({ eventId }: { eventId: number | string }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: configsData, isPending, error } = useListPublicAverages(eventId);
  const configs: PublicAverageConfig[] = configsData ?? [];
  const activeId = selectedId ?? configs[0]?.id ?? null;

  const { data: resultsData, isPending: resultsLoading } = usePublicAverageResults(eventId, activeId);

  const filtered = useMemo(() => {
    const rows: AverageResultRow[] = resultsData?.results ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.loft?.toLowerCase().includes(q) ||
        r.breederName?.toLowerCase().includes(q) ||
        r.band?.toLowerCase().includes(q)
    );
  }, [resultsData, search]);

  if (error && (error as Error).cause === 401) {
    return (
      <Empty>
        <p className="mb-3">Sign in to view averages.</p>
        <Button asChild size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </Empty>
    );
  }

  if (isPending) return <Skeleton className="h-40 w-full" />;

  if (configs.length === 0) return <Empty>No public averages yet</Empty>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {configs.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              activeId === c.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by loft or band…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <Card className="p-0">
        <CardContent className="p-0">
          {resultsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No results found.</div>
          ) : (
            <AverageResultsTable rows={filtered} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
