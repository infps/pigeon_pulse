"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin, Plus, Search } from "lucide-react";
import { StationsMap, LocationPickerMap } from "@/components/map";
import { haversine } from "@/lib/geo";
import { useStations, type Station } from "@/lib/api/stations";
import { useListRaceTypes } from "@/lib/api/race-types";
import { resolveTypeColor, textOn } from "@/lib/type-color";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Event } from "@/lib/types";

export function StationsTab({ eventId, event }: { eventId: string; event?: Event }) {
  const { data, isPending, isError } = useStations(eventId);
  const stations = data?.stations ?? [];

  const [editing, setEditing] = useState<Station | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Station | null>(null);
  const [search, setSearch] = useState("");
  // Type tab: "all", a raceTypeId, or "untyped".
  const [typeTab, setTypeTab] = useState<"all" | "untyped" | number>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const base =
    event?.latitude != null && event?.longitude != null
      ? { lat: event.latitude, lng: event.longitude, name: event.name ?? "Event" }
      : null;

  // Distinct types present across stations, for the tab row.
  const presentTypes = useMemo(() => {
    const map = new Map<number, { id: number; name: string; color: string }>();
    let hasUntyped = false;
    for (const s of stations) {
      if (s.raceTypeId == null) {
        hasUntyped = true;
        continue;
      }
      if (!map.has(s.raceTypeId)) {
        map.set(s.raceTypeId, {
          id: s.raceTypeId,
          name: s.raceType?.name ?? `Type ${s.raceTypeId}`,
          color: resolveTypeColor(s.raceTypeId, s.raceType?.color) ?? "#64748b",
        });
      }
    }
    return { types: [...map.values()], hasUntyped };
  }, [stations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stations.filter((s) => {
      if (typeTab === "untyped" && s.raceTypeId != null) return false;
      if (typeof typeTab === "number" && s.raceTypeId !== typeTab) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stations, search, typeTab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Release Station Map</h2>
          <p className="text-sm text-muted-foreground">
            {stations.length} station{stations.length === 1 ? "" : "s"} available
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!base}>
          <Plus className="h-4 w-4 mr-1" /> Add Station
        </Button>
      </div>

      {!base && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
          Set the event location in the <strong>Edit</strong> tab first — station distances are measured from it.
        </div>
      )}

      {isPending ? (
        <Skeleton className="h-115 w-full" />
      ) : isError ? (
        <p className="text-red-500">Failed to load stations.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          {/* List */}
          <div className="border rounded-md flex flex-col max-h-140">
            <div className="p-3 space-y-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search stations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTypeTab("all")}
                  className={`px-2.5 py-1 rounded text-xs border ${
                    typeTab === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  All
                </button>
                {presentTypes.types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeTab(t.id)}
                    className={`px-2.5 py-1 rounded text-xs border inline-flex items-center gap-1.5 ${
                      typeTab === t.id ? "ring-2 ring-offset-1" : "hover:bg-muted"
                    }`}
                    style={
                      typeTab === t.id
                        ? { backgroundColor: t.color, color: textOn(t.color), borderColor: t.color }
                        : undefined
                    }
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </button>
                ))}
                {presentTypes.hasUntyped && (
                  <button
                    type="button"
                    onClick={() => setTypeTab("untyped")}
                    className={`px-2.5 py-1 rounded text-xs border ${
                      typeTab === "untyped" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    Untyped
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                  <MapPin className="h-8 w-8 mb-2" />
                  No stations.
                </div>
              ) : (
                filtered.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId((cur) => (cur === s.id ? null : s.id))}
                    className={`group flex items-start justify-between gap-2 px-3 py-3 border-b cursor-pointer ${
                      selectedId === s.id ? "bg-muted ring-1 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{s.name}</span>
                        {s.raceTypeId != null &&
                          (() => {
                            const c = resolveTypeColor(s.raceTypeId, s.raceType?.color) ?? "#64748b";
                            return (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: c, color: textOn(c) }}
                              >
                                {s.raceType?.name ?? `Type ${s.raceTypeId}`}
                              </span>
                            );
                          })()}
                        <Badge variant={s.isActive ? "default" : "secondary"}>
                          {s.isActive ? "active" : "inactive"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {s.miles != null ? `${s.miles.toFixed(2)} MI` : "— MI"}
                      </div>
                    </div>
                    {selectedId === s.id ? (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(s);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(s);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        select →
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-2 text-xs text-muted-foreground border-t">
              Showing {filtered.length} of {stations.length} stations
            </div>
          </div>

          {/* Map */}
          <div className="border rounded-md overflow-hidden">
            <StationsMap
              base={base}
              stations={filtered.map((s) => ({
                ...s,
                color: resolveTypeColor(s.raceTypeId, s.raceType?.color),
              }))}
              height={560}
              selectedId={selectedId}
              onSelectId={setSelectedId}
              onEditSelected={(id) => {
                const s = stations.find((x) => x.id === id);
                if (s) setEditing(s);
              }}
              onDeleteSelected={(id) => {
                const s = stations.find((x) => x.id === id);
                if (s) setDeleting(s);
              }}
            />
          </div>
        </div>
      )}

      <StationFormDialog
        eventId={eventId}
        base={base}
        open={creating}
        onClose={() => setCreating(false)}
      />
      <StationFormDialog
        eventId={eventId}
        base={base}
        station={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
      />
      <DeleteDialog
        eventId={eventId}
        station={deleting}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

interface FormState {
  name: string;
  miles: string;
  km: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  raceTypeId: string;
}

function StationFormDialog({
  eventId,
  base,
  station,
  open,
  onClose,
}: {
  eventId: string;
  base: { lat: number; lng: number; name?: string } | null;
  station?: Station | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    name: "",
    miles: "",
    km: "",
    latitude: null,
    longitude: null,
    isActive: true,
    raceTypeId: "",
  });
  const [saving, setSaving] = useState(false);
  const { data: raceTypesData } = useListRaceTypes({});
  const raceTypes: { id: number; name: string | null }[] = raceTypesData?.raceTypes ?? [];

  // Sync form when editing target changes
  const targetId = station?.id ?? null;
  const [lastTargetId, setLastTargetId] = useState<number | null>(null);
  if (open && targetId !== lastTargetId) {
    setLastTargetId(targetId);
    setForm({
      name: station?.name ?? "",
      miles: station?.miles != null ? String(station.miles) : "",
      km: station?.km != null ? String(station.km) : "",
      latitude: station?.latitude ?? null,
      longitude: station?.longitude ?? null,
      isActive: station?.isActive ?? true,
      raceTypeId: station?.raceTypeId != null ? String(station.raceTypeId) : "",
    });
  }

  // On map pick: set coords + auto-fill distance from event base (editable override).
  const handlePick = (lat: number, lng: number) => {
    setForm((f) => {
      const next = { ...f, latitude: lat, longitude: lng };
      if (base) {
        const d = haversine(base.lat, base.lng, lat, lng);
        next.miles = String(d.miles);
        next.km = String(d.km);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Station name required");
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      toast.error("Pick a point on the map");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        miles: form.miles.trim() === "" ? null : Number(form.miles),
        km: form.km.trim() === "" ? null : Number(form.km),
        latitude: form.latitude,
        longitude: form.longitude,
        isActive: form.isActive,
        raceTypeId: form.raceTypeId === "" ? null : Number(form.raceTypeId),
      };
      const url = station
        ? `/api/admin/event/${eventId}/stations/${station.id}`
        : `/api/admin/event/${eventId}/stations`;
      const res = await fetch(url, {
        method: station ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message || "Save failed");
        return;
      }
      toast.success(station ? "Station updated" : "Station added");
      queryClient.invalidateQueries({ queryKey: ["admin", "stations", eventId] });
      setLastTargetId(null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const pickerValue =
    form.latitude != null && form.longitude != null
      ? { lat: form.latitude, lng: form.longitude }
      : base
        ? { lat: base.lat, lng: base.lng }
        : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{station ? "Edit Station" : "Add Station"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="st-name">Station Name *</Label>
            <Input
              id="st-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. HWY95 ROME SW"
            />
          </div>

          <div className="space-y-2">
            <Label>Station Type</Label>
            <Select
              value={form.raceTypeId || "none"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, raceTypeId: v === "none" ? "" : v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select race type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No type</SelectItem>
                {raceTypes.map((rt) => (
                  <SelectItem key={rt.id} value={String(rt.id)}>
                    {rt.name ?? `Type ${rt.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Race type for this station. Autofills the race type when this station is chosen.
            </p>
          </div>

          <div className="space-y-1">
            <Label>Release Point *</Label>
            <p className="text-xs text-muted-foreground">
              Click the map to set the release point. Distance auto-fills from the event location.
            </p>
            <LocationPickerMap value={pickerValue} onChange={handlePick} height={300} />
            <p className="text-xs text-muted-foreground">
              {form.latitude != null && form.longitude != null
                ? `Lat ${form.latitude.toFixed(6)}, Lng ${form.longitude.toFixed(6)}`
                : "No point picked"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="st-miles">Miles (override)</Label>
              <Input
                id="st-miles"
                type="number"
                step="0.001"
                value={form.miles}
                onChange={(e) => setForm((f) => ({ ...f, miles: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-km">Kilometers (override)</Label>
              <Input
                id="st-km"
                type="number"
                step="0.001"
                value={form.km}
                onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="st-active">Active</Label>
              <p className="text-xs text-muted-foreground">Show this station as available.</p>
            </div>
            <Switch
              id="st-active"
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : station ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  eventId,
  station,
  onClose,
}: {
  eventId: string;
  station: Station | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!station) return null;

  const handleDelete = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/event/${eventId}/stations/${station.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.message || "Delete failed");
        return;
      }
      toast.success("Station deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "stations", eventId] });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete station?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{station.name}&quot; will be removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={busy}>
            {busy ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
