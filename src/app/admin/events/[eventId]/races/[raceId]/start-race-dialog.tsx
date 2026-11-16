"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEventBaskets } from "@/lib/api/event-baskets";
import type { EventBasketItem } from "@/lib/types";

interface StartRaceDialogProps {
  eventId: string;
  raceId: string;
  isPending: boolean;
  onStart: (basketIds: number[] | undefined, liberatedAt: string) => void;
}

export function StartRaceDialog({ eventId, raceId, isPending, onStart }: StartRaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // datetime-local value in the operator's local time; sent as ISO.
  const [liberatedAt, setLiberatedAt] = useState("");

  const { data } = useEventBaskets(eventId, "LOFT");
  const loftBaskets: EventBasketItem[] = (data?.baskets ?? []).filter(
    (b: EventBasketItem) => b.phase === "LOFT"
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleOpen() {
    setSelected(new Set(loftBaskets.map((b) => b.id)));
    const now = new Date();
    now.setSeconds(0, 0);
    setLiberatedAt(new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    setOpen(true);
  }

  function handleConfirm() {
    const all = selected.size === loftBaskets.length;
    const at = liberatedAt ? new Date(liberatedAt) : new Date();
    onStart(all ? undefined : Array.from(selected), at.toISOString());
    setOpen(false);
  }

  return (
    <>
      <Button
        onClick={handleOpen}
        disabled={isPending}
        size="sm"
        className="gap-2 bg-green-600 hover:bg-green-700"
      >
        <Play className="h-4 w-4" />
        {isPending ? "Starting..." : "Start Race"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start Race — Select Baskets</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="liberated-at">Liberation time</Label>
            <Input
              id="liberated-at"
              type="datetime-local"
              step={1}
              value={liberatedAt}
              onChange={(e) => setLiberatedAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Actual release time at the station. All speeds use this.</p>
          </div>

          {loftBaskets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No loft baskets found. All birds will be released.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {loftBaskets.map((basket) => {
                const count = basket._count?.assignments ?? basket.assignments?.length ?? 0;
                return (
                  <label
                    key={basket.id}
                    className="flex items-center gap-3 px-2 py-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(basket.id)}
                      onCheckedChange={() => toggle(basket.id)}
                    />
                    <span className="flex-1 text-sm font-medium">
                      {basket.label ?? `Basket #${basket.basketNo}`}
                    </span>
                    <Badge variant="secondary" className="text-xs">{count} birds</Badge>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              className="underline"
              onClick={() => setSelected(new Set(loftBaskets.map((b) => b.id)))}
            >
              Select all
            </button>
            <span>·</span>
            <button
              type="button"
              className="underline"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              disabled={selected.size === 0 && loftBaskets.length > 0}
              onClick={handleConfirm}
            >
              Release {selected.size} basket{selected.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
