"use client";

import { useState } from "react";
import { useSeasonContext, type Season } from "@/lib/season-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function seasonLabel(s: Season) {
  const y1 = new Date(s.startDate).getFullYear();
  const y2 = new Date(s.endDate).getFullYear();
  return y1 === y2 ? `${s.name} (${y1})` : `${s.name} (${y1}–${y2})`;
}

export function SeasonSelector({ eventId, isSuperAdmin }: { eventId: string; isSuperAdmin: boolean }) {
  const { seasons, selectedSeasonId, setSelectedSeasonId, refetchSeasons } = useSeasonContext();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const { season } = await res.json();
        setOpen(false);
        setForm({ name: "", startDate: "", endDate: "" });
        refetchSeasons();
        setSelectedSeasonId(season.id);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedSeasonId?.toString() ?? ""}
        onValueChange={(v) => setSelectedSeasonId(parseInt(v))}
        disabled={seasons.length === 0}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="No season" />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((s) => (
            <SelectItem key={s.id} value={s.id.toString()}>
              {seasonLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isSuperAdmin && (
        <>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            New Season
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Season</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1">
                  <Label htmlFor="s-name">Name</Label>
                  <Input id="s-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="s-start">Start Date</Label>
                  <Input id="s-start" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="s-end">End Date</Label>
                  <Input id="s-end" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={submitting || !form.name || !form.startDate || !form.endDate} onClick={handleCreate}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
