"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiEndpoints } from "@/lib/endpoints";
import type { RaceItem } from "@/lib/types";

type ManualStatus = "IGNORED" | "STRAY" | "LOST" | "ARRIVED";

const OPTIONS: Array<{ value: ManualStatus; label: string; blurb: string }> = [
  {
    value: "IGNORED",
    label: "Did not fly",
    blurb: "Drop this bird from the results. Everything behind it moves up a place.",
  },
  {
    value: "STRAY",
    label: "Stray",
    blurb: "A lost bird that turned up with a later flock. Recorded, but takes no position.",
  },
  {
    value: "LOST",
    label: "Lost",
    blurb: "The bird did not come home. Removed from the results and flagged on the bird.",
  },
  {
    value: "ARRIVED",
    label: "Put back in the results",
    blurb: "Undo the above. Needs an arrival scan on record.",
  },
];

function bandOf(item: RaceItem | null): string {
  const b = item?.bird;
  if (!b) return "this bird";
  return [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") || b.band || "this bird";
}

/**
 * Set a bird's race status by hand — the states no scan produces.
 *
 * Any change re-ranks the race, because removing or restoring a bird shifts
 * every position behind it, so the dialog reports what moved.
 */
export function RaceStatusDialog({
  item,
  open,
  onOpenChange,
  onDone,
}: {
  item: RaceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<ManualStatus | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    if (!item || !selected) return;
    setSaving(true);
    try {
      const res = await fetch(apiEndpoints.raceItems.raceStatus(item.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not change the status");
        return;
      }
      toast.success(data.message);
      setSelected(null);
      setNote("");
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change race status</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{bandOf(item)}</span>
            {item?.status ? (
              <>
                {" is currently "}
                <Badge variant="secondary" className="text-[10px]">
                  {item.status}
                </Badge>
                .
              </>
            ) : null}{" "}
            Changing it re-ranks the whole race and recalculates prize money.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                selected === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{opt.blurb}</div>
            </button>
          ))}
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why (optional) — kept in the bird's history"
          rows={2}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={saving || !selected}>
            {saving ? "Applying…" : "Apply and re-rank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
