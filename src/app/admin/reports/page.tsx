"use client";

import { useMemo, useState } from "react";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { useListRaces } from "@/lib/api/races";
import { Button } from "@/components/ui/button";
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
import { FileDown, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { toast } from "sonner";

interface ReportInfo {
  key: string;
  title: string;
  description: string;
  scope: "race" | "season" | "scheme" | "global";
  requires: "seasonId" | "raceId" | null;
  legacyTemplate: string;
  isLabelSheet: boolean;
}

interface SeasonOption {
  id: number;
  name: string;
  event?: { name?: string | null } | null;
}

const SCOPE_LABEL: Record<ReportInfo["scope"], string> = {
  race: "Per race",
  season: "Per season",
  scheme: "Scheme",
  global: "All breeders",
};

export default function ReportsPage() {
  const [seasonId, setSeasonId] = useState<string>("");
  const [raceId, setRaceId] = useState<string>("");

  const { data: catalogue, isPending: catalogueLoading } = useApiQuery({
    endpoint: apiEndpoints.reports.base,
    queryKey: ["reports", "catalogue"],
  });

  const { data: seasonsData, isPending: seasonsLoading } = useApiQuery({
    endpoint: "/api/admin/seasons",
    queryKey: ["seasons", "list", "reports"],
  });

  const { data: racesData } = useListRaces({
    params: seasonId ? { seasonId } : undefined,
  });

  const reports: ReportInfo[] = useMemo(() => catalogue?.reports ?? [], [catalogue]);
  const seasons: SeasonOption[] = useMemo(() => seasonsData?.seasons ?? [], [seasonsData]);
  const races = useMemo(
    () =>
      (racesData?.races ?? []) as Array<{
        id: number;
        name?: string | null;
        raceNumber?: number | null;
        raceType?: { name?: string | null } | null;
      }>,
    [racesData]
  );

  const missingFor = (report: ReportInfo): string | null => {
    if (report.requires === "seasonId" && !seasonId) return "Choose a season first";
    if (report.requires === "raceId" && !raceId) return "Choose a race first";
    return null;
  };

  const open = (report: ReportInfo, format: "csv" | "xlsx" | "pdf" | "html") => {
    const blocked = missingFor(report);
    if (blocked) {
      toast.error(blocked);
      return;
    }
    const url = apiEndpoints.reports.download(report.key, format, {
      seasonId: seasonId || undefined,
      raceId: raceId || undefined,
    });
    window.open(url, "_blank", "noopener");
  };

  if (catalogueLoading || seasonsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Printable reports carried over from HayLoft. Pick a season — and a race for race-scoped
          reports — then download in the format you need.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scope</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Season
            </label>
            <Select
              value={seasonId}
              onValueChange={(v) => {
                setSeasonId(v);
                setRaceId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a season" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.event?.name ? `${s.event.name} — ${s.name}` : s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Race
            </label>
            <Select value={raceId} onValueChange={setRaceId} disabled={!seasonId}>
              <SelectTrigger>
                <SelectValue placeholder={seasonId ? "Select a race" : "Select a season first"} />
              </SelectTrigger>
              <SelectContent>
                {races.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name || `Race ${r.raceNumber ?? r.id}`}
                    {r.raceType?.name ? ` · ${r.raceType.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const blocked = missingFor(report);
          return (
            <Card key={report.key} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{report.title}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {SCOPE_LABEL[report.scope]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                  <p className="text-[11px] text-muted-foreground/70 font-mono">
                    replaces {report.legacyTemplate}
                  </p>
                </div>

                <div className="space-y-2">
                  {blocked ? <p className="text-xs text-amber-600">{blocked}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!!blocked}
                      onClick={() => open(report, "pdf")}
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!blocked}
                      onClick={() => open(report, "xlsx")}
                    >
                      <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                      Excel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!blocked}
                      onClick={() => open(report, "csv")}
                    >
                      <FileDown className="mr-1.5 h-3.5 w-3.5" />
                      CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!blocked}
                      onClick={() => open(report, "html")}
                    >
                      <Printer className="mr-1.5 h-3.5 w-3.5" />
                      Print
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
