"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Syringe,
  Trash2,
  Upload,
  X,
  Pencil,
  History,
} from "lucide-react";
import { apiEndpoints } from "@/lib/endpoints";

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupType = "LOFT" | "TAG_COLOR" | "STATUS" | "DEFAULTER" | "CUSTOM";

interface VaccinationRecord {
  id: number;
  eventGroupId: number;
  vaccineName: string;
  vaccinationDate: string;
  vet: string | null;
  batchNo: string | null;
  notes: string | null;
  documentUrl: string | null;
  documentKey: string | null;
  createdAt: string;
}

interface GroupMember {
  id: number;
  currentGroupId: number | null;
  bird: {
    id: number;
    band: string | null;
    band1: string | null;
    band2: string | null;
    band3: string | null;
    band4: string | null;
    color: string | null;
  } | null;
  eventInventory: {
    breeder: { id: number; firstName: string | null; lastName: string | null } | null;
  } | null;
  groupHistory: { fromGroupName: string; movedAt: string }[];
  breederHistory: { fromBreederName: string; transferredAt: string }[];
}

interface EventGroup {
  id: number;
  eventId: number;
  name: string;
  type: GroupType;
  status: "OPEN" | "CLOSED";
  hasCapacity: boolean;
  capacity: number | null;
  color: string | null;
  statusCodeId: number | null;
  notes: string | null;
  createdAt: string;
  statusCode: { id: number; code: number; label: string; color: string | null } | null;
  _count: { members: number; vaccinations: number };
  vaccinations: VaccinationRecord[];
  members: GroupMember[];
}

interface BirdStatusCode {
  id: number;
  code: number;
  label: string;
  color: string | null;
}

interface InventoryItem {
  id: number;
  bird: { id: number; band: string | null; band1: string | null; band2: string | null; band3: string | null; band4: string | null; color: string | null } | null;
}
interface EventInventory {
  id: number;
  breeder: { id: number; firstName: string | null; lastName: string | null } | null;
  items: InventoryItem[];
}

