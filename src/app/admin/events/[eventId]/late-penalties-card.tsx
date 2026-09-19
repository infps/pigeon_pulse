"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlarmClock } from "lucide-react";
import { toast } from "sonner";

interface AssessmentRow {
  eventInventoryId: number;
  breederName: string;
  loft: string | null;
  outstanding: number;
  daysLate: number;
  penalty: number;
  existingPenaltyId: number | null;
  cashPromised: boolean;
}

interface ExistingPenalty {
  id: number;
  daysLate: number;
  amount: number;
  assessedAt: string;
  waivedAt: string | null;
  waiverReason: string | null;
  eventInventory: {
    loft: string | null;
    breeder: { firstName: string | null; lastName: string | null } | null;
  };
}

interface Assessment {
  raceName: string;
  deadline: string | null;
  daysLate: number;
  config: { mode: string; amount: number | null; cap: number | null; graceDays: number };
  rows: AssessmentRow[];
  warnings: string[];
}

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Late-payment penalties for the season.
 *
 * Shows what would be charged before charging it, because the amount escalates
 * with time and lands on a breeder's balance.
 */
export function LatePenaltiesCard({
  eventId,
  seasonId,
}: {
  eventId: string;
  seasonId: number | null;
}) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [existing, setExisting] = useState<ExistingPenalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [charging, setCharging] = useState(false);
  const [waiving, setWaiving] = useState<ExistingPenalty | null>(null);
  const [waiverReason, setWaiverReason] = useState("");
  const [waiverProof, setWaiverProof] = useState("");

  const load = useCallback(async () => {
    if (seasonId == null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/penalties?seasonId=${seasonId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? "Could not load penalties");
        return;
      }
      const data = await res.json();
      setAssessment(data.assessment);
      setExisting(data.existing ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId, seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const charge = async () => {
    setCharging(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/penalties?seasonId=${seasonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not charge penalties");
        return;
      }
      toast.success(data.message);
      load();
    } finally {
      setCharging(false);
    }
  };

  const waive = async () => {
    if (!waiving) return;
    if (!waiverReason.trim()) {
      toast.error("A reason is required to waive a penalty");
      return;
    }
    const res = await fetch(`/api/admin/penalty/${waiving.id}/waive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: waiverReason.trim(),
        proofUrl: waiverProof.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message ?? "Could not waive the penalty");
      return;
    }
    toast.success(data.message);
    setWaiving(null);
    setWaiverReason("");
    setWaiverProof("");
    load();
  };

  if (seasonId == null) return null;

  const chargeable = (assessment?.rows ?? []).filter((r) => !r.cashPromised && r.penalty > 0);
  const penaltyOff = assessment?.config.mode === "NONE";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlarmClock className="h-4 w-4" />
              Late payment penalties
            </CardTitle>
            {assessment && (
              <p className="text-xs text-muted-foreground mt-1">
                Deadline: {assessment.raceName}
                {assessment.deadline
                  ? ` on ${new Date(assessment.deadline).toLocaleDateString()}`
                  : " (no start time set)"}
                {assessment.daysLate > 0 ? ` · ${assessment.daysLate} days past` : " · not yet past"}
              </p>
            )}
          </div>
          {!penaltyOff && chargeable.length > 0 && (
            <Button size="sm" onClick={charge} disabled={charging}>
              {charging ? "Charging…" : `Charge ${chargeable.length}`}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {(assessment?.warnings ?? []).map((w) => (
              <p key={w} className="text-xs text-amber-600">
                {w}
              </p>
            ))}

            {penaltyOff ? (
              <p className="text-sm text-muted-foreground">
                This season&apos;s fee scheme has late-payment penalties turned off. Set a mode on
                the fee scheme to use them.
              </p>
            ) : chargeable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing to charge — no registration is past the deadline and grace period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-1.5 pr-3">Breeder</th>
                      <th className="text-left py-1.5 pr-3">Loft</th>
                      <th className="text-right py-1.5 pr-3">Outstanding</th>
                      <th className="text-right py-1.5 pr-3">Days late</th>
                      <th className="text-right py-1.5">Penalty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chargeable.map((r) => (
                      <tr key={r.eventInventoryId} className="border-b last:border-0">
                        <td className="py-1.5 pr-3">{r.breederName || "—"}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{r.loft ?? "—"}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">
                          {money(r.outstanding)}
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.daysLate}</td>
                        <td className="py-1.5 text-right tabular-nums font-medium">
                          {money(r.penalty)}
                          {r.existingPenaltyId != null && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              updates existing
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {existing.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Charged
                </p>
                {existing.map((p) => {
                  const who =
                    `${p.eventInventory.breeder?.firstName ?? ""} ${p.eventInventory.breeder?.lastName ?? ""}`.trim() ||
                    "—";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 text-sm py-1"
                    >
                      <span className="flex items-center gap-2">
                        <span>{who}</span>
                        <span className="text-xs text-muted-foreground">
                          {money(p.amount)} · {p.daysLate}d late
                        </span>
                        {p.waivedAt && (
                          <Badge variant="outline" className="text-[10px]">
                            waived
                          </Badge>
                        )}
                      </span>
                      {p.waivedAt ? (
                        <span
                          className="text-xs text-muted-foreground max-w-[45%] truncate"
                          title={p.waiverReason ?? ""}
                        >
                          {p.waiverReason}
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setWaiving(p)}
                        >
                          Waive
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={waiving !== null} onOpenChange={(o) => !o && setWaiving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Waive penalty</DialogTitle>
            <DialogDescription>
              The charge stays on record as waived, with who waived it and why, so the decision is
              auditable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder="Why this penalty is being waived"
              rows={3}
            />
            <Input
              value={waiverProof}
              onChange={(e) => setWaiverProof(e.target.value)}
              placeholder="Link to proof (optional)"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiving(null)}>
              Cancel
            </Button>
            <Button onClick={waive}>Waive penalty</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
