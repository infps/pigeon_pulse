"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Settings } from "lucide-react";
import { toast } from "sonner";

function seasonLabel(s: Season) {
  const y1 = new Date(s.startDate).getFullYear();
  const y2 = new Date(s.endDate).getFullYear();
  return y1 === y2 ? `${s.name} (${y1})` : `${s.name} (${y1}–${y2})`;
}

function toDateInput(iso: string) {
  return iso ? iso.slice(0, 10) : "";
}

type SchemeOption = { id: number; name: string | null };

type SchemeBank = {
  feeSchemes: SchemeOption[];
  bettingSchemes: SchemeOption[];
  prizeSchemes: SchemeOption[];
};

function schemeLabel(schemes: SchemeOption[], id?: number | null) {
  if (!id) return <span className="text-muted-foreground text-xs">—</span>;
  const s = schemes.find((x) => x.id === id);
  return <span className="text-xs">{s?.name ?? `#${id}`}</span>;
}

type SeasonForm = {
  name: string;
  startDate: string;
  endDate: string;
  feeSchemeId: string;
  bettingSchemeId: string;
  finalPrizeSchemeId: string;
  hotSpot1PrizeSchemeId: string;
  hotSpot2PrizeSchemeId: string;
  hotSpot3PrizeSchemeId: string;
  hotSpotAvgPrizeSchemeId: string;
};

const EMPTY_FORM: SeasonForm = {
  name: "",
  startDate: "",
  endDate: "",
  feeSchemeId: "",
  bettingSchemeId: "",
  finalPrizeSchemeId: "",
  hotSpot1PrizeSchemeId: "",
  hotSpot2PrizeSchemeId: "",
  hotSpot3PrizeSchemeId: "",
  hotSpotAvgPrizeSchemeId: "",
};

function seasonToForm(s: Season): SeasonForm {
  return {
    name: s.name,
    startDate: toDateInput(s.startDate),
    endDate: toDateInput(s.endDate),
    feeSchemeId: s.feeSchemeId?.toString() ?? "",
    bettingSchemeId: s.bettingSchemeId?.toString() ?? "",
    finalPrizeSchemeId: s.finalPrizeSchemeId?.toString() ?? "",
    hotSpot1PrizeSchemeId: s.hotSpot1PrizeSchemeId?.toString() ?? "",
    hotSpot2PrizeSchemeId: s.hotSpot2PrizeSchemeId?.toString() ?? "",
    hotSpot3PrizeSchemeId: s.hotSpot3PrizeSchemeId?.toString() ?? "",
    hotSpotAvgPrizeSchemeId: s.hotSpotAvgPrizeSchemeId?.toString() ?? "",
  };
}

function SchemeSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SchemeOption[];
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id.toString()}>
              {o.name ?? `#${o.id}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SeasonFormFields({
  form,
  setForm,
  bank,
}: {
  form: SeasonForm;
  setForm: (f: SeasonForm) => void;
  bank: SchemeBank;
}) {
  const set = (key: keyof SeasonForm) => (v: string) => setForm({ ...form, [key]: v });
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1 col-span-1">
          <Label className="text-xs">Name</Label>
          <Input className="h-8 text-xs" value={form.name} onChange={(e) => set("name")(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Start Date</Label>
          <Input className="h-8 text-xs" type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">End Date</Label>
          <Input className="h-8 text-xs" type="date" value={form.endDate} onChange={(e) => set("endDate")(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SchemeSelect label="Fee Scheme" value={form.feeSchemeId} onChange={set("feeSchemeId")} options={bank.feeSchemes} />
        <SchemeSelect label="Betting Scheme" value={form.bettingSchemeId} onChange={set("bettingSchemeId")} options={bank.bettingSchemes} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SchemeSelect label="Final Prize" value={form.finalPrizeSchemeId} onChange={set("finalPrizeSchemeId")} options={bank.prizeSchemes} />
        <SchemeSelect label="Hot Spot 1 Prize" value={form.hotSpot1PrizeSchemeId} onChange={set("hotSpot1PrizeSchemeId")} options={bank.prizeSchemes} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SchemeSelect label="Hot Spot 2 Prize" value={form.hotSpot2PrizeSchemeId} onChange={set("hotSpot2PrizeSchemeId")} options={bank.prizeSchemes} />
        <SchemeSelect label="Hot Spot 3 Prize" value={form.hotSpot3PrizeSchemeId} onChange={set("hotSpot3PrizeSchemeId")} options={bank.prizeSchemes} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SchemeSelect label="Hot Spot Avg Prize" value={form.hotSpotAvgPrizeSchemeId} onChange={set("hotSpotAvgPrizeSchemeId")} options={bank.prizeSchemes} />
      </div>
    </div>
  );
}

export function SeasonSelector({ eventId, isSuperAdmin }: { eventId: string; isSuperAdmin: boolean }) {
  const { seasons, selectedSeasonId, setSelectedSeasonId, refetchSeasons } = useSeasonContext();

  const [manageOpen, setManageOpen] = useState(false);
  const [bank, setBank] = useState<SchemeBank>({ feeSchemes: [], bettingSchemes: [], prizeSchemes: [] });
  const [bankLoaded, setBankLoaded] = useState(false);

  // new season sub-form
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<SeasonForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SeasonForm>(EMPTY_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // delete confirm
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (manageOpen && !bankLoaded) {
      Promise.all([
        fetch("/api/admin/fee-scheme", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/betting-scheme", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/prize-scheme", { credentials: "include" }).then((r) => r.json()),
      ]).then(([fs, bs, ps]) => {
        setBank({
          feeSchemes: fs.feeSchemes ?? [],
          bettingSchemes: bs.bettingSchemes ?? [],
          prizeSchemes: ps.prizeSchemes ?? [],
        });
        setBankLoaded(true);
      });
    }
  }, [manageOpen, bankLoaded]);

  async function handleCreate() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...newForm,
          feeSchemeId: newForm.feeSchemeId || null,
          bettingSchemeId: newForm.bettingSchemeId || null,
          finalPrizeSchemeId: newForm.finalPrizeSchemeId || null,
          hotSpot1PrizeSchemeId: newForm.hotSpot1PrizeSchemeId || null,
          hotSpot2PrizeSchemeId: newForm.hotSpot2PrizeSchemeId || null,
          hotSpot3PrizeSchemeId: newForm.hotSpot3PrizeSchemeId || null,
          hotSpotAvgPrizeSchemeId: newForm.hotSpotAvgPrizeSchemeId || null,
        }),
      });
      if (res.ok) {
        const { season } = await res.json();
        setShowNew(false);
        setNewForm(EMPTY_FORM);
        refetchSeasons();
        setSelectedSeasonId(season.id);
        toast.success("Season created");
      } else {
        const { message } = await res.json();
        toast.error(message ?? "Failed to create season");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(s: Season) {
    setEditingId(s.id);
    setEditForm(seasonToForm(s));
  }

  async function handleEdit() {
    if (!editingId) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/seasons/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          feeSchemeId: editForm.feeSchemeId || null,
          bettingSchemeId: editForm.bettingSchemeId || null,
          finalPrizeSchemeId: editForm.finalPrizeSchemeId || null,
          hotSpot1PrizeSchemeId: editForm.hotSpot1PrizeSchemeId || null,
          hotSpot2PrizeSchemeId: editForm.hotSpot2PrizeSchemeId || null,
          hotSpot3PrizeSchemeId: editForm.hotSpot3PrizeSchemeId || null,
          hotSpotAvgPrizeSchemeId: editForm.hotSpotAvgPrizeSchemeId || null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        refetchSeasons();
        toast.success("Season updated");
      } else {
        const { message } = await res.json();
        toast.error(message ?? "Failed to update season");
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/admin/event/${eventId}/seasons/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setDeletingId(null);
      refetchSeasons();
      toast.success("Season deleted");
    } else {
      const { message } = await res.json();
      toast.error(message ?? "Failed to delete season");
      setDeletingId(null);
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
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
            <Settings className="h-3.5 w-3.5 mr-1" />
            Manage Seasons
          </Button>

          {/* ── Manage Seasons dialog ── */}
          <Dialog open={manageOpen} onOpenChange={(o) => { setManageOpen(o); if (!o) { setShowNew(false); setEditingId(null); setDeletingId(null); } }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Manage Seasons</DialogTitle>
              </DialogHeader>

              {/* Seasons table */}
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-xs">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-xs">Dates</th>
                      <th className="px-3 py-2 text-left font-medium text-xs">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-xs">Fee Scheme</th>
                      <th className="px-3 py-2 text-left font-medium text-xs">Betting Scheme</th>
                      <th className="px-3 py-2 text-left font-medium text-xs">Final Prize</th>
                      <th className="px-3 py-2 text-right font-medium text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasons.map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium text-xs">{s.name}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {toDateInput(s.startDate)} → {toDateInput(s.endDate)}
                        </td>
                        <td className="px-3 py-2">
                          {s.isActive
                            ? <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>
                            : <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactive</Badge>
                          }
                        </td>
                        <td className="px-3 py-2">{schemeLabel(bank.feeSchemes, s.feeSchemeId)}</td>
                        <td className="px-3 py-2">{schemeLabel(bank.bettingSchemes, s.bettingSchemeId)}</td>
                        <td className="px-3 py-2">{schemeLabel(bank.prizeSchemes, s.finalPrizeSchemeId)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => editingId === s.id ? setEditingId(null) : startEdit(s)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              disabled={s.isActive}
                              onClick={() => setDeletingId(s.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {seasons.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">No seasons yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Edit panel */}
              {editingId !== null && (
                <div className="rounded-md border p-4 bg-muted/20">
                  <p className="text-xs font-semibold mb-3">Edit Season</p>
                  <SeasonFormFields form={editForm} setForm={setEditForm} bank={bank} />
                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={editSubmitting || !editForm.name || !editForm.startDate || !editForm.endDate}
                      onClick={handleEdit}
                    >
                      {editSubmitting ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              )}

              {/* New season panel */}
              {showNew && (
                <div className="rounded-md border p-4 bg-muted/20">
                  <p className="text-xs font-semibold mb-3">New Season</p>
                  <SeasonFormFields form={newForm} setForm={setNewForm} bank={bank} />
                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => { setShowNew(false); setNewForm(EMPTY_FORM); }}>Cancel</Button>
                    <Button
                      size="sm"
                      disabled={submitting || !newForm.name || !newForm.startDate || !newForm.endDate}
                      onClick={handleCreate}
                    >
                      {submitting ? "Creating…" : "Create Season"}
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter>
                {!showNew && (
                  <Button variant="outline" size="sm" onClick={() => { setShowNew(true); setEditingId(null); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    New Season
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setManageOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete confirm dialog */}
          <Dialog open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete Season</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Delete <span className="font-medium text-foreground">{seasons.find((s) => s.id === deletingId)?.name}</span>? This cannot be undone.
              </p>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={() => deletingId && handleDelete(deletingId)}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
