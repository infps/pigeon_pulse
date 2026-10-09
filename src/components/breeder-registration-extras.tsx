"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSetRegistrationApproval } from "@/lib/api/event-inventory";
import { useEventInventoryBets, useUpdateEventInventory } from "@/lib/api/payments";
import { shortBand } from "@/lib/bird-constants";
import type { EventInventory } from "@/lib/types";

const APPROVAL_BADGE: Record<EventInventory["approvalStatus"], { label: string; className: string }> = {
  WAITING: { label: "Waiting for approval", className: "bg-yellow-500 text-white" },
  APPROVED: { label: "Approved", className: "bg-green-600 text-white" },
  REJECTED: { label: "Rejected", className: "bg-red-600 text-white" },
};

/** Approval state with Approve / Reject, and the admin note for one registration. */
export function RegistrationStatusEditor({
  eventInventory,
  eventId,
}: {
  eventInventory: EventInventory;
  eventId: number | string;
}) {
  const [note, setNote] = useState(eventInventory.note ?? "");
  const status = eventInventory.approvalStatus ?? "APPROVED";
  const badge = APPROVAL_BADGE[status];

  const mutation = useUpdateEventInventory(eventInventory.id, {
    onSuccess: () => toast.success("Registration updated"),
  });
  const approval = useSetRegistrationApproval(eventId);

  const decide = async (action: "APPROVE" | "REJECT") => {
    try {
      const res = await approval.mutateAsync({ ids: [eventInventory.id], action });
      toast.success(res.data?.message ?? "Registration updated");
    } catch {
      toast.error("Failed to update registration");
    }
  };

  const save = async () => {
    try {
      await mutation.mutateAsync({ note });
    } catch {
      toast.error("Failed to update registration");
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className={badge.className}>{badge.label}</Badge>
        {status !== "APPROVED" && (
          <Button size="sm" disabled={approval.isPending} onClick={() => decide("APPROVE")}>
            Approve
          </Button>
        )}
        {status !== "REJECTED" && (
          <Button size="sm" variant="destructive" disabled={approval.isPending} onClick={() => decide("REJECT")}>
            Reject
          </Button>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="registration-note" className="text-xs">Note</Label>
        <Textarea
          id="registration-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Registration note…"
        />
      </div>
      <Button size="sm" onClick={save} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
const CATEGORY_LABEL: Record<string, string> = { BELGIAN: "Belgian", STANDARD: "Standard", WTA: "Winner takes all" };

interface BreederBet {
  id: number;
  raceName: string;
  raceNumber: number | null;
  category: string;
  tierIndex: number;
  band: string | null;
  amount: number;
  stakePaid: boolean;
  status: string;
  payoutValue: number | null;
}

/** All bets the registration's breeder placed in this season. */
export function BreederBetsSection({ eventInventoryId }: { eventInventoryId: number }) {
  const { data, isPending } = useEventInventoryBets(eventInventoryId);
  const bets: BreederBet[] = data?.bets ?? [];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">
        Bets ({bets.length})
      </h3>
      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : bets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bets placed this season.</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary">
              <tr>
                {["Race", "Bet", "Bird", "Stake", "Stake paid", "Status", "Payout"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-medium ${i === 3 || i === 6 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {bets.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2">{b.raceNumber != null ? `#${b.raceNumber} ` : ""}{b.raceName}</td>
                  <td className="px-3 py-2">{CATEGORY_LABEL[b.category] ?? b.category} · tier {b.tierIndex}</td>
                  <td className="px-3 py-2 font-mono">{shortBand(b.band) || "-"}</td>
                  <td className="px-3 py-2 text-right">${b.amount.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {b.stakePaid
                      ? <Badge className="bg-green-600 text-white">Paid</Badge>
                      : <Badge className="bg-red-600 text-white">Unpaid</Badge>}
                  </td>
                  <td className="px-3 py-2"><Badge variant="outline">{b.status}</Badge></td>
                  <td className="px-3 py-2 text-right">{b.payoutValue != null ? `$${b.payoutValue.toFixed(2)}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
