"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bird as BirdIcon,
  ArrowLeft,
  Share2,
  Copy,
  Check,
  Pencil,
  Globe,
  EyeOff,
  ArrowRightLeft,
} from "lucide-react";
import { SEX_LABELS } from "@/lib/bird-constants";
import { useGetBreederBird } from "@/lib/api/breeder";
import { useBirdHistory, type BirdFlight, type BirdHistoryResponse } from "@/lib/api/birds";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { authClient } from "@/lib/auth-client";
import { useSettings } from "@/lib/settings-context";
import { BirdDialog } from "@/app/birds/bird-dialog";
import { BirdHistoryPanel } from "@/app/admin/birds/[birdId]/bird-history-panel";

function duration(ms?: number) {
  if (ms == null) return "—";
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toWin(ms?: number) {
  if (ms == null) return "—";
  if (ms <= 0) return "Winner";
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `+${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `+${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<BirdFlight["status"], string> = {
  ARRIVED: "Home",
  RELEASED: "Not home",
  LOST: "Lost",
  STRAY: "Stray",
  FOREIGN_BIRD: "DNF",
};

const KINDS = [
  { id: "all", label: "All", match: () => true },
  { id: "races", label: "Races", match: (f: BirdFlight) => !f.isTraining },
  { id: "training", label: "Training", match: (f: BirdFlight) => f.isTraining },
] as const;

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : "—");

export default function BirdProfilePage({
  params,
}: {
  params: Promise<{ birdId: string }>;
}) {
  const { birdId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { velocityUnit } = useSettings();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Owner/public profile data (photo, owner actions). History API is the source for everything else.
  const { data: birdData, refetch } = useGetBreederBird({ birdId: session ? birdId : "" });
  const { data: historyData, isPending: historyLoading } = useBirdHistory(session ? birdId : "");

  const { mutate: togglePublic, isPending: toggling } = useApiMutation({
    endpoint: apiEndpoints.breeder.birdById(birdId),
    method: "PATCH",
    onSuccess: () => refetch(),
  });

  const history = historyData as BirdHistoryResponse | undefined;
  const info = history?.birdInfo;
  const bird = birdData?.bird;
  const isOwner: boolean = birdData?.isOwner ?? false;
  const isPublic = bird?.isPublic === 1;

  const kind = KINDS.find((k) => k.id === searchParams.get("kind")) ?? KINDS[0];
  const allFlights = useMemo(() => history?.flights ?? [], [history]);
  const flights = useMemo(() => allFlights.filter(kind.match), [allFlights, kind]);

  const stats = useMemo(() => {
    const clocked = flights.filter((f) => f.status === "ARRIVED" && f.flightTimeMs);
    const totalMiles = clocked.reduce((s, f) => s + (f.miles ?? 0), 0);
    const totalMs = clocked.reduce((s, f) => s + (f.flightTimeMs ?? 0), 0);
    const placed = clocked.filter((f) => f.position != null);
    return {
      clocked: clocked.length,
      totalMiles,
      totalMs,
      avgPos: placed.length ? placed.reduce((s, f) => s + f.position!, 0) / placed.length : null,
      // Weighted: total yards / total minutes, not a mean of per-race speeds.
      avgYpm: totalMs > 0 && totalMiles > 0 ? (totalMiles * 1760) / (totalMs / 60000) : null,
    };
  }, [flights]);

  const speed = (ypm?: number | null) =>
    ypm == null ? "—" : (velocityUnit === "MPM" ? ypm * 0.9144 : ypm).toFixed(2);

  const shareUrl = typeof window !== "undefined" ? window.location.href : `/birds/${birdId}`;
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

  if (sessionLoading || (session && historyLoading)) {
    return (
      <div className="container mx-auto p-6 space-y-6 max-w-5xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <BirdIcon className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Log in to see this bird&apos;s history.</p>
            <Button onClick={() => router.push("/login")}>Log in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Card>
          <CardContent className="py-16 text-center">
            <BirdIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Bird not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const outlineBtn = "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 gap-1";

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="h-28 w-28 shrink-0 rounded-xl overflow-hidden bg-slate-700 flex items-center justify-center border border-slate-600">
                {bird?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bird.image} alt={info.birdName ?? "Bird"} className="h-full w-full object-cover" />
                ) : (
                  <BirdIcon className="h-14 w-14 text-slate-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="font-mono text-2xl font-bold text-white truncate">{info.band || "—"}</h1>
                {info.birdName && <p className="text-slate-300 text-sm mt-0.5">{info.birdName}</p>}
                <p className="text-slate-300 text-sm mt-1">
                  {info.breederName || "Unknown breeder"}
                  {info.loftName && info.loftName !== info.breederName && (
                    <span className="text-slate-400"> / {info.loftName}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {info.color && (
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 border-slate-600">{info.color}</Badge>
                  )}
                  {info.sex != null && (
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 border-slate-600">
                      {SEX_LABELS[info.sex as keyof typeof SEX_LABELS] ?? "Unknown"}
                    </Badge>
                  )}
                  {isPublic && (
                    <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Public</Badge>
                  )}
                </div>
                <div className="flex gap-6 mt-3 text-sm text-slate-300">
                  <span>
                    Prize money <span className="font-semibold text-white">${(history?.prizeTotal ?? 0).toLocaleString()}</span>
                  </span>
                  <span>
                    Flights <span className="font-semibold text-white">{allFlights.length}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className={outlineBtn} onClick={handleCopy}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button size="sm" variant="outline" className={outlineBtn} onClick={handleWhatsApp}>
                    <Share2 className="h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                </div>
                {isOwner && (
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant="outline" className={outlineBtn} onClick={() => setEditOpen(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggling}
                      className={outlineBtn}
                      onClick={() => togglePublic({ isPublic: isPublic ? 0 : 1 })}
                    >
                      {isPublic ? <><EyeOff className="h-3.5 w-3.5" /> Make Private</> : <><Globe className="h-3.5 w-3.5" /> Make Public</>}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kind filter (shareable via ?kind=) */}
      <div role="tablist" aria-label="Flights" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {KINDS.map((k) => (
          <Link
            key={k.id}
            role="tab"
            aria-selected={k.id === kind.id}
            scroll={false}
            href={k.id === "all" ? `/birds/${birdId}` : `/birds/${birdId}?kind=${k.id}`}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
              k.id === kind.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k.label} <span className="tabular-nums text-muted-foreground">{allFlights.filter(k.match).length}</span>
          </Link>
        ))}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          ["Flights clocked", `${stats.clocked} of ${flights.length}`],
          ["Average place", stats.avgPos != null ? stats.avgPos.toFixed(1) : "—"],
          ["Average speed", stats.avgYpm != null ? `${speed(stats.avgYpm)} ${velocityUnit}` : "—"],
          ["Miles flown", stats.totalMiles ? stats.totalMiles.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"],
        ].map(([k, v]) => (
          <Card key={k}>
            <CardContent className="py-4 px-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{k}</p>
              <p className="text-xl font-bold tabular-nums">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Flights table */}
      {flights.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">No flights yet.</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 border-b text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Race</th>
                <th className="px-4 py-2.5 text-right">Miles</th>
                <th className="px-4 py-2.5 text-right">Place</th>
                <th className="px-4 py-2.5 text-right">Clocked</th>
                <th className="px-4 py-2.5 text-right">Flytime</th>
                <th className="px-4 py-2.5 text-right">Speed</th>
                <th className="px-4 py-2.5 text-right">To win</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {flights.map((f) => {
                const home = f.status === "ARRIVED";
                return (
                  <tr key={f.raceId} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDate(f.date)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/races/${f.raceId}`} className="font-medium hover:underline">
                        {f.raceName ?? `Race #${f.raceId}`}
                      </Link>
                      <div className="text-xs text-muted-foreground">{f.isTraining ? "Training" : "Race"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{f.miles?.toFixed(1) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {home ? (
                        <>
                          <span className="font-semibold">{f.position ?? "—"}</span>
                          {f.fieldSize ? <span className="text-muted-foreground"> / {f.fieldSize}</span> : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">{STATUS_LABEL[f.status]}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {home && f.arrivalTime ? new Date(f.arrivalTime).toLocaleTimeString([], { hour12: false }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{home ? duration(f.flightTimeMs) : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{home ? speed(f.ypm) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{home ? toWin(f.toWinMs) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            {stats.clocked > 0 && (
              <tfoot className="border-t bg-muted/50 text-muted-foreground">
                <tr>
                  <td className="px-4 py-2.5 font-medium" colSpan={2}>Totals</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {stats.totalMiles.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {stats.avgPos != null ? `avg ${stats.avgPos.toFixed(1)}` : ""}
                  </td>
                  <td />
                  <td className="px-4 py-2.5 text-right tabular-nums">{duration(stats.totalMs)}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{speed(stats.avgYpm)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <BirdHistoryPanel birdId={birdId} />

        <Card>
          <CardHeader className="py-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4" />
              Team changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(history?.transfers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No transfers.</p>
            ) : (
              <ul className="space-y-3">
                {history!.transfers.map((t, i) => (
                  <li key={i} className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{new Date(t.transferredAt).toLocaleString()}</span>
                    <span className="text-sm font-medium">Transferred from {t.fromBreederName}</span>
                    {t.eventName && <span className="text-xs text-muted-foreground">{t.eventName}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {isOwner && bird && (
        <BirdDialog open={editOpen} onOpenChange={setEditOpen} bird={bird as any} onSuccess={() => refetch()} />
      )}
    </div>
  );
}
