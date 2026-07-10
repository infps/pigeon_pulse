"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil } from "lucide-react";
import { apiEndpoints } from "@/lib/endpoints";

interface BirdGroupsTabProps {
  eventId: string;
}

type GroupType = "TAG_COLOR" | "STATUS" | "DEFAULTER" | "CUSTOM";

interface BirdStatusCode {
  id: number;
  code: number;
  label: string;
  color: string | null;
}

interface GroupMember {
  id: number;
  groupId: number;
  eventInventoryItemId: number;
  eventInventoryItem: {
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
  };
}

interface BirdGroup {
  id: number;
  eventId: number;
  name: string;
  type: GroupType;
  color: string | null;
  notes: string | null;
  statusCode: BirdStatusCode | null;
  members: GroupMember[];
}

// EventInventory item shape from /event-inventory
interface InventoryItem {
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
}
interface EventInventory {
  id: number;
  breeder: { id: number; firstName: string | null; lastName: string | null } | null;
  items: InventoryItem[];
}

function getBandLabel(bird: GroupMember["eventInventoryItem"]["bird"]) {
  if (!bird) return "?";
  return (
    [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-") ||
    bird.band ||
    "?"
  );
}

const TYPE_LABELS: Record<GroupType, string> = {
  TAG_COLOR: "Tag Color",
  STATUS: "Status",
  DEFAULTER: "Defaulter",
  CUSTOM: "Custom",
};

const TYPE_BADGE_CLASS: Record<GroupType, string> = {
  TAG_COLOR: "bg-blue-100 text-blue-800",
  STATUS: "bg-purple-100 text-purple-800",
  DEFAULTER: "bg-red-100 text-red-800",
  CUSTOM: "bg-gray-100 text-gray-800",
};

function TypeBadge({ type }: { type: GroupType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function GroupCard({
  group,
  eventId,
  allGroups,
  inventoryItems,
  onMutated,
}: {
  group: BirdGroup;
  eventId: string;
  allGroups: BirdGroup[];
  inventoryItems: { id: number; label: string; breederId: number }[];
  onMutated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: group.name, color: group.color ?? "", notes: group.notes ?? "" });
  const [addItemId, setAddItemId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const memberItemIds = new Set(group.members.map((m) => m.eventInventoryItemId));
  const available = inventoryItems.filter((i) => !memberItemIds.has(i.id));

  async function handleDelete() {
    if (!confirm(`Delete group "${group.name}"? All members will be removed.`)) return;
    const res = await fetch(apiEndpoints.birdGroups.byId(eventId, group.id), { method: "DELETE" });
    if (!res.ok) { toast.error("Delete failed"); return; }
    toast.success(`Group "${group.name}" deleted`);
    onMutated();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(apiEndpoints.birdGroups.byId(eventId, group.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editForm.name, color: editForm.color || null, notes: editForm.notes || null }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Group updated");
      setEditOpen(false);
      onMutated();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBird() {
    if (!addItemId) return;
    const res = await fetch(apiEndpoints.birdGroups.members(eventId, group.id), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventInventoryItemId: parseInt(addItemId) }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.message); return; }
    if (data.removedFromGroup) {
      toast.info(`Bird removed from "${data.removedFromGroup}" and added here`);
    } else {
      toast.success("Bird added");
    }
    setAddItemId("");
    onMutated();
  }

  async function handleRemoveBird(eventInventoryItemId: number) {
    const res = await fetch(apiEndpoints.birdGroups.members(eventId, group.id), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventInventoryItemId }),
    });
    if (!res.ok) { toast.error("Remove failed"); return; }
    toast.success("Bird removed");
    onMutated();
  }

  async function handleMoveBird(eventInventoryItemId: number, toGroupId: string) {
    if (!toGroupId) return;
    const res = await fetch(apiEndpoints.birdGroups.move(eventId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventInventoryItemId, fromGroupId: group.id, toGroupId: parseInt(toGroupId) }),
    });
    if (!res.ok) { toast.error("Move failed"); return; }
    toast.success("Bird moved");
    onMutated();
  }

  const otherGroups = allGroups.filter((g) => g.id !== group.id);

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold">{group.name}</span>
          <TypeBadge type={group.type} />
          {group.color && (
            <span
              className="inline-block h-4 w-4 rounded-full border"
              style={{ backgroundColor: group.color }}
            />
          )}
          {group.statusCode && (
            <Badge variant="outline" className="text-xs">
              {group.statusCode.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="text-sm text-muted-foreground">{group.members.length} birds</span>
          <Button size="sm" variant="ghost" onClick={() => { setEditForm({ name: group.name, color: group.color ?? "", notes: group.notes ?? "" }); setEditOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {group.notes && (
            <p className="text-sm text-muted-foreground">{group.notes}</p>
          )}

          {/* Add bird */}
          <div className="flex gap-2">
            <Select value={addItemId} onValueChange={setAddItemId}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder="Select bird to add…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddBird} disabled={!addItemId}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Member list */}
          {group.members.length === 0 ? (
            <p className="text-xs text-muted-foreground">No birds in this group yet</p>
          ) : (
            <div className="space-y-1">
              {group.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 bg-muted/40 text-sm"
                >
                  <span className="font-mono text-xs">{getBandLabel(m.eventInventoryItem.bird)}</span>
                  {m.eventInventoryItem.bird?.color && (
                    <span className="text-xs text-muted-foreground">{m.eventInventoryItem.bird.color}</span>
                  )}
                  {m.eventInventoryItem.eventInventory?.breeder && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {m.eventInventoryItem.eventInventory.breeder.lastName}
                    </span>
                  )}
                  {/* Move to */}
                  {otherGroups.length > 0 && (
                    <Select onValueChange={(v) => handleMoveBird(m.eventInventoryItemId, v)}>
                      <SelectTrigger className="h-6 w-24 text-xs">
                        <SelectValue placeholder="Move…" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherGroups.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => handleRemoveBird(m.eventInventoryItemId)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={editForm.color || "#000000"}
                  onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-8 w-12 cursor-pointer rounded border"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditForm((f) => ({ ...f, color: "" }))}>
                  Clear
                </Button>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1"
                rows={3}
              />
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

export function BirdGroupsTab({ eventId }: BirdGroupsTabProps) {
  const qc = useQueryClient();
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newForm, setNewForm] = useState<{
    name: string;
    type: GroupType;
    color: string;
    statusCodeId: string;
    notes: string;
  }>({ name: "", type: "CUSTOM", color: "", statusCodeId: "", notes: "" });
  const [creating, setCreating] = useState(false);

  const { data: groupsData, isPending, isError } = useQuery<{ groups: BirdGroup[] }>({
    queryKey: ["bird-groups", eventId],
    queryFn: () => fetch(apiEndpoints.birdGroups.base(eventId)).then((r) => r.json()),
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
    qc.invalidateQueries({ queryKey: ["bird-groups", eventId] });
  }

  // Flatten all inventory items into a searchable list
  const inventoryItems = (inventoryData?.eventInventory ?? []).flatMap((inv) =>
    (inv.items ?? []).map((item) => ({
      id: item.id,
      breederId: inv.id,
      label: [
        item.bird
          ? [item.bird.band1, item.bird.band2, item.bird.band3, item.bird.band4].filter(Boolean).join("-") || item.bird.band || "?"
          : "?",
        item.bird?.color,
        inv.breeder ? `(${inv.breeder.lastName})` : "",
      ]
        .filter(Boolean)
        .join(" "),
    }))
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.name) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const res = await fetch(apiEndpoints.birdGroups.base(eventId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForm.name,
          type: newForm.type,
          color: newForm.color || null,
          statusCodeId: newForm.statusCodeId ? parseInt(newForm.statusCodeId) : null,
          notes: newForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Group "${newForm.name}" created`);
      setNewGroupOpen(false);
      setNewForm({ name: "", type: "CUSTOM", color: "", statusCodeId: "", notes: "" });
      refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create");
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
    return <p className="p-4 text-destructive">Failed to load bird groups</p>;
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bird Groups</h3>
          <p className="text-sm text-muted-foreground">
            {groups.length} group{groups.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button size="sm" onClick={() => setNewGroupOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Group
        </Button>
      </div>

      {/* Group cards */}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No bird groups yet. Create one to start organizing birds.
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
              onMutated={refetch}
            />
          ))}
        </div>
      )}

      {/* New group dialog */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Bird Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={newForm.name}
                onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Red Tag, Late Arrivals"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label>Type *</Label>
              <Select
                value={newForm.type}
                onValueChange={(v) => setNewForm((f) => ({ ...f, type: v as GroupType, statusCodeId: "" }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAG_COLOR">Tag Color</SelectItem>
                  <SelectItem value="STATUS">Status</SelectItem>
                  <SelectItem value="DEFAULTER">Defaulter</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Color — always shown, required emphasis for TAG_COLOR */}
            <div>
              <Label>
                Color{newForm.type === "TAG_COLOR" ? "" : " (optional)"}
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={newForm.color || "#000000"}
                  onChange={(e) => setNewForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-8 w-12 cursor-pointer rounded border"
                />
                <span className="text-sm text-muted-foreground">{newForm.color || "none"}</span>
                {newForm.type !== "TAG_COLOR" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setNewForm((f) => ({ ...f, color: "" }))}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Status code — only for STATUS type */}
            {newForm.type === "STATUS" && (
              <div>
                <Label>Status Code</Label>
                <Select
                  value={newForm.statusCodeId}
                  onValueChange={(v) => setNewForm((f) => ({ ...f, statusCodeId: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status code…" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusCodes.map((sc) => (
                      <SelectItem key={sc.id} value={String(sc.id)}>
                        {sc.label} ({sc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={newForm.notes}
                onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes about this group…"
                rows={2}
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNewGroupOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