interface BirdEventHistoryEntry {
  id: number;
  action: string;
  detail: string | null;
  createdAt: string;
  performedBy: { name: string | null } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<GroupType, string> = {
  LOFT: "Loft",
  TAG_COLOR: "Tag Color",
  STATUS: "Status",
  DEFAULTER: "Defaulter",
  CUSTOM: "Custom",
};

const TYPE_BADGE_CLASS: Record<GroupType, string> = {
  LOFT: "bg-green-100 text-green-800",
  TAG_COLOR: "bg-blue-100 text-blue-800",
  STATUS: "bg-purple-100 text-purple-800",
  DEFAULTER: "bg-red-100 text-red-800",
  CUSTOM: "bg-gray-100 text-gray-800",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBandLabel(bird: GroupMember["bird"]) {
  if (!bird) return "?";
  return (
    [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-") ||
    bird.band ||
    "?"
  );
}

function CapacityBar({ count, capacity }: { count: number; capacity: number }) {
  const pct = Math.min((count / capacity) * 100, 100);
  const color = pct >= 85 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">
        {count}/{capacity} ({Math.round(pct)}%)
      </span>
    </div>
  );
}

function TypeBadge({ type }: { type: GroupType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

// ─── VaccinationForm ──────────────────────────────────────────────────────────

function VaccinationForm({
  eventId,
  groupId,
  onSaved,
}: {
  eventId: string;
  groupId: number;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ vaccineName: "", vaccinationDate: "", vet: "", batchNo: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vaccineName || !form.vaccinationDate) { toast.error("Vaccine name and date required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/groups/${groupId}/vaccinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Vaccination record added");
      setForm({ vaccineName: "", vaccinationDate: "", vet: "", batchNo: "", notes: "" });
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/30">
      <div className="col-span-2 grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Vaccine Name *</Label>
          <Input value={form.vaccineName} onChange={(e) => setForm((f) => ({ ...f, vaccineName: e.target.value }))} placeholder="e.g. Newcastle" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Date *</Label>
          <Input type="date" value={form.vaccinationDate} onChange={(e) => setForm((f) => ({ ...f, vaccinationDate: e.target.value }))} className="mt-1 h-8 text-sm" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Vet</Label>
        <Input value={form.vet} onChange={(e) => setForm((f) => ({ ...f, vet: e.target.value }))} placeholder="Vet name" className="mt-1 h-8 text-sm" />
      </div>
      <div>
        <Label className="text-xs">Batch No</Label>
        <Input value={form.batchNo} onChange={(e) => setForm((f) => ({ ...f, batchNo: e.target.value }))} placeholder="Batch / lot" className="mt-1 h-8 text-sm" />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 text-sm" />
      </div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Add Record"}</Button>
      </div>
    </form>
  );
}

// ─── DocumentUpload ───────────────────────────────────────────────────────────

function DocumentUpload({ eventId, groupId, vacId, documentUrl, onChanged }: {
  eventId: string; groupId: number; vacId: number; documentUrl: string | null; onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("document", file);
      const res = await fetch(`/api/admin/event/${eventId}/groups/${groupId}/vaccinations/${vacId}/document`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Document uploaded");
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/admin/event/${eventId}/groups/${groupId}/vaccinations/${vacId}/document`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Document removed");
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (documentUrl) {
    return (
      <div className="flex items-center gap-2">
        <a href={documentUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline truncate max-w-[120px]">View doc</a>
        <button onClick={handleDelete} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  return (
    <label className="cursor-pointer flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <Upload className="h-3 w-3" />
      {uploading ? "Uploading…" : "Upload doc"}
      <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFile} disabled={uploading} />
    </label>
  );
}

const ACTION_BADGE: Record<string, string> = {
  RFID_LINKED:     "bg-blue-100 text-blue-800",
  BASKET_ASSIGNED: "bg-orange-100 text-orange-800",
  GROUP_ASSIGNED:  "bg-green-100 text-green-800",
  GROUP_MOVED:     "bg-yellow-100 text-yellow-800",
  GROUP_REMOVED:   "bg-red-100 text-red-800",
  STATUS_CHANGED:  "bg-purple-100 text-purple-800",
  RELEASED:        "bg-gray-100 text-gray-700",
  ARRIVED:         "bg-emerald-100 text-emerald-800",
};

function BirdEventHistorySheet({
  open,
  onOpenChange,
  eventId,
  itemId,
  bandLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  itemId: number;
  bandLabel: string;
}) {
  const [entries, setEntries] = useState<BirdEventHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setEntries(null);
    fetch(`/api/admin/event/${eventId}/bird-history?itemId=${itemId}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.history ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, eventId, itemId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>History — {bandLabel}</SheetTitle>
        </SheetHeader>
        {loading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
        {!loading && entries?.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No history yet</p>
        )}
        {!loading && entries && entries.length > 0 && (
          <div className="mt-4 space-y-3">
            {entries.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground mt-1" />
                  <div className="w-px flex-1 bg-border" />
                </div>
                <div className="pb-3 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_BADGE[e.action] ?? "bg-gray-100 text-gray-700"}`}>
                      {e.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  {e.detail && <p className="mt-0.5 text-sm">{e.detail}</p>}
                  {e.performedBy?.name && <p className="text-xs text-muted-foreground">{e.performedBy.name}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── BirdRow ──────────────────────────────────────────────────────────────────

function BirdRow({ member, eventId, groupId, otherGroups, onMutated }: {
  member: GroupMember;
  eventId: string;
  groupId: number;
  otherGroups: EventGroup[];
  onMutated: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasHistory = member.groupHistory.length > 0 || member.breederHistory.length > 0;
  const bandLabel = getBandLabel(member.bird);

  async function handleMove(toGroupId: string) {
    const res = await fetch(`/api/admin/event/${eventId}/groups/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventInventoryItemId: member.id, toGroupId: parseInt(toGroupId) }),
    });
    if (!res.ok) { toast.error((await res.json()).message ?? "Move failed"); return; }
    toast.success("Bird moved");
    onMutated();
  }

  async function handleRemove() {
    const res = await fetch(`/api/admin/event/${eventId}/groups/${groupId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventInventoryItemId: member.id }),
    });
    if (!res.ok) { toast.error("Remove failed"); return; }
    toast.success("Bird removed");
    onMutated();
  }

  return (
    <div className="rounded border bg-muted/30 text-sm">
      <div className="flex items-center gap-2 px-2 py-1.5">
        {member.bird?.id ? (
          <Link href={`/admin/birds/${member.bird.id}`} className="font-mono text-xs hover:underline">
            {getBandLabel(member.bird)}
          </Link>
        ) : (
          <span className="font-mono text-xs">{getBandLabel(member.bird)}</span>
        )}
        {member.bird?.color && <span className="text-xs text-muted-foreground">{member.bird.color}</span>}
        {member.eventInventory?.breeder && (
          <span className="text-xs text-muted-foreground ml-auto">
            {[member.eventInventory.breeder.firstName, member.eventInventory.breeder.lastName].filter(Boolean).join(" ")}
          </span>
        )}
        {hasHistory && (
          <button onClick={() => setShowHistory((v) => !v)} className="text-muted-foreground hover:text-foreground">
            <History className="h-3 w-3" />
          </button>
        )}
        <button onClick={() => setHistoryOpen(true)} className="text-muted-foreground hover:text-foreground" title="Bird event history">
          <Clock className="h-3 w-3" />
        </button>
        {otherGroups.length > 0 && (
          <Select onValueChange={handleMove}>
            <SelectTrigger className="h-6 w-24 text-xs">
              <SelectValue placeholder="Move…" />
            </SelectTrigger>
            <SelectContent>
              {otherGroups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleRemove}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
      {showHistory && hasHistory && (
        <div className="border-t px-2 py-1.5 space-y-0.5 text-xs text-muted-foreground">
          {member.groupHistory.map((h, i) => (
            <p key={i}>Group: {h.fromGroupName} → here ({new Date(h.movedAt).toLocaleDateString()})</p>
          ))}
          {member.breederHistory.map((h, i) => (
            <p key={i}>Breeder: {h.fromBreederName} ({new Date(h.transferredAt).toLocaleDateString()})</p>
          ))}
        </div>
      )}
      <BirdEventHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        eventId={eventId}
        itemId={member.id}
        bandLabel={bandLabel}
      />
    </div>
  );
}

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  eventId,
  allGroups,
  inventoryItems,
  statusCodes,
  onMutated,
}: {
  group: EventGroup;
  eventId: string;
  allGroups: EventGroup[];
  inventoryItems: { id: number; label: string }[];
  statusCodes: BirdStatusCode[];
  onMutated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showVacForm, setShowVacForm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: group.name,
    type: group.type,
    status: group.status,
    hasCapacity: group.hasCapacity,
    capacity: group.capacity ? String(group.capacity) : "150",
    color: group.color ?? "",
    statusCodeId: group.statusCodeId ? String(group.statusCodeId) : "",
    notes: group.notes ?? "",
  });

  const memberIds = new Set(group.members.map((m) => m.id));
  const available = inventoryItems.filter((i) => !memberIds.has(i.id));
  const otherGroups = allGroups.filter((g) => g.id !== group.id);
  const isLoft = group.type === "LOFT";

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(apiEndpoints.groups.byId(eventId, group.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          status: editForm.status,
          hasCapacity: editForm.hasCapacity,
          capacity: editForm.hasCapacity ? parseInt(editForm.capacity) || 150 : null,
          color: editForm.color || null,
          statusCodeId: editForm.statusCodeId ? parseInt(editForm.statusCodeId) : null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Group updated");
      setEditOpen(false);
      onMutated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${group.name}"? Members will be ungrouped.`)) return;
    const res = await fetch(apiEndpoints.groups.byId(eventId, group.id), { method: "DELETE" });
    if (!res.ok) { toast.error("Delete failed"); return; }
    toast.success(`"${group.name}" deleted`);
    onMutated();
  }

  async function handleAddBird() {
    if (!addItemId) return;
    const res = await fetch(apiEndpoints.groups.members(eventId, group.id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventInventoryItemIds: [parseInt(addItemId)] }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.message); return; }
    toast.success("Bird added");
    setAddItemId("");
    onMutated();
  }

  async function deleteVaccination(vacId: number) {
    const res = await fetch(`/api/admin/event/${eventId}/groups/${group.id}/vaccinations/${vacId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Delete failed"); return; }
    toast.success("Record deleted");
    onMutated();
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold">{group.name}</span>
          <TypeBadge type={group.type} />
          {group.color && <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: group.color }} />}
          {group.statusCode && <Badge variant="outline" className="text-xs">{group.statusCode.label}</Badge>}
          <Badge variant={group.status === "OPEN" ? "default" : "secondary"}>{group.status}</Badge>
          {group._count.vaccinations > 0 && (
            <Badge variant="outline" className="gap-1"><Syringe className="h-3 w-3" />{group._count.vaccinations}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {group.hasCapacity && group.capacity !== null && (
            <CapacityBar count={group._count.members} capacity={group.capacity} />
          )}
          {!group.hasCapacity && (
            <span className="text-xs text-muted-foreground">{group._count.members} birds</span>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setEditForm({ name: group.name, type: group.type, status: group.status, hasCapacity: group.hasCapacity, capacity: group.capacity ? String(group.capacity) : "150", color: group.color ?? "", statusCodeId: group.statusCodeId ? String(group.statusCodeId) : "", notes: group.notes ?? "" }); setEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {group.notes && <p className="text-sm text-muted-foreground">{group.notes}</p>}

          {/* Add bird */}
          <div className="flex gap-2">
            <Select value={addItemId} onValueChange={setAddItemId}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder="Select bird to add…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddBird} disabled={!addItemId}>
              <Plus className="h-4 w-4 mr-1" />Add
            </Button>
          </div>

          {/* Members */}
          <div>
            <p className="text-sm font-medium mb-2">Birds ({group._count.members})</p>
            {group.members.length === 0 ? (
              <p className="text-xs text-muted-foreground">No birds yet</p>
            ) : (
              <div className="space-y-1">
                {group.members.map((m) => (
                  <BirdRow
                    key={m.id}
                    member={m}
                    eventId={eventId}
                    groupId={group.id}
                    otherGroups={otherGroups}
                    onMutated={onMutated}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Vaccinations */}
          {(isLoft || group.vaccinations.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Vaccination Records</p>
                <Button size="sm" variant="outline" onClick={() => setShowVacForm((v) => !v)} className="gap-1">
                  <Plus className="h-3 w-3" />Add
                </Button>
              </div>
              {showVacForm && (
                <VaccinationForm eventId={eventId} groupId={group.id} onSaved={() => { setShowVacForm(false); onMutated(); }} />
              )}
              {group.vaccinations.length === 0 && !showVacForm && (
                <p className="text-xs text-muted-foreground">No records yet</p>
              )}
              {group.vaccinations.map((v) => (
                <div key={v.id} className="mt-2 rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium">{v.vaccineName}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{new Date(v.vaccinationDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DocumentUpload eventId={eventId} groupId={group.id} vacId={v.id} documentUrl={v.documentUrl} onChanged={onMutated} />
                      <button onClick={() => deleteVaccination(v.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {v.vet && <p className="text-xs text-muted-foreground">Vet: {v.vet}</p>}
                  {v.batchNo && <p className="text-xs text-muted-foreground">Batch: {v.batchNo}</p>}
                  {v.notes && <p className="text-xs">{v.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Group</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" required />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm((f) => ({ ...f, type: v as GroupType, statusCodeId: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOFT">Loft</SelectItem>
                  <SelectItem value="TAG_COLOR">Tag Color</SelectItem>
                  <SelectItem value="STATUS">Status</SelectItem>
                  <SelectItem value="DEFAULTER">Defaulter</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as "OPEN" | "CLOSED" }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.hasCapacity}
                  onChange={(e) => setEditForm((f) => ({ ...f, hasCapacity: e.target.checked }))}
                />
                Has Capacity Limit
              </Label>
            </div>
            {editForm.hasCapacity && (
              <div>
                <Label>Capacity</Label>
                <Input type="number" value={editForm.capacity} onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))} min={1} className="mt-1" />
              </div>
            )}
            <div>
              <Label>Color (optional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={editForm.color || "#000000"} onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))} className="h-8 w-12 cursor-pointer rounded border" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditForm((f) => ({ ...f, color: "" }))}>Clear</Button>
              </div>
            </div>
            {editForm.type === "STATUS" && (
              <div>
                <Label>Status Code</Label>
                <Select value={editForm.statusCodeId} onValueChange={(v) => setEditForm((f) => ({ ...f, statusCodeId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select status code…" /></SelectTrigger>
                  <SelectContent>
                    {statusCodes.map((sc) => (
                      <SelectItem key={sc.id} value={String(sc.id)}>{sc.label} ({sc.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── GroupsTab ────────────────────────────────────────────────────────────────

export function GroupsTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newForm, setNewForm] = useState<{
    name: string; type: GroupType; color: string; statusCodeId: string; notes: string; hasCapacity: boolean; capacity: string;
  }>({ name: "", type: "LOFT", color: "", statusCodeId: "", notes: "", hasCapacity: true, capacity: "150" });
  const [creating, setCreating] = useState(false);

  const { data: groupsData, isPending, isError } = useQuery<{ groups: EventGroup[] }>({
    queryKey: ["groups", eventId],
    queryFn: () => fetch(apiEndpoints.groups.base(eventId)).then((r) => r.json()),
  });

  const { data: statusCodesData } = useQuery<{ codes: BirdStatusCode[] }>({
    queryKey: ["bird-status-codes"],
    queryFn: () => fetch(apiEndpoints.birdStatusCodes.base).then((r) => r.json()),
  });

  const { data: inventoryData } = useQuery<{ eventInventory: EventInventory[] }>({
    queryKey: ["event-inventory", eventId],
    queryFn: () => fetch(apiEndpoints.eventInventory.byEvent(eventId)).then((r) => r.json()),
  });

  function refetch() {
    qc.invalidateQueries({ queryKey: ["groups", eventId] });
  }

  const inventoryItems = (inventoryData?.eventInventory ?? []).flatMap((inv) =>
    (inv.items ?? []).map((item) => ({
      id: item.id,
      label: [
        item.bird
          ? [item.bird.band1, item.bird.band2, item.bird.band3, item.bird.band4].filter(Boolean).join("-") || item.bird.band || "?"
          : "?",
        item.bird?.color,
        inv.breeder ? `(${inv.breeder.lastName})` : "",
      ].filter(Boolean).join(" "),
    }))
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.name) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const res = await fetch(apiEndpoints.groups.base(eventId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForm.name,
          type: newForm.type,
          color: newForm.color || null,
          statusCodeId: newForm.statusCodeId ? parseInt(newForm.statusCodeId) : null,
          notes: newForm.notes || null,
          hasCapacity: newForm.hasCapacity,
          capacity: newForm.hasCapacity ? parseInt(newForm.capacity) || 150 : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Group "${newForm.name}" created`);
      setNewGroupOpen(false);
      setNewForm({ name: "", type: "LOFT", color: "", statusCodeId: "", notes: "", hasCapacity: true, capacity: "150" });
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  const groups = groupsData?.groups ?? [];
  const statusCodes = statusCodesData?.codes ?? [];

  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return <p className="p-4 text-destructive">Failed to load groups</p>;
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Groups</h3>
          <p className="text-sm text-muted-foreground">{groups.length} group{groups.length !== 1 ? "s" : ""} total</p>
        </div>
        <Button size="sm" onClick={() => setNewGroupOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />New Group
        </Button>
      </div>

      {/* Group cards */}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No groups yet. Create one to start organizing birds.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              eventId={eventId}
              allGroups={groups}
              inventoryItems={inventoryItems}
              statusCodes={statusCodes}
              onMutated={refetch}
            />
          ))}
        </div>
      )}

      {/* New group dialog */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Group</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Loft A, Red Tag, Hospital" className="mt-1" required />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newForm.type} onValueChange={(v) => setNewForm((f) => ({ ...f, type: v as GroupType, statusCodeId: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOFT">Loft (default)</SelectItem>
                  <SelectItem value="TAG_COLOR">Tag Color</SelectItem>
                  <SelectItem value="STATUS">Status</SelectItem>
                  <SelectItem value="DEFAULTER">Defaulter</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newForm.hasCapacity} onChange={(e) => setNewForm((f) => ({ ...f, hasCapacity: e.target.checked }))} />
                Has Capacity Limit
              </Label>
            </div>
            {newForm.hasCapacity && (
              <div>
                <Label>Capacity</Label>
                <Input type="number" value={newForm.capacity} onChange={(e) => setNewForm((f) => ({ ...f, capacity: e.target.value }))} min={1} className="mt-1" />
              </div>
            )}
            <div>
              <Label>Color (optional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={newForm.color || "#000000"} onChange={(e) => setNewForm((f) => ({ ...f, color: e.target.value }))} className="h-8 w-12 cursor-pointer rounded border" />
                <span className="text-sm text-muted-foreground">{newForm.color || "none"}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setNewForm((f) => ({ ...f, color: "" }))}>Clear</Button>
              </div>
            </div>
            {newForm.type === "STATUS" && (
              <div>
                <Label>Status Code</Label>
                <Select value={newForm.statusCodeId} onValueChange={(v) => setNewForm((f) => ({ ...f, statusCodeId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select status code…" /></SelectTrigger>
                  <SelectContent>
                    {statusCodes.map((sc) => (
                      <SelectItem key={sc.id} value={String(sc.id)}>{sc.label} ({sc.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNewGroupOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
