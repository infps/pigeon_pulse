"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Syringe,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface GroupsTabProps {
  eventId: string;
}

interface VaccinationRecord {
  id: number;
  loftGroupId: number;
  vaccineName: string;
  vaccinationDate: string;
  vet: string | null;
  batchNo: string | null;
  notes: string | null;
  documentUrl: string | null;
  documentKey: string | null;
  createdAt: string;
}

interface LoftGroupMember {
  id: number;
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
}

interface LoftGroup {
  id: number;
  eventId: number;
  groupNo: number;
  status: "OPEN" | "CLOSED";
  capacity: number;
  openedAt: string;
  closedAt: string | null;
  _count: { members: number; vaccinations: number };
  members: LoftGroupMember[];
  vaccinations: VaccinationRecord[];
}

function getBandLabel(bird: LoftGroupMember["bird"]) {
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

function VaccinationForm({
  eventId,
  groupId,
  onSaved,
}: {
  eventId: string;
  groupId: number;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    vaccineName: "",
    vaccinationDate: "",
    vet: "",
    batchNo: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vaccineName || !form.vaccinationDate) {
      toast.error("Vaccine name and date required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/event/${eventId}/loft-groups/${groupId}/vaccinations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Vaccination record added");
      setForm({ vaccineName: "", vaccinationDate: "", vet: "", batchNo: "", notes: "" });
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/30">
      <div className="col-span-2 grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Vaccine Name *</Label>
          <Input
            value={form.vaccineName}
            onChange={(e) => setForm((f) => ({ ...f, vaccineName: e.target.value }))}
            placeholder="e.g. Newcastle"
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Date *</Label>
          <Input
            type="date"
            value={form.vaccinationDate}
            onChange={(e) => setForm((f) => ({ ...f, vaccinationDate: e.target.value }))}
            className="mt-1 h-8 text-sm"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Vet</Label>
        <Input
          value={form.vet}
          onChange={(e) => setForm((f) => ({ ...f, vet: e.target.value }))}
          placeholder="Vet name"
          className="mt-1 h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">Batch No</Label>
        <Input
          value={form.batchNo}
          onChange={(e) => setForm((f) => ({ ...f, batchNo: e.target.value }))}
          placeholder="Batch / lot number"
          className="mt-1 h-8 text-sm"
        />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="mt-1 text-sm"
        />
      </div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Add Record"}
        </Button>
      </div>
    </form>
  );
}

function DocumentUpload({
  eventId,
  groupId,
  vacId,
  documentUrl,
  onChanged,
}: {
  eventId: string;
  groupId: number;
  vacId: number;
  documentUrl: string | null;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("document", file);
      const res = await fetch(
        `/api/admin/event/${eventId}/loft-groups/${groupId}/vaccinations/${vacId}/document`,
        { method: "POST", body: fd }
      );
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Document uploaded");
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(
        `/api/admin/event/${eventId}/loft-groups/${groupId}/vaccinations/${vacId}/document`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Document removed");
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  if (documentUrl) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={documentUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 underline truncate max-w-[120px]"
        >
          View doc
        </a>
        <button onClick={handleDelete} className="text-muted-foreground hover:text-destructive">
          <X className="h-3 w-3" />
        </button>
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

function GroupCard({
  group,
  eventId,
  onMutated,
}: {
  group: LoftGroup;
  eventId: string;
  onMutated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showVacForm, setShowVacForm] = useState(false);

  const isOpen = group.status === "OPEN";

  async function toggleStatus() {
    const newStatus = isOpen ? "CLOSED" : "OPEN";
    const res = await fetch(`/api/admin/event/${eventId}/loft-groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.message); return; }
    toast.success(newStatus === "CLOSED" ? "Group closed" : "Group reopened");
    onMutated();
  }

  async function handleDelete() {
    if (!confirm(`Delete Group ${group.groupNo}? Members will be ungrouped.`)) return;
    const res = await fetch(`/api/admin/event/${eventId}/loft-groups/${group.id}`, {
      method: "DELETE",
    });
    if (!res.ok) { toast.error("Delete failed"); return; }
    toast.success(`Group ${group.groupNo} deleted`);
    onMutated();
  }

  async function deleteVaccination(vacId: number) {
    const res = await fetch(
      `/api/admin/event/${eventId}/loft-groups/${group.id}/vaccinations/${vacId}`,
      { method: "DELETE" }
    );
    if (!res.ok) { toast.error("Delete failed"); return; }
    toast.success("Record deleted");
    onMutated();
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold">Group {group.groupNo}</span>
          <Badge variant={isOpen ? "default" : "secondary"}>
            {isOpen ? "OPEN" : "CLOSED"}
          </Badge>
          {group._count.vaccinations > 0 && (
            <Badge variant="outline" className="gap-1">
              <Syringe className="h-3 w-3" />
              {group._count.vaccinations}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <CapacityBar count={group._count.members} capacity={group.capacity} />
          <Button size="sm" variant={isOpen ? "outline" : "secondary"} onClick={toggleStatus}>
            {isOpen ? "Close" : "Reopen"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
            {/* Timestamps */}
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>Opened: {new Date(group.openedAt).toLocaleString()}</span>
              {group.closedAt && (
                <span>Closed: {new Date(group.closedAt).toLocaleString()}</span>
              )}
            </div>

            {/* Members */}
            <div>
              <p className="text-sm font-medium mb-2">
                Birds ({group._count.members})
              </p>
              {group.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">No birds scanned yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                  {group.members.map((m) => (
                    <div key={m.id} className="text-xs flex items-center gap-2 rounded px-2 py-1 bg-muted/40">
                      <span className="font-mono">{getBandLabel(m.bird)}</span>
                      {m.bird?.color && <span className="text-muted-foreground">{m.bird.color}</span>}
                      {m.eventInventory?.breeder && (
                        <span className="text-muted-foreground ml-auto">
                          {m.eventInventory.breeder.lastName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vaccinations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Vaccination Records</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowVacForm((v) => !v)}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              </div>

              {showVacForm && (
                <VaccinationForm
                  eventId={eventId}
                  groupId={group.id}
                  onSaved={() => { setShowVacForm(false); onMutated(); }}
                />
              )}

              {group.vaccinations.length === 0 && !showVacForm && (
                <p className="text-xs text-muted-foreground">No records yet</p>
              )}

              {group.vaccinations.map((v) => (
                <div key={v.id} className="mt-2 rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium">{v.vaccineName}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {new Date(v.vaccinationDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DocumentUpload
                        eventId={eventId}
                        groupId={group.id}
                        vacId={v.id}
                        documentUrl={v.documentUrl}
                        onChanged={onMutated}
                      />
                      <button
                        onClick={() => deleteVaccination(v.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
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
        </div>
      )}
    </div>
  );
}

export function GroupsTab({ eventId }: GroupsTabProps) {
  const qc = useQueryClient();
  const [newCapacity, setNewCapacity] = useState("150");
  const [creating, setCreating] = useState(false);

  const { data: groups, isPending, isError } = useQuery<LoftGroup[]>({
    queryKey: ["loft-groups", eventId],
    queryFn: () =>
      fetch(`/api/admin/event/${eventId}/loft-groups`).then((r) => r.json()),
  });

  const openGroup = groups?.find((g) => g.status === "OPEN");

  function refetch() {
    qc.invalidateQueries({ queryKey: ["loft-groups", eventId] });
  }

  const closeAndNewMutation = useMutation({
    mutationFn: (capacity: number) =>
      fetch(`/api/admin/event/${eventId}/loft-groups/close-and-new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacity }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message);
        return data;
      }),
    onSuccess: (data) => {
      toast.success(
        `${data.closedGroup ? `Group ${data.closedGroup.groupNo} closed. ` : ""}Group ${data.newGroup.groupNo} started.`
      );
      refetch();
    },
    onError: (err: any) => toast.error(err.message ?? "Failed"),
  });

  async function handleCreateFirst() {
    const cap = parseInt(newCapacity) || 150;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/loft-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacity: cap }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Group ${data.groupNo} started`);
      refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setCreating(false);
    }
  }

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
          <h3 className="text-lg font-semibold">Loft Groups</h3>
          <p className="text-sm text-muted-foreground">
            {groups?.length ?? 0} group{groups?.length !== 1 ? "s" : ""} total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground">Capacity</Label>
            <Input
              type="number"
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              className="h-8 w-20 text-sm"
              min={1}
            />
          </div>
          {openGroup ? (
            <Button
              onClick={() => closeAndNewMutation.mutate(parseInt(newCapacity) || 150)}
              disabled={closeAndNewMutation.isPending}
              size="sm"
            >
              Close and New Group
            </Button>
          ) : (
            <Button onClick={handleCreateFirst} disabled={creating} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Group
            </Button>
          )}
        </div>
      </div>

      {/* Group cards */}
      {groups?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No groups yet. Create one to start scanning birds.
        </div>
      ) : (
        <div className="space-y-3">
          {groups?.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              eventId={eventId}
              onMutated={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
