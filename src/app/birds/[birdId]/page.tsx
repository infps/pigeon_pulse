"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bird as BirdIcon,
  ArrowLeft,
  Share2,
  Copy,
  Check,
  Pencil,
  Globe,
  EyeOff,
} from "lucide-react";
import { SEX_LABELS } from "@/lib/bird-constants";
import { useGetBreederBird } from "@/lib/api/breeder";
import { useBirdHistory, type BirdHistoryEntry } from "@/lib/api/birds";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { authClient } from "@/lib/auth-client";
import { BirdDialog } from "@/app/birds/bird-dialog";
import { toast } from "sonner";

function formatMs(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatGap(ms: number) {
  if (ms === 0) return "Leader";
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

interface HistoryTableProps {
  entries: BirdHistoryEntry[];
  label: string;
  accent?: string;
}

function HistoryTable({ entries, label, accent }: HistoryTableProps) {
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const total = entries.length;
  const pageCount = Math.ceil(total / perPage);
  const slice = entries.slice(page * perPage, page * perPage + perPage);

  if (entries.length === 0) return null;

  return (
    <div className="mt-6">
      <div className={`flex items-center gap-2 mb-3 ${accent ?? ""}`}>
        <span className="text-sm font-semibold uppercase tracking-wide">{label}</span>
        <span className="text-xs text-muted-foreground">Summary includes via-training</span>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase">
              <th className="px-4 py-3 text-left w-12">Rank</th>
              <th className="px-4 py-3 text-left">Race Name</th>
              <th className="px-4 py-3 text-left">Date &amp; Time</th>
              <th className="px-4 py-3 text-left">Arrival / Gap</th>
              <th className="px-4 py-3 text-right">Dist. (mi)</th>
              <th className="px-4 py-3 text-right">Speed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {slice.map((e, i) => {
              const arrivalDate = new Date(e.date);
              const isLeader = (e as any).gapMs === 0;
              return (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    {e.position != null ? (
                      <span
                        className={`font-semibold ${
                          e.position === 1
                            ? "text-yellow-500"
                            : e.position <= 3
                            ? "text-primary"
                            : ""
                        }`}
                      >
                        {e.position}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{e.raceName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{arrivalDate.toLocaleDateString()}</div>
                    <div className="text-xs">{arrivalDate.toLocaleTimeString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      {(e as any).flightTimeMs != null
                        ? formatMs((e as any).flightTimeMs)
                        : "—"}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        isLeader ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {(e as any).gapMs != null
                        ? isLeader
                          ? "00:00:00"
                          : formatGap((e as any).gapMs)
                        : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(e as any).distance != null
                      ? ((e as any).distance as number).toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(e as any).ypm != null
                      ? ((e as any).ypm as number).toFixed(4)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              className="border rounded px-2 py-1 text-xs bg-background"
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
            >
              {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span>{page * perPage + 1}–{Math.min((page + 1) * perPage, total)} of {total}</span>
            <Button variant="ghost" size="icon-xs" disabled={page === 0} onClick={() => setPage(0)}>«</Button>
            <Button variant="ghost" size="icon-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</Button>
            <Button variant="ghost" size="icon-xs" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>›</Button>
            <Button variant="ghost" size="icon-xs" disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>»</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BirdProfilePage({
  params,
}: {
  params: Promise<{ birdId: string }>;
}) {
  const { birdId } = use(params);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: birdData, isPending: birdLoading, refetch } = useGetBreederBird({ birdId });
  const { data: historyData, isPending: historyLoading } = useBirdHistory(birdId);

  const { mutate: togglePublic, isPending: toggling } = useApiMutation({
    endpoint: apiEndpoints.breeder.birdById(birdId),
    method: "PATCH",
    onSuccess: () => refetch(),
  });

  const bird = birdData?.bird;
  const isOwner: boolean = birdData?.isOwner ?? false;

  const bandDisplay = bird
    ? [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-")
    : "";

  const allEntries: BirdHistoryEntry[] = (historyData as any)?.entries ?? [];
  const arrivedEntries = allEntries.filter((e) => e.type === "ARRIVED");

  // Split competition vs training
  const competitionRaces = arrivedEntries.filter(
    (e) => !(e as any).raceTypeName?.toLowerCase().includes("training")
  );
  const trainingRaces = arrivedEntries.filter((e) =>
    (e as any).raceTypeName?.toLowerCase().includes("training")
  );

  // Compute aggregate stats from ARRIVED entries
  const stats = useMemo(() => {
    if (arrivedEntries.length === 0)
      return { bestRank: null, totalDist: 0, bestFlightMs: null, avgYpm: null };
    const positions = arrivedEntries
      .map((e) => e.position)
      .filter((p): p is number => p != null);
    const distances = arrivedEntries
      .map((e) => (e as any).distance as number | undefined)
      .filter((d): d is number => d != null);
    const ypms = arrivedEntries
      .map((e) => (e as any).ypm as number | undefined)
      .filter((y): y is number => y != null);
    const flightTimes = arrivedEntries
      .map((e) => (e as any).flightTimeMs as number | undefined)
      .filter((f): f is number => f != null);
    return {
      bestRank: positions.length > 0 ? Math.min(...positions) : null,
      totalDist: distances.reduce((s, d) => s + d, 0),
      bestFlightMs: flightTimes.length > 0 ? Math.min(...flightTimes) : null,
      avgYpm:
        ypms.length > 0 ? ypms.reduce((s, y) => s + y, 0) / ypms.length : null,
    };
  }, [arrivedEntries]);

  const shareUrl =
    typeof window !== "undefined" ? window.location.href : `/birds/${birdId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Check out this pigeon: ${shareUrl}`)}`,
      "_blank"
    );
  };

  if (birdLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!bird) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-16 text-center">
            <BirdIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Bird not found or profile is private.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPublic = bird.isPublic === 1;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-6">
            <div className="flex items-start gap-6">
              {/* Photo */}
              <div className="h-36 w-36 shrink-0 rounded-xl overflow-hidden bg-slate-700 flex items-center justify-center border border-slate-600">
                {bird.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bird.image}
                    alt={bird.birdName ?? "Bird"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BirdIcon className="h-16 w-16 text-slate-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">
                  {bird.birdName || "Unnamed Bird"}
                </h1>
                <p className="font-mono text-sm text-slate-300 mt-0.5">{bandDisplay || "—"}</p>

                <div className="flex flex-wrap gap-2 mt-3">
                  {bird.color && (
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 border-slate-600">
                      {bird.color}
                    </Badge>
                  )}
                  {bird.sex != null && (
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 border-slate-600">
                      {SEX_LABELS[bird.sex as keyof typeof SEX_LABELS] ?? "Unknown"}
                    </Badge>
                  )}
                  {isPublic && (
                    <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                      Public
                    </Badge>
                  )}
                </div>

                {(historyData as any)?.birdInfo?.loftName && (
                  <p className="text-slate-400 text-sm mt-2">
                    {(historyData as any).birdInfo.loftName}
                  </p>
                )}
              </div>

              {/* Actions (right side) */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {(isOwner || isPublic) && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-1"
                      onClick={handleCopy}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-1"
                      onClick={handleWhatsApp}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                  </div>
                )}
                {isOwner && (
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-1"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggling}
                      className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-1"
                      onClick={() => togglePublic({ isPublic: isPublic ? 0 : 1 })}
                    >
                      {isPublic ? (
                        <><EyeOff className="h-3.5 w-3.5" /> Make Private</>
                      ) : (
                        <><Globe className="h-3.5 w-3.5" /> Make Public</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-5 px-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Best Rank</p>
            <p className="text-3xl font-bold text-yellow-500">
              {stats.bestRank != null ? `#${stats.bestRank}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 px-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Distance</p>
            <p className="text-3xl font-bold">
              {stats.totalDist > 0 ? stats.totalDist.toFixed(1) : "—"}
            </p>
            {stats.totalDist > 0 && (
              <p className="text-xs text-muted-foreground">mi</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 px-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Best Flight Time</p>
            <p className="text-2xl font-bold tabular-nums">
              {stats.bestFlightMs != null ? formatMs(stats.bestFlightMs) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5 px-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Avg Speed</p>
            <p className="text-3xl font-bold">
              {stats.avgYpm != null ? stats.avgYpm.toFixed(2) : "—"}
            </p>
            {stats.avgYpm != null && (
              <p className="text-xs text-muted-foreground">YPM</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Race history */}
      {historyLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : arrivedEntries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No race results yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 pb-4">
            <HistoryTable entries={competitionRaces} label="Competition" />
            <HistoryTable
              entries={trainingRaces}
              label="Training"
              accent="text-primary"
            />
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <BirdDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          bird={bird as any}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
