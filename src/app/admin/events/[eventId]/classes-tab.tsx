"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useSeasonContext } from "@/lib/season-context";
import { useListRaces } from "@/lib/api/races";

type PayoutType = "RATIO" | "WTA" | "PLACES";

interface RaceClass {
  id: number;
  code: string;
  description: string | null;
  classFee: number;
  payoutType: PayoutType;
  przEntry: number;
  cutPercent: number | null;
  sortOrder: number;
  isActive: boolean;
  entryCount: number;
  pool: number;
}

interface PayoutRow {
  band: string;
  breederName: string;
  position: number | null;
  payout: number;
}

interface PayoutResult {
  raceClassId: number;
  code: string;
  entries: number;
  placed: number;
  pool: number;
  cut: number;
  distributable: number;
  paid: number;
  refunded: boolean;
  rows: PayoutRow[];
  warnings: string[];
}

const TYPE_LABEL: Record<PayoutType, string> = {
  RATIO: "Ratio — one prize per N entries",
  WTA: "Winner takes all",
  PLACES: "Places — split by percentage",
};

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function describe(c: RaceClass): string {
  if (c.payoutType === "WTA") return "winner takes all";
  if (c.payoutType === "RATIO") return `${c.przEntry} for 1`;
  return `top ${c.przEntry} places`;
}

const EMPTY = {
  id: undefined as number | undefined,
  code: "",
  description: "",
  classFee: "0",
  payoutType: "WTA" as PayoutType,
  przEntry: "1",
  cutPercent: "",
};

/**
 * Race classes — the lettered pools breeders buy into.
 *
 * A class carries a fee and a payout shape; settling one divides its own pool
 * using the finishing order the race has already produced.
 */
