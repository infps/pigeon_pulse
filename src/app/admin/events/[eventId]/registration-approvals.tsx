"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useListEventInventory, useSetRegistrationApproval } from "@/lib/api/event-inventory";
import { useSeasonContext } from "@/lib/season-context";
import type { EventInventory } from "@/lib/types";

interface RegistrationApprovalsProps {
  eventId: string;
  status: "WAITING" | "REJECTED";
  onRowClick: (eventInventoryId: number) => void;
}

/** Registrations that are not participants: waiting for a decision, or rejected. */
export function RegistrationApprovals({ eventId, status, onRowClick }: RegistrationApprovalsProps) {
  const { selectedSeasonId } = useSeasonContext();
  const { data, isPending } = useListEventInventory(eventId, { approval: status }, selectedSeasonId);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const mutation = useSetRegistrationApproval(eventId);
  const rows: EventInventory[] = data?.eventInventory || [];

  const decide = async (ids: number[], action: "APPROVE" | "REJECT") => {
    if (ids.length === 0) return;
    try {
      const res = await mutation.mutateAsync({ ids, action });
      toast.success(res.data?.message ?? "Registrations updated");
      setSelected(new Set());
    } catch {
      toast.error("Failed to update registrations");
    }
  };

  const toggle = (id: number, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  if (isPending) {
    return (
      <>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        {status === "WAITING" ? "No registrations are waiting for approval." : "No rejected registrations."}
      </div>
    );
  }

  const allSelected = selected.size === rows.length;
  const selectedIds = [...selected];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={selected.size === 0 || mutation.isPending}
          onClick={() => decide(selectedIds, "APPROVE")}
        >
          Approve selected ({selected.size})
        </Button>
        {status === "WAITING" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={selected.size === 0 || mutation.isPending}
            onClick={() => decide(selectedIds, "REJECT")}
          >
            Reject selected ({selected.size})
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(on) => setSelected(on === true ? new Set(rows.map((r) => r.id)) : new Set())}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Breeder</TableHead>
              <TableHead>Loft</TableHead>
              <TableHead>Birds</TableHead>
              <TableHead>{status === "WAITING" ? "Waiting since" : "Rejected"}</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((inv) => {
              const date = status === "WAITING" ? inv.waitingDate : inv.rejectedAt;
              return (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(inv.id)}
                      onCheckedChange={(on) => toggle(inv.id, on === true)}
                      aria-label="Select registration"
                    />
                  </TableCell>
                  <TableCell>
                    <button type="button" className="hover:underline" onClick={() => onRowClick(inv.id)}>
                      {[inv.breeder?.firstName, inv.breeder?.lastName].filter(Boolean).join(" ") || "-"}
                    </button>
                  </TableCell>
                  <TableCell>{inv.loft || "-"}</TableCell>
                  <TableCell>{inv.items?.length ?? 0}</TableCell>
                  <TableCell>{date ? new Date(date).toLocaleString() : "-"}</TableCell>
                  <TableCell>${(inv.feeTotals?.paid ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" disabled={mutation.isPending} onClick={() => decide([inv.id], "APPROVE")}>
                      Approve
                    </Button>
                    {status === "WAITING" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={mutation.isPending}
                        onClick={() => decide([inv.id], "REJECT")}
                      >
                        Reject
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
