"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { useSeasonContext } from "@/lib/season-context";

interface RaceOption {
  id: number;
  raceNumber: number | null;
  distance: number | null;
  raceTypeId: number | null;
  raceType?: { name: string | null } | null;
  name?: string | null;
}

interface Row {
  inventoryItemId: number;
  birdId: number | null;
  position: number;
  raceCount: number;
  totalDistance: number;
  totalFlightMs: number;
  yardsPerMin: number | null;
  milesPerHour: number | null;
  prize: number | null;
  band: string;
  breederName: string;
  loft: string | null;
}

const HOT_SPOT_TYPES = new Set([6, 7, 8]);
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hms = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * HayLoft's average-speed winners screen: pick races, rank the birds by races
 * flown then average speed (daylight flight time only), and set each rank's
 * prize from the season's average prize scheme. The prizes go to the breeders'
 * accounts. Same procedures as HayLoft (lib/hayloft-avg-speed).
 */
export function AvgSpeedPrizesCard({ eventId, onBirdClick }: { eventId: string; onBirdClick?: (birdId: number) => void }) {
  const { selectedSeasonId } = useSeasonContext();
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [onlyHotSpotPaid, setOnlyHotSpotPaid] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedSeasonId == null) return;
    let cancelled = false;
    fetch(`/api/admin/race?seasonId=${selectedSeasonId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { races: [] }))
      .then((d) => {
        if (cancelled) return;
        const list: RaceOption[] = (d.races ?? []).filter((r: RaceOption) => (r.distance ?? 0) > 0);
        setRaces(list);
        // HayLoft's usual choice: the hot spot races.
        setChosen(new Set(list.filter((r) => HOT_SPOT_TYPES.has(r.raceTypeId ?? -1)).map((r) => r.id)));
        setRows(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSeasonId]);

  const query = useMemo(
    () => `seasonId=${selectedSeasonId}&raceIds=${[...chosen].join(",")}&onlyHotSpotPaid=${onlyHotSpotPaid ? 1 : 0}`,
    [selectedSeasonId, chosen, onlyHotSpotPaid]
  );

  const preview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/avg-speed-prizes?${query}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not rank the birds");
        return;
      }
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/avg-speed-prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: selectedSeasonId, raceIds: [...chosen], onlyHotSpotPaid }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not set the prizes");
        return;
      }
      toast.success(data.message);
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  if (selectedSeasonId == null) return null;
  const prizeTotal = (rows ?? []).reduce((s, r) => s + (r.prize ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Average-speed prizes (HayLoft)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {races.length === 0 && <p className="text-sm text-muted-foreground">No races with a distance in this season.</p>}
          {races.map((r) => (
            <label key={r.id} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={chosen.has(r.id)}
                onCheckedChange={(v) => {
                  const next = new Set(chosen);
                  if (v) next.add(r.id);
                  else next.delete(r.id);
                  setChosen(next);
                  setRows(null);
                }}
              />
              {r.raceType?.name ?? "Race"} {r.raceNumber ?? ""} · {r.distance} mi
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={onlyHotSpotPaid}
              onCheckedChange={(v) => {
                setOnlyHotSpotPaid(!!v);
                setRows(null);
              }}
            />
            <Label className="font-normal">Only birds with a hot spot fee</Label>
          </label>
          <Button size="sm" variant="outline" onClick={preview} disabled={chosen.size === 0 || loading}>
            Rank birds
          </Button>
          <Button size="sm" onClick={() => setConfirming(true)} disabled={!rows || rows.length === 0}>
            Set prizes
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows ? (
          rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bird has a placed arrival in these races.</p>
          ) : (
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-1.5 pr-3">#</th>
                    <th className="text-left py-1.5 pr-3">Band</th>
                    <th className="text-left py-1.5 pr-3">Breeder</th>
                    <th className="text-right py-1.5 pr-3">Races</th>
                    <th className="text-right py-1.5 pr-3">Miles</th>
                    <th className="text-right py-1.5 pr-3">Flight time</th>
                    <th className="text-right py-1.5 pr-3">Yd/min</th>
                    <th className="text-right py-1.5 pr-3">Prize</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((r) => (
                    <tr key={r.inventoryItemId} className="border-b last:border-0">
                      <td className="py-1 pr-3">{r.position}</td>
                      <td className="py-1 pr-3">
                        {r.birdId != null && onBirdClick ? (
                          <button className="underline-offset-2 hover:underline" onClick={() => onBirdClick(r.birdId!)}>
                            {r.band}
                          </button>
                        ) : (
                          r.band
                        )}
                      </td>
                      <td className="py-1 pr-3">{r.breederName}{r.loft ? ` · ${r.loft}` : ""}</td>
                      <td className="py-1 pr-3 text-right">{r.raceCount}</td>
                      <td className="py-1 pr-3 text-right">{r.totalDistance}</td>
                      <td className="py-1 pr-3 text-right">{hms(r.totalFlightMs)}</td>
                      <td className="py-1 pr-3 text-right">{r.yardsPerMin?.toFixed(4) ?? "—"}</td>
                      <td className="py-1 pr-3 text-right">{r.prize != null ? `$${money(r.prize)}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set average-speed prizes</DialogTitle>
              <DialogDescription>
                Replaces this season&apos;s average-speed prizes with this ranking: {rows?.filter((r) => r.prize != null).length ?? 0} birds,
                ${money(prizeTotal)} in total. They are paid through each breeder&apos;s account, as in HayLoft.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Set prizes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