export function ClassesTab({ eventId }: { eventId: string }) {
  const { selectedSeasonId } = useSeasonContext();
  const [classes, setClasses] = useState<RaceClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const [raceId, setRaceId] = useState<string>("");
  const [payouts, setPayouts] = useState<PayoutResult[] | null>(null);
  const [settling, setSettling] = useState(false);

  const { data: racesData } = useListRaces({
    params: selectedSeasonId ? { seasonId: String(selectedSeasonId) } : undefined,
  });
  const races = (racesData?.races ?? []) as Array<{
    id: number;
    name?: string | null;
    raceNumber?: number | null;
    status?: string | null;
  }>;

  const load = useCallback(async () => {
    if (selectedSeasonId == null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/classes?seasonId=${selectedSeasonId}`);
      if (!res.ok) {
        toast.error("Could not load classes");
        return;
      }
      const data = await res.json();
      setClasses(data.classes ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.code.trim()) {
      toast.error("Give the class a letter");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/classes?seasonId=${selectedSeasonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          code: form.code.trim(),
          description: form.description || null,
          classFee: Number(form.classFee) || 0,
          payoutType: form.payoutType,
          przEntry: Number(form.przEntry) || 1,
          cutPercent: form.cutPercent === "" ? null : Number(form.cutPercent),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not save the class");
        return;
      }
      toast.success(data.message);
      setForm({ ...EMPTY });
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: RaceClass) => {
    const res = await fetch(
      `/api/admin/event/${eventId}/classes?seasonId=${selectedSeasonId}&id=${c.id}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message ?? "Could not remove the class");
      return;
    }
    toast.success(data.message);
    load();
  };

  const runPayouts = async (commit: boolean) => {
    if (!raceId) {
      toast.error("Choose a race first");
      return;
    }
    setSettling(true);
    try {
      const url = `/api/admin/event/${eventId}/classes/payouts?seasonId=${selectedSeasonId}${commit ? "" : `&raceId=${raceId}`}`;
      const res = await fetch(url, {
        method: commit ? "POST" : "GET",
        ...(commit
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ raceId: Number(raceId) }),
            }
          : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not calculate payouts");
        return;
      }
      setPayouts(data.results ?? []);
      if (commit) {
        toast.success(data.message);
        load();
      }
    } finally {
      setSettling(false);
    }
  };

  if (selectedSeasonId == null) {
    return <p className="text-sm text-muted-foreground">Choose a season first.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {form.id ? `Edit class ${form.code}` : "New class"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1.5">
              <Label htmlFor="c-code">Letter</Label>
              <Input
                id="c-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="A"
                maxLength={12}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-desc">Description</Label>
              <Input
                id="c-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="$20 - 10 for 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-fee">Fee</Label>
              <Input
                id="c-fee"
                value={form.classFee}
                onChange={(e) => setForm({ ...form, classFee: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payout</Label>
              <Select
                value={form.payoutType}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    payoutType: v as PayoutType,
                    przEntry: v === "WTA" ? "1" : form.przEntry,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as PayoutType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-prz">
                {form.payoutType === "RATIO"
                  ? "Entries per prize"
                  : form.payoutType === "PLACES"
                    ? "Places paid"
                    : "Winners"}
              </Label>
              <Input
                id="c-prz"
                value={form.przEntry}
                disabled={form.payoutType === "WTA"}
                onChange={(e) => setForm({ ...form, przEntry: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-cut">House cut %</Label>
              <Input
                id="c-cut"
                value={form.cutPercent}
                onChange={(e) => setForm({ ...form, cutPercent: e.target.value })}
                placeholder="from betting scheme"
                className="w-48"
              />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : form.id ? "Save changes" : "Add class"}
            </Button>
            {form.id && (
              <Button variant="ghost" onClick={() => setForm({ ...EMPTY })}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Classes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No classes in this season yet. Add one above — A, B, C and so on.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-1.5 pr-3">Class</th>
                    <th className="text-left py-1.5 pr-3">Description</th>
                    <th className="text-right py-1.5 pr-3">Fee</th>
                    <th className="text-left py-1.5 pr-3">Pays</th>
                    <th className="text-right py-1.5 pr-3">Birds</th>
                    <th className="text-right py-1.5 pr-3">Pool</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {classes.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{c.code}</span>
                          {!c.isActive && (
                            <Badge variant="outline" className="text-[10px]">
                              closed
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{c.description ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{money(c.classFee)}</td>
                      <td className="py-1.5 pr-3 text-xs">{describe(c)}</td>
                      <td className="py-1.5 pr-3 text-right">{c.entryCount}</td>
                      <td className="py-1.5 pr-3 text-right">{money(c.pool)}</td>
                      <td className="py-1.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              setForm({
                                id: c.id,
                                code: c.code,
                                description: c.description ?? "",
                                classFee: String(c.classFee),
                                payoutType: c.payoutType,
                                przEntry: String(c.przEntry),
                                cutPercent: c.cutPercent == null ? "" : String(c.cutPercent),
                              })
                            }
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => remove(c)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Settle classes against a race</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Classes use the finishing order the race has already produced. Preview first — settling
            writes each bird&apos;s position and payout onto its class entry.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Race</Label>
              <Select value={raceId} onValueChange={setRaceId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a race" />
                </SelectTrigger>
                <SelectContent>
                  {races.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name || `Race ${r.raceNumber ?? r.id}`}
                      {r.status ? ` · ${r.status.toLowerCase()}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => runPayouts(false)} disabled={settling}>
              Preview
            </Button>
            <Button onClick={() => runPayouts(true)} disabled={settling}>
              {settling ? "Working…" : "Settle"}
            </Button>
          </div>

          {payouts && (
            <div className="space-y-3">
              {payouts.map((p) => (
                <div key={p.raceClassId} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      Class {p.code}
                      {p.refunded && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          refund
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {p.entries} entries · pool {money(p.pool)} · cut {money(p.cut)} · paying{" "}
                      {money(p.paid)}
                    </span>
                  </div>

                  {p.warnings.map((w) => (
                    <p key={w} className="text-xs text-amber-600 mt-1">
                      {w}
                    </p>
                  ))}

                  {p.rows.filter((r) => r.payout > 0).length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {p.rows
                        .filter((r) => r.payout > 0)
                        .map((r, i) => (
                          <div key={i} className="flex justify-between text-xs tabular-nums">
                            <span>
                              <span className="text-muted-foreground mr-2">#{r.position}</span>
                              <span className="font-mono">{r.band}</span>
                              <span className="text-muted-foreground ml-2">{r.breederName}</span>
                            </span>
                            <span className="font-medium">{money(r.payout)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
