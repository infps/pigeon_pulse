"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiEndpoints } from "@/lib/endpoints";
import { Calculator, TriangleAlert } from "lucide-react";

interface RecalcChange {
  raceItemId: number;
  band: string | null;
  before: { position: number | null; hotspotPosition: number | null; prize: number | null };
  after: { position: number | null; hotspotPosition: number | null; prize: number | null };
}

interface RecalcSummary {
  raceId: number;
  raceTypeName: string | null;
  prizeRole: string;
  positionsAssigned: number;
  hotspotPositionsAssigned: number;
  prizesAwarded: number;
  prizeTotal: number;
  skippedUnpaid: number;
  skippedIgnored: number;
  warnings: string[];
  changes: RecalcChange[];
  changedCount: number;
  dryRun: boolean;
}

const money = (n: number | null) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const num = (n: number | null) => (n == null ? "—" : String(n));

/**
 * Recalculate a race's results.
 *
 * Always previews first: positions and prize money on a finished race are
 * money, so the operator sees exactly which birds change before anything is
 * written. The preview runs the real calculation in a transaction that is
 * rolled back.
 */
export function RecalculateDialog({
  raceId,
  disabled,
}: {
  raceId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<RecalcSummary | null>(null);
  const queryClient = useQueryClient();

  const runPreview = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch(apiEndpoints.races.recalculatePreview(raceId), {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Preview failed");
      setPreview(body.summary as RecalcSummary);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not preview the recalculation");
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const res = await fetch(apiEndpoints.races.recalculate(raceId), { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? "Recalculation failed");
      toast.success(body.message ?? "Results recalculated");
      setOpen(false);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["races", "detail", raceId] });
      await queryClient.invalidateQueries({ queryKey: ["race-items"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not recalculate");
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={runPreview}
        disabled={disabled || loading}
      >
        <Calculator className="mr-2 h-4 w-4" />
        {loading ? "Checking…" : "Recalculate results"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Recalculate results</DialogTitle>
            <DialogDescription>
              Positions, hotspot positions and prize money are rebuilt from current
              arrival times, payments and the ignore list. Nothing has been saved yet.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Positions" value={String(preview.positionsAssigned)} />
                <Stat label="Hotspot places" value={String(preview.hotspotPositionsAssigned)} />
                <Stat label="Prizes" value={String(preview.prizesAwarded)} />
                <Stat label="Prize total" value={money(preview.prizeTotal)} />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">
                  {preview.raceTypeName ?? "Unknown type"}
                </Badge>
                <Badge variant={preview.prizeRole === "NONE" ? "secondary" : "default"}>
                  {preview.prizeRole === "NONE" ? "No prize" : preview.prizeRole.replace(/_/g, " ")}
                </Badge>
                {preview.skippedUnpaid > 0 && (
                  <span className="text-muted-foreground">
                    {preview.skippedUnpaid} unpaid bird{preview.skippedUnpaid === 1 ? "" : "s"} excluded
                    from the final race
                  </span>
                )}
                {preview.skippedIgnored > 0 && (
                  <span className="text-muted-foreground">
                    {preview.skippedIgnored} ignored bird{preview.skippedIgnored === 1 ? "" : "s"} excluded
                  </span>
                )}
              </div>

              {preview.warnings.map((w) => (
                <div
                  key={w}
                  className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}

              {preview.changedCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing changes — the stored results already match a fresh calculation.
                </p>
              ) : (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    {preview.changedCount} bird{preview.changedCount === 1 ? "" : "s"} change
                    {preview.changedCount === 1 ? "s" : ""}
                    {preview.changes.length < preview.changedCount &&
                      ` (showing first ${preview.changes.length})`}
                  </p>
                  <div className="max-h-72 overflow-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="p-2 text-left font-medium">Band</th>
                          <th className="p-2 text-right font-medium">Position</th>
                          <th className="p-2 text-right font-medium">Hotspot</th>
                          <th className="p-2 text-right font-medium">Prize</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.changes.slice(0, 200).map((c) => (
                          <tr key={c.raceItemId} className="border-t">
                            <td className="p-2 font-mono text-xs">{c.band ?? "—"}</td>
                            <td className="p-2 text-right tabular-nums">
                              {num(c.before.position)} → <b>{num(c.after.position)}</b>
                            </td>
                            <td className="p-2 text-right tabular-nums">
                              {num(c.before.hotspotPosition)} → <b>{num(c.after.hotspotPosition)}</b>
                            </td>
                            <td className="p-2 text-right tabular-nums">
                              {money(c.before.prize)} → <b>{money(c.after.prize)}</b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={applying || !preview}>
              {applying ? "Saving…" : "Apply changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
