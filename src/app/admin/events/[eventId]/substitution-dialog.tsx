"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { EventInventoryItem } from "@/lib/types";

interface BackupOption {
  id: number;
  birdNo: number | null;
  band: string;
  birdName: string | null;
  eligible: boolean;
}

function bandOf(item: EventInventoryItem | null): string {
  const b = item?.bird;
  if (!b) return "this bird";
  return [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") || b.band || "this bird";
}

/**
 * Swap a reserve bird in for one that is out of the race, or undo that swap.
 *
 * The replacement inherits the outgoing bird's number and fees, so the
 * registration still bills the same amount.
 */
export function SubstitutionDialog({
  item,
  open,
  onOpenChange,
  onDone,
}: {
  item: EventInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [backups, setBackups] = useState<BackupOption[]>([]);
  const [alreadyReplaced, setAlreadyReplaced] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const itemId = item?.id ?? null;

  useEffect(() => {
    if (!open || itemId == null) return;
    setLoading(true);
    setSelected(null);
    fetch(`/api/admin/event-inventory-item/${itemId}/substitute`)
      .then((r) => r.json())
      .then((data) => {
        setBackups(data.backups ?? []);
        setAlreadyReplaced(Boolean(data.alreadyReplaced));
      })
      .catch(() => toast.error("Could not load the available backup birds"))
      .finally(() => setLoading(false));
  }, [open, itemId]);

  const substitute = async () => {
    if (itemId == null) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/event-inventory-item/${itemId}/substitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected ? { incomingItemId: selected } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Substitution failed");
        return;
      }
      toast.success(data.message);
      onOpenChange(false);
      onDone();
    } finally {
      setWorking(false);
    }
  };

  const restore = async () => {
    if (itemId == null) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/event-inventory-item/${itemId}/substitute`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Restore failed");
        return;
      }
      toast.success(data.message);
      onOpenChange(false);
      onDone();
    } finally {
      setWorking(false);
    }
  };

  const eligible = backups.filter((b) => b.eligible);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {alreadyReplaced ? "Restore to lineup" : "Substitute a backup bird"}
          </DialogTitle>
          <DialogDescription>
            {alreadyReplaced
              ? `${bandOf(item)} was replaced. Restoring puts it back in the lineup at the end of the bird numbering and reprices the registration.`
              : `The reserve you pick takes over ${bandOf(item)}'s bird number and fees, so the registration still bills the same. Its bet stakes are flagged for refund.`}
          </DialogDescription>
        </DialogHeader>

        {alreadyReplaced ? null : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This registration has no eligible reserve. A backup is eligible only if it is not
            marked lost and is not already carrying a perch fee.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {eligible.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelected(b.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selected === b.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="font-mono">{b.band}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {b.birdName ? <span>{b.birdName}</span> : null}
                  <Badge variant="secondary" className="text-[10px]">
                    backup {b.birdNo ?? "—"}
                  </Badge>
                </span>
              </button>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              Leave none selected to take the first eligible reserve, as HayLoft did.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          {alreadyReplaced ? (
            <Button onClick={restore} disabled={working}>
              {working ? "Restoring…" : "Restore bird"}
            </Button>
          ) : (
            <Button onClick={substitute} disabled={working || eligible.length === 0}>
              {working ? "Substituting…" : "Substitute"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
