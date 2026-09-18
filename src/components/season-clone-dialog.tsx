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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface IncludeOption {
  key: keyof IncludeState;
  label: string;
  blurb: string;
}

interface IncludeState {
  schemes: boolean;
  stations: boolean;
  races: boolean;
  prizeValues: boolean;
  statusPresets: boolean;
  averageConfigs: boolean;
  raceNumbers: boolean;
  calcutta: boolean;
  registrations: boolean;
}

const OPTIONS: IncludeOption[] = [
  { key: "schemes", label: "Schemes", blurb: "Fee, betting and all five prize scheme assignments" },
  { key: "stations", label: "Liberation stations", blurb: "With their race-type links" },
  { key: "races", label: "Race schedule", blurb: "Type, number, name, station and distance — no results" },
  { key: "prizeValues", label: "Prize values", blurb: "What each band actually pays this season" },
  { key: "statusPresets", label: "Status presets", blurb: "Configurable display statuses" },
  { key: "raceNumbers", label: "Race number ranges", blurb: "Per number group" },
  { key: "averageConfigs", label: "Average configs", blurb: "Remapped onto the copied races" },
  { key: "calcutta", label: "Calcutta settings", blurb: "Reset to the setup phase" },
  { key: "registrations", label: "Registration roster", blurb: "Breeders and their birds, repriced — no payments" },
];

const DEFAULTS: IncludeState = {
  schemes: true,
  stations: true,
  races: true,
  prizeValues: true,
  statusPresets: true,
  averageConfigs: true,
  raceNumbers: true,
  calcutta: false,
  registrations: false,
};

/**
 * Stand up a new season from an existing one.
 *
 * Copies configuration only — results, payments, bets, baskets and groups never
 * carry forward, so the new season starts clean.
 */
export function SeasonCloneDialog({
  eventId,
  season,
  open,
  onOpenChange,
  onDone,
}: {
  eventId: string | number;
  season: { id: number; name: string; startDate: string; endDate: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activate, setActivate] = useState(false);
  const [include, setInclude] = useState<IncludeState>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  // Default to the same window one year on — the usual case.
  useEffect(() => {
    if (!open || !season) return;
    const shift = (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    };
    const nextYear = new Date(season.startDate).getFullYear() + 1;
    setName(`${season.name.replace(/\d{4}/, "").trim() || season.name} ${nextYear}`.trim());
    setStartDate(shift(season.startDate));
    setEndDate(shift(season.endDate));
    setActivate(false);
    setInclude(DEFAULTS);
  }, [open, season]);

  const submit = async () => {
    if (!season) return;
    if (!name.trim()) {
      toast.error("Give the new season a name");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Set both a start and an end date");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/event/${eventId}/seasons/${season.id}/clone`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), startDate, endDate, activate, include }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Could not copy the season");
        return;
      }
      toast.success(data.message);
      for (const note of data.summary?.skipped ?? []) toast.warning(note);
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Copy season</DialogTitle>
          <DialogDescription>
            Builds a new season from{" "}
            <span className="font-medium">{season?.name ?? "this season"}</span>. Configuration only
            — results, payments, bets, baskets and groups are never copied, and copied races start
            with no times or weather.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="clone-name">New season name</Label>
            <Input id="clone-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="clone-start">Starts</Label>
              <Input
                id="clone-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clone-end">Ends</Label>
              <Input
                id="clone-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>What to copy</Label>
            <div className="space-y-2 rounded-md border p-3">
              {OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={include[opt.key]}
                    onCheckedChange={(checked) =>
                      setInclude((prev) => ({ ...prev, [opt.key]: checked === true }))
                    }
                    className="mt-0.5"
                  />
                  <span className="text-sm leading-tight">
                    {opt.label}
                    <span className="block text-xs text-muted-foreground">{opt.blurb}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={activate}
              onCheckedChange={(checked) => setActivate(checked === true)}
            />
            <span className="text-sm">
              Make this the active season
              <span className="block text-xs text-muted-foreground">
                The current active season for this event is stood down.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Copying…" : "Copy season"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
