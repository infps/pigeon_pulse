"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { Calculator, FileDown, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useSeasonContext } from "@/lib/season-context";

interface LedgerLine {
  eventInventoryId: number;
  breederName: string;
  loft: string | null;
  charged: number;
  penalties: number;
  paid: number;
  refunded: number;
  balance: number;
  prizeEarned: number;
  classEarned: number;
  owedOut: number;
  cashPromised: boolean;
}

interface Totals {
  charged: number;
  penalties: number;
  paid: number;
  refunded: number;
  balance: number;
  owedOut: number;
}

interface RefundRow {
  id: number;
  amount: number;
  reason: string | null;
  issuedAt: string;
  eventInventory: {
    loft: string | null;
    breeder: { firstName: string | null; lastName: string | null } | null;
  };
}

type View = "ledger" | "unpaid" | "earned";

const VIEWS: Array<{ key: View; label: string; blurb: string }> = [
  { key: "ledger", label: "Everyone", blurb: "Every registration, both directions" },
  { key: "unpaid", label: "Owes us", blurb: "Registrations with money outstanding" },
  { key: "earned", label: "We owe", blurb: "Prize and class money still to pay out" },
];

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Accounting.
 *
 * Money owed to a breeder is shown separately from money they owe rather than
 * netted off: a breeder can be owed prize money and still be behind on fees, and
 * collapsing that into one figure hides the collection problem.
 */
export function AccountingTab({ eventId }: { eventId: string }) {
  const { selectedSeasonId } = useSeasonContext();
  const [view, setView] = useState<View>("ledger");
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [refunding, setRefunding] = useState<LedgerLine | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (selectedSeasonId == null) return;
    setLoading(true);
    try {
      const [accRes, refRes] = await Promise.all([
        fetch(`/api/admin/event/${eventId}/accounting?view=${view}&seasonId=${selectedSeasonId}`),
        fetch(`/api/admin/event/${eventId}/refunds?seasonId=${selectedSeasonId}`),
      ]);

      if (accRes.ok) {
        const data = await accRes.json();
        setLines(data.lines ?? []);
        setTotals(data.totals ?? null);
      }
      if (refRes.ok) setRefunds((await refRes.json()).refunds ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId, view, selectedSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const issueRefund = async () => {
    if (!refunding) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter an amount above zero");
      return;
    }
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/refunds?seasonId=${selectedSeasonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventInventoryId: refunding.eventInventoryId,
          amount: value,
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not record the refund");
        return;
      }
      toast.success(data.message);
      setRefunding(null);
      setAmount("");
      setReason("");
      load();
    } finally {
      setWorking(false);
    }
  };

  if (selectedSeasonId == null) {
    return <p className="text-sm text-muted-foreground">Choose a season first.</p>;
  }

  const reportUrl = (key: string, format: string) =>
    `/api/admin/reports/${key}?format=${format}&seasonId=${selectedSeasonId}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Accounting
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={reportUrl("season-ledger", "pdf")} target="_blank" rel="noopener">
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  Ledger PDF
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={reportUrl("prize-statements", "xlsx")} target="_blank" rel="noopener">
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  Prize statements
                </a>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-2">
            {VIEWS.map((v) => (
              <Button
                key={v.key}
                size="sm"
                variant={view === v.key ? "default" : "outline"}
                className="h-7 text-xs"
                title={v.blurb}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {view === "unpaid"
                ? "Nobody owes anything."
                : view === "earned"
                  ? "Nothing is owed out."
                  : "No registrations in this season."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-1.5 pr-3">Breeder</th>
                    <th className="text-left py-1.5 pr-3">Loft</th>
                    <th className="text-right py-1.5 pr-3">Charged</th>
                    <th className="text-right py-1.5 pr-3">Penalty</th>
                    <th className="text-right py-1.5 pr-3">Paid</th>
                    <th className="text-right py-1.5 pr-3">Refunded</th>
                    <th className="text-right py-1.5 pr-3">Balance</th>
                    <th className="text-right py-1.5 pr-3">Won</th>
                    <th className="text-right py-1.5 pr-3">Owed out</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {lines.map((l) => (
                    <tr key={l.eventInventoryId} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        <span className="flex items-center gap-1.5">
                          {l.breederName || "—"}
                          {l.cashPromised && (
                            <Badge variant="secondary" className="text-[10px]">
                              cash
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{l.loft ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{money(l.charged)}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {l.penalties ? money(l.penalties) : ""}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{money(l.paid)}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {l.refunded ? money(l.refunded) : ""}
                      </td>
                      <td
                        className={`py-1.5 pr-3 text-right ${l.balance > 0 ? "text-amber-600" : ""}`}
                      >
                        {money(l.balance)}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        {l.prizeEarned + l.classEarned
                          ? money(l.prizeEarned + l.classEarned)
                          : ""}
                      </td>
                      <td
                        className={`py-1.5 pr-3 text-right ${l.owedOut > 0 ? "text-emerald-600" : ""}`}
                      >
                        {l.owedOut ? money(l.owedOut) : ""}
                      </td>
                      <td className="py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setRefunding(l);
                            setAmount("");
                          }}
                        >
                          <Undo2 className="mr-1 h-3 w-3" />
                          Refund
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && view === "ledger" && (
                  <tfoot>
                    <tr className="border-t-2 font-medium">
                      <td className="py-2 pr-3">Total</td>
                      <td></td>
                      <td className="py-2 pr-3 text-right">{money(totals.charged)}</td>
                      <td className="py-2 pr-3 text-right">{money(totals.penalties)}</td>
                      <td className="py-2 pr-3 text-right">{money(totals.paid)}</td>
                      <td className="py-2 pr-3 text-right">{money(totals.refunded)}</td>
                      <td className="py-2 pr-3 text-right">{money(totals.balance)}</td>
                      <td></td>
                      <td className="py-2 pr-3 text-right">{money(totals.owedOut)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {refunds.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Refunds issued</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {refunds.map((r) => {
              const who =
                `${r.eventInventory.breeder?.firstName ?? ""} ${r.eventInventory.breeder?.lastName ?? ""}`.trim() ||
                "—";
              return (
                <div key={r.id} className="flex justify-between gap-3 text-sm py-1">
                  <span>
                    {who}
                    {r.reason && (
                      <span className="text-xs text-muted-foreground ml-2">{r.reason}</span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(r.amount)} · {new Date(r.issuedAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Dialog open={refunding !== null} onOpenChange={(o) => !o && setRefunding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record a refund</DialogTitle>
            <DialogDescription>
              Returning money to {refunding?.breederName || "this breeder"}. The refund is kept as
              its own record, so the ledger still shows what was charged and paid.
              {refunding && (
                <span className="mt-1 block">
                  Paid so far: {money(refunding.paid)} · already refunded:{" "}
                  {money(refunding.refunded)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ref-amount">Amount</Label>
              <Input
                id="ref-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why (optional)"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefunding(null)} disabled={working}>
              Cancel
            </Button>
            <Button onClick={issueRefund} disabled={working}>
              {working ? "Recording…" : "Record refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
