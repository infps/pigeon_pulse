"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";

interface Station {
  id: number;
  eventId: number;
  name: string;
  miles: number | null;
  km: number | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

function useStations(eventId: string) {
  return useQuery<{ stations: Station[] }>({
    queryKey: ["admin", "stations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/event/${eventId}/stations`);
      if (!res.ok) throw new Error("Failed to load stations");
      return res.json();
    },
  });
}

export function StationsTab({ eventId }: { eventId: string }) {
  const { data, isPending, isError } = useStations(eventId);
  const stations = data?.stations ?? [];

  const [editing, setEditing] = useState<Station | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Station | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Race Stations</h2>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Station
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <p className="text-red-500">Failed to load stations.</p>
      ) : stations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border rounded-md">
          <MapPin className="h-12 w-12 mb-3" />
          <p>No stations yet. Add release locations.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Station Name</TableHead>
                <TableHead className="text-right">Miles</TableHead>
                <TableHead className="text-right">Kilometers</TableHead>
                <TableHead>Latitude</TableHead>
                <TableHead>Longitude</TableHead>
                <TableHead className="w-32">Map</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-right">{s.miles ?? "-"}</TableCell>
                  <TableCell className="text-right">{s.km ?? "-"}</TableCell>
                  <TableCell>{s.latitude ?? "-"}</TableCell>
                  <TableCell>{s.longitude ?? "-"}</TableCell>
                  <TableCell>
                    {s.latitude != null && s.longitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <MapPin className="h-4 w-4" /> Open
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(s)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StationFormDialog
        eventId={eventId}
        open={creating}
        onClose={() => setCreating(false)}
      />
      <StationFormDialog
        eventId={eventId}
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
  latitude: string;
  longitude: string;
}

function StationFormDialog({
  eventId,
  station,
  open,
  onClose,
}: {
  eventId: string;
  station?: Station | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    name: "",
    miles: "",
    km: "",
    latitude: "",
    longitude: "",
  });
  const [saving, setSaving] = useState(false);

  // Sync form when editing target changes
  const targetId = station?.id ?? null;
  const [lastTargetId, setLastTargetId] = useState<number | null>(null);
  if (open && targetId !== lastTargetId) {
    setLastTargetId(targetId);
    setForm({
      name: station?.name ?? "",
      miles: station?.miles != null ? String(station.miles) : "",
      km: station?.km != null ? String(station.km) : "",
      latitude: station?.latitude != null ? String(station.latitude) : "",
      longitude: station?.longitude != null ? String(station.longitude) : "",
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Station name required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        miles: form.miles.trim() === "" ? null : Number(form.miles),
        km: form.km.trim() === "" ? null : Number(form.km),
        latitude: form.latitude.trim() === "" ? null : Number(form.latitude),
        longitude: form.longitude.trim() === "" ? null : Number(form.longitude),
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="st-miles">Miles</Label>
              <Input
                id="st-miles"
                type="number"
                step="0.001"
                value={form.miles}
                onChange={(e) => setForm((f) => ({ ...f, miles: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-km">Kilometers</Label>
              <Input
                id="st-km"
                type="number"
                step="0.001"
                value={form.km}
                onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="st-lat">Latitude</Label>
              <Input
                id="st-lat"
                type="number"
                step="0.000001"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-lon">Longitude</Label>
              <Input
                id="st-lon"
                type="number"
                step="0.000001"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              />
            </div>
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
