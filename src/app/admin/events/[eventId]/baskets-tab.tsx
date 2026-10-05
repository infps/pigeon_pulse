"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useDialogHotkeys } from "@/lib/use-dialog-hotkeys";
import { useSeasonContext } from "@/lib/season-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowRightLeft, ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, Ban, Download, Flag, LayoutList, Pencil, Plus, Printer, Radio, Scan, Search, Square, Table2, Trash2, Usb, Wand2, Wifi } from "lucide-react";
import { useWebSerial } from "@/hooks/useWebSerial";
import { toast } from "sonner";
import {
  useEventBaskets,
  useCreateBasket,
  useDeleteBasket,
  useUpdateBasket,
  useAssignBaskets,
  useClearBasket,
  useAssignRaceBaskets,
  useCheckinStatus,
} from "@/lib/api/event-baskets";
import { useListRaces } from "@/lib/api/races";
import { useBird } from "@/lib/api/bird";
import { apiEndpoints } from "@/lib/endpoints";
import { BirdEditDialog } from "@/app/admin/birds/[birdId]/bird-edit-dialog";
import type { Bird, CheckinStatusItem, EventBasketItem, Race } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BasketsTabProps {
  eventId: string;
}

export function BasketsTab({ eventId }: BasketsTabProps) {
  return (
    <Tabs defaultValue="loft" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="loft">Loft Baskets</TabsTrigger>
        <TabsTrigger value="race">Race Baskets</TabsTrigger>
        <TabsTrigger value="prescan">Bird Prescan</TabsTrigger>
      </TabsList>
      <TabsContent value="loft" className="space-y-4 mt-4">
        <LoftBasketPanel eventId={eventId} />
      </TabsContent>
      <TabsContent value="race" className="space-y-4 mt-4">
        <RaceBasketPanel eventId={eventId} />
      </TabsContent>
      <TabsContent value="prescan" className="space-y-4 mt-4">
        <BirdPrescanPanel eventId={eventId} />
      </TabsContent>
    </Tabs>
  );
}

// ============================================================
// Shared summary card
// ============================================================

function CapacitySummary({
  capacity,
  active,
  phase,
}: {
  capacity: number;
  active: number;
  phase: "Loft" | "Race";
}) {
  const insufficient = capacity < active;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Badge variant={insufficient ? "destructive" : "secondary"}>
        Capacity {capacity} / Active {active}
      </Badge>
      {insufficient && (
        <span className="text-xs text-destructive">
          Need {active - capacity} more {phase.toLowerCase()} slot(s)
        </span>
      )}
    </div>
  );
}

// ============================================================
// LOFT BASKET PANEL
// ============================================================

interface AssignPreviewItem {
  breederId: number;
  lastName: string;
  basketNo: number;
  basketLabel: string | null;
  birdCount: number;
}

interface UnassignedItem {
  breederId: number;
  lastName: string;
  birdCount: number;
}

interface AssignSummary {
  totalBreeders: number;
  assignedBreeders: number;
  unassignedBreeders: number;
  totalBirds: number;
  assignedBirds: number;
}

function LoftBasketPanel({ eventId }: { eventId: string }) {
  const { selectedSeasonId } = useSeasonContext();
  const { data: racesData } = useListRaces({ params: { eventId } });
  const races: Race[] = (racesData as { races?: Race[] })?.races ?? [];
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");

  useEffect(() => {
    if (!selectedRaceId && races.length > 0) {
      setSelectedRaceId(String(races[0].id));
    }
  }, [races, selectedRaceId]);

  const { data, isPending, refetch } = useEventBaskets(eventId, "LOFT", selectedRaceId || undefined, selectedSeasonId);
  const { data: checkinData } = useCheckinStatus(eventId, selectedSeasonId);
  const createMutation = useCreateBasket(eventId);
  const deleteMutation = useDeleteBasket(eventId);
  const updateMutation = useUpdateBasket(eventId);
  const assignMutation = useAssignBaskets(eventId);
  const clearMutation = useClearBasket(eventId);

  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [assignMode, setAssignMode] = useState<"shuffle" | "assign" | null>(null);
  const [assignPreview, setAssignPreview] = useState<AssignPreviewItem[] | null>(null);
  const [assignUnassigned, setAssignUnassigned] = useState<UnassignedItem[]>([]);
  const [assignSummary, setAssignSummary] = useState<AssignSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editBasket, setEditBasket] = useState<EventBasketItem | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [clearTarget, setClearTarget] = useState<EventBasketItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventBasketItem | null>(null);

  const baskets: EventBasketItem[] = data?.baskets || [];
  const totalCapacity = baskets.reduce((s, b) => s + b.capacity, 0);
  const activeBirds = checkinData?.summary?.total ?? 0;
  const insufficient = totalCapacity < activeBirds;

  const nextBasketNo = baskets.length > 0
    ? Math.max(...baskets.map((b) => b.basketNo)) + 1
    : 1;
  const [basketNo, setBasketNo] = useState(nextBasketNo);

  const openDialog = () => {
    const next = baskets.length > 0
      ? Math.max(...baskets.map((b) => b.basketNo)) + 1
      : 1;
    setBasketNo(next);
    setCapacity("");
    setDialogOpen(true);
  };

  const handleSave = async (keepOpen: boolean) => {
    const cap = parseInt(capacity);
    if (isNaN(cap) || cap < 1) {
      toast.error("Capacity must be a positive number");
      return;
    }
    try {
      await createMutation.mutateAsync({ capacity: cap, phase: "LOFT", ...(selectedRaceId ? { raceId: parseInt(selectedRaceId) } : {}) });
      toast.success(`Basket #${basketNo} created`);
      refetch();
      if (keepOpen) {
        setBasketNo(basketNo + 1);
        setCapacity("");
      } else {
        setDialogOpen(false);
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to create basket");
    }
  };

  const openEdit = (basket: EventBasketItem) => {
    setEditBasket(basket);
    setEditLabel(basket.label ?? "");
    setEditCapacity(String(basket.capacity));
  };

  const handleEditSave = async () => {
    if (!editBasket) return;
    const cap = parseInt(editCapacity);
    if (isNaN(cap) || cap < 1) {
      toast.error("Capacity must be a positive number");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        basketId: editBasket.id,
        label: editLabel,
        capacity: cap,
      });
      toast.success("Basket updated");
      setEditBasket(null);
      refetch();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to update basket");
    }
  };

  // Loft basket edit dialog hotkeys
  useDialogHotkeys({
    open: !!editBasket,
    onSave: handleEditSave,
    onClose: () => setEditBasket(null),
    disabled: updateMutation.isPending,
  });
  // Loft basket add dialog hotkeys
  useDialogHotkeys({
    open: dialogOpen,
    onSave: () => handleSave(false),
    onSaveAndNew: () => handleSave(true),
    onClose: () => setDialogOpen(false),
    disabled: createMutation.isPending,
  });

  const handlePreviewAssign = async (mode: "shuffle" | "assign") => {
    try {
      const raceIdPayload = selectedRaceId ? { raceId: parseInt(selectedRaceId) } : {};
      const seasonPayload = selectedSeasonId ? { seasonId: selectedSeasonId } : {};
      const res = await assignMutation.mutateAsync({ preview: true, mode, ...raceIdPayload, ...seasonPayload });
      const result = (res as { data?: unknown })?.data || res;
      const r = result as { assigned?: AssignPreviewItem[]; unassigned?: UnassignedItem[]; summary?: AssignSummary; message?: string };
      if (!r?.assigned?.length && !r?.unassigned?.length) {
        toast.info(r?.message || "No birds to assign");
        return;
      }
      setAssignMode(mode);
      setAssignPreview(r.assigned ?? []);
      setAssignUnassigned(r.unassigned ?? []);
      setAssignSummary(r.summary ?? null);
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to preview assignment");
    }
  };

  const handleConfirmAssign = async () => {
    try {
      const raceIdPayload = selectedRaceId ? { raceId: parseInt(selectedRaceId) } : {};
      const seasonPayload = selectedSeasonId ? { seasonId: selectedSeasonId } : {};
      await assignMutation.mutateAsync({ preview: false, mode: assignMode ?? "shuffle", ...raceIdPayload, ...seasonPayload });
      toast.success("Birds assigned to baskets");
      setAssignPreview(null);
      setAssignUnassigned([]);
      setAssignSummary(null);
      setAssignMode(null);
      setConfirmOpen(false);
      refetch();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to assign baskets");
    }
  };

  const handleConfirmClear = async () => {
    if (!clearTarget) return;
    try {
      await clearMutation.mutateAsync({ basketId: clearTarget.id, action: "clear" });
      toast.success(`Basket #${clearTarget.basketNo} cleared`);
      setClearTarget(null);
      refetch();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to clear basket");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ basketId: deleteTarget.id });
      toast.success(`Basket #${deleteTarget.basketNo} deleted`);
      setDeleteTarget(null);
      refetch();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to delete basket");
    }
  };

  const hasExistingAssignments = baskets.some(
    (b) => (b._count?.assignments ?? b.assignments?.length ?? 0) > 0
  );

  return (
    <>
      <Card>
        <CardContent className="pt-4 space-y-3">
          {/* Race selector — loft baskets are now per-race */}
          <div className="flex items-center gap-3">
            <Label className="text-sm shrink-0">Race</Label>
            {races.length === 0 ? (
              <p className="text-sm text-muted-foreground">No races yet</p>
            ) : (
              <Select value={selectedRaceId} onValueChange={setSelectedRaceId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select a race" />
                </SelectTrigger>
                <SelectContent>
                  {races.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name ?? `Race #${r.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Create baskets below, then use <strong>Set Baskets</strong> to auto-assign birds via BFD.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={hasExistingAssignments ? () => setConfirmOpen(true) : () => handlePreviewAssign("shuffle")}
                disabled={assignMutation.isPending || baskets.length === 0 || insufficient}
                title={insufficient ? `Not enough capacity for ${activeBirds} active birds` : undefined}
              >
                <Wand2 className="h-4 w-4" />
                {assignMutation.isPending ? "Running..." : "Set Baskets"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => handlePreviewAssign("assign")}
                disabled={assignMutation.isPending || baskets.length === 0}
              >
                <Plus className="h-4 w-4" />
                {assignMutation.isPending ? "Running..." : "Assign"}
              </Button>
              <Button size="sm" className="gap-1.5" onClick={openDialog}>
                <Plus className="h-4 w-4" />
                Add New Basket
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => setScanDialogOpen(true)}
                disabled={!hasExistingAssignments}
                title={!hasExistingAssignments ? "Run Set Baskets first to assign birds to baskets" : undefined}
              >
                <Scan className="h-4 w-4" />
                Scan to Place
              </Button>
            </div>
          </div>
          <CapacitySummary capacity={totalCapacity} active={activeBirds} phase="Loft" />
        </CardContent>
      </Card>

      {/* BFD Assignment Preview */}
      {assignPreview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Assignment Preview
              {assignSummary && (
                <Badge variant="secondary">
                  {assignSummary.assignedBreeders}/{assignSummary.totalBreeders} breeders · {assignSummary.assignedBirds} birds
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              {assignPreview.map((item) => (
                <div
                  key={item.breederId}
                  className="flex items-center justify-between px-3 py-2 rounded-md border text-sm"
                >
                  <span className="font-medium">{item.lastName}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{item.birdCount} birds</span>
                    <span>→</span>
                    <span className="font-mono text-xs">
                      {item.basketLabel ?? `Basket #${item.basketNo}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {assignUnassigned.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {assignUnassigned.length} breeder(s) could not be assigned — no basket has enough space
                </div>
                {assignUnassigned.map((u) => (
                  <div key={u.breederId} className="text-sm text-muted-foreground pl-6">
                    {u.lastName} — {u.birdCount} birds
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={handleConfirmAssign} disabled={assignMutation.isPending}>
                {assignMutation.isPending ? "Saving..." : "Confirm & Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setAssignPreview(null); setAssignUnassigned([]); setAssignSummary(null); }}
              >
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <PersistedBasketsView
        eventId={eventId}
        raceId={selectedRaceId}
        baskets={baskets}
        isPending={isPending}
        phase="Loft"
        onDelete={(b) => setDeleteTarget(b)}
        onMove={(b) => setClearTarget(b)}
        onEdit={openEdit}
      />

      {/* Edit Basket Dialog */}
      <Dialog open={!!editBasket} onOpenChange={(o) => !o && setEditBasket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Basket #{editBasket?.basketNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-loft-label">Name / Label</Label>
              <Input
                id="edit-loft-label"
                placeholder="e.g. LB-SMITH-1"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="edit-loft-capacity">Capacity</Label>
              <Input
                id="edit-loft-capacity"
                type="number"
                min="1"
                value={editCapacity}
                onChange={(e) => setEditCapacity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBasket(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Basket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Loft Basket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="basket-no">No.</Label>
              <Input
                id="basket-no"
                type="number"
                value={basketNo}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="basket-capacity">Capacity</Label>
              <Input
                id="basket-capacity"
                type="number"
                min="1"
                placeholder="Enter capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave(false)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave(true)}
              disabled={createMutation.isPending || !capacity}
            >
              {createMutation.isPending ? "Saving..." : "Save and New"}
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={createMutation.isPending || !capacity}
            >
              {createMutation.isPending ? "Saving..." : "Save and Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-assign confirmation (existing assignments present) */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-assign All Baskets?</AlertDialogTitle>
            <AlertDialogDescription>
              Birds are already assigned to loft baskets. Running Set Baskets will clear all
              existing assignments and re-assign using BFD. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                handlePreviewAssign("shuffle");
              }}
            >
              Preview & Re-assign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear basket (Move = unassign all birds from basket) */}
      <AlertDialog open={!!clearTarget} onOpenChange={(o) => !o && setClearTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Basket #{clearTarget?.basketNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              {(clearTarget?._count?.assignments ?? clearTarget?.assignments?.length ?? 0) > 0
                ? `${clearTarget?._count?.assignments ?? clearTarget?.assignments?.length ?? 0} bird(s) will be unassigned and need to be reassigned.`
                : "Basket is empty."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear} disabled={clearMutation.isPending}>
              {clearMutation.isPending ? "Clearing..." : "Clear Basket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete basket */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Basket #{deleteTarget?.basketNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              {(deleteTarget?._count?.assignments ?? deleteTarget?.assignments?.length ?? 0) > 0
                ? `${deleteTarget?._count?.assignments ?? deleteTarget?.assignments?.length ?? 0} bird(s) will be unassigned and need to be reassigned. `
                : ""}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Basket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scanDialogOpen && (
        <LoftScanDialog
          eventId={eventId}
          seasonId={selectedSeasonId}
          onClose={() => { setScanDialogOpen(false); refetch(); }}
        />
      )}
    </>
  );
}

// ============================================================
// RACE BASKET PANEL (mirrors Loft flow)
// ============================================================

interface RaceBasketPreview {
  basketId: number;
  basketNo: number;
  basketLabel: string | null;
  capacity: number;
  birdCount: number;
  breeders: string[];
}

interface RaceAssignSummary {
  totalBirds: number;
  totalCapacity: number;
  assignedBirds: number;
  unassignedBirds: number;
  basketCount: number;
}

function RaceBasketPanel({ eventId }: { eventId: string }) {
  const { selectedSeasonId } = useSeasonContext();
  const { data: racesData } = useListRaces({ params: { eventId } });
  const races: Race[] = (racesData as { races?: Race[] })?.races ?? [];
  const [selectedRaceId, setSelectedRaceId] = useState<string>("");

  useEffect(() => {
    if (!selectedRaceId && races.length > 0) {
      setSelectedRaceId(String(races[0].id));
    }
  }, [races, selectedRaceId]);

  const { data, isPending, refetch } = useEventBaskets(
    eventId,
    "RACE",
    selectedRaceId || undefined,
    selectedSeasonId
  );
  const { data: checkinData } = useCheckinStatus(eventId, selectedSeasonId);
  const createMutation = useCreateBasket(eventId);
  const deleteMutation = useDeleteBasket(eventId);
  const updateMutation = useUpdateBasket(eventId);
  const assignMutation = useAssignRaceBaskets(eventId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [prescanOpen, setPrescanOpen] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [preview, setPreview] = useState<RaceBasketPreview[] | null>(null);
  const [previewSummary, setPreviewSummary] = useState<RaceAssignSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"reset" | "incremental">("reset");
  const [editBasket, setEditBasket] = useState<EventBasketItem | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCapacity, setEditCapacity] = useState("");

  const baskets: EventBasketItem[] = data?.baskets || [];

  const totalCapacity = baskets.reduce((s, b) => s + b.capacity, 0);
  const activeBirds = checkinData?.summary?.total ?? 0;
  const insufficient = totalCapacity < activeBirds;

  const nextBasketNo = baskets.length > 0
    ? Math.max(...baskets.map((b) => b.basketNo)) + 1
    : 1;
  const [basketNo, setBasketNo] = useState(nextBasketNo);

  const openDialog = () => {
    const next = baskets.length > 0
      ? Math.max(...baskets.map((b) => b.basketNo)) + 1
      : 1;
    setBasketNo(next);
    setCapacity("");
    setDialogOpen(true);
  };

  const handleSave = async (keepOpen: boolean) => {
    const cap = parseInt(capacity);
    if (isNaN(cap) || cap < 1) {
      toast.error("Capacity must be a positive number");
      return;
    }
    if (!selectedRaceId) {
      toast.error("Select a race first");
      return;
    }
    try {
      await createMutation.mutateAsync({
        capacity: cap,
        phase: "RACE",
        raceId: parseInt(selectedRaceId),
      });
      toast.success(`Race basket #${basketNo} created`);
      refetch();
      if (keepOpen) {
        setBasketNo(basketNo + 1);
        setCapacity("");
      } else {
        setDialogOpen(false);
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to create basket");
    }
  };

  const openEdit = (basket: EventBasketItem) => {
    setEditBasket(basket);
    setEditLabel(basket.label ?? "");
    setEditCapacity(String(basket.capacity));
  };

  const handleEditSave = async () => {
    if (!editBasket) return;
    const cap = parseInt(editCapacity);
    if (isNaN(cap) || cap < 1) {
      toast.error("Capacity must be a positive number");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        basketId: editBasket.id,
        label: editLabel,
        capacity: cap,
      });
      toast.success("Basket updated");
      setEditBasket(null);
      refetch();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to update basket");
    }
  };

  // Race basket edit dialog hotkeys
  useDialogHotkeys({
    open: !!editBasket,
    onSave: handleEditSave,
    onClose: () => setEditBasket(null),
    disabled: updateMutation.isPending,
  });
  // Race basket add dialog hotkeys
  useDialogHotkeys({
    open: dialogOpen,
    onSave: () => handleSave(false),
    onSaveAndNew: () => handleSave(true),
    onClose: () => setDialogOpen(false),
    disabled: createMutation.isPending,
  });

  const handleDelete = async (basket: EventBasketItem) => {
    try {
      await deleteMutation.mutateAsync({ basketId: basket.id });
      toast.success(`Basket #${basket.basketNo} deleted`);
      refetch();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to delete basket");
    }
  };

  const handlePreviewAssign = async (mode: "reset" | "incremental" = "reset") => {
    if (!selectedRaceId) {
      toast.error("Select a race first");
      return;
    }
    setPendingMode(mode);
    try {
      const res = await assignMutation.mutateAsync({
        preview: true,
        raceId: parseInt(selectedRaceId),
        mode,
      });
      const result = (res as { data?: unknown })?.data || res;
      const r = result as { baskets?: RaceBasketPreview[]; summary?: RaceAssignSummary; message?: string };
      if (!r?.baskets?.length) {
        toast.info(r?.message || "No loft-basketed birds found");
        return;
      }
      setPreview(r.baskets);
      setPreviewSummary(r.summary ?? null);
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to preview assignment");
    }
  };

  const handleConfirmAssign = async () => {
    if (!selectedRaceId) return;
    try {
      await assignMutation.mutateAsync({
        preview: false,
        raceId: parseInt(selectedRaceId),
        mode: pendingMode,
      });
      toast.success(
        pendingMode === "incremental"
          ? "New birds added to race baskets"
          : "Birds assigned to race baskets"
      );
      setPreview(null);
      setPreviewSummary(null);
      setConfirmOpen(false);
      refetch();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to assign baskets");
    }
  };

  const hasExistingAssignments = baskets.some(
    (b) => (b._count?.assignments ?? b.assignments?.length ?? 0) > 0
  );

  return (
    <>
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-sm">Race</Label>
            <Select
              value={selectedRaceId}
              onValueChange={(v) => {
                setSelectedRaceId(v);
                setPreview(null);
                setPreviewSummary(null);
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={races.length === 0 ? "No races yet" : "Select race"} />
              </SelectTrigger>
              <SelectContent>
                {races.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name || `Race #${r.raceNumber ?? r.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Create race baskets, then use <strong>Reset & Reassign</strong> to randomly redistribute, or <strong>Add New Birds Only</strong> to top-up without disturbing existing assignments.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={
                  hasExistingAssignments
                    ? () => { setPendingMode("reset"); setConfirmOpen(true); }
                    : () => handlePreviewAssign("reset")
                }
                disabled={
                  assignMutation.isPending ||
                  baskets.length === 0 ||
                  insufficient ||
                  activeBirds === 0 ||
                  !selectedRaceId
                }
                title={
                  !selectedRaceId
                    ? "Select a race first"
                    : activeBirds === 0
                    ? "No registered birds found"
                    : insufficient
                    ? `Not enough capacity for ${activeBirds} active birds`
                    : undefined
                }
              >
                <Wand2 className="h-4 w-4" />
                {assignMutation.isPending ? "Running..." : "Reset & Reassign"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => handlePreviewAssign("incremental")}
                disabled={
                  assignMutation.isPending ||
                  baskets.length === 0 ||
                  activeBirds === 0 ||
                  !selectedRaceId
                }
                title={!selectedRaceId ? "Select a race first" : undefined}
              >
                <Plus className="h-4 w-4" />
                Add New Birds Only
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={openDialog}
                disabled={!selectedRaceId}
              >
                <Plus className="h-4 w-4" />
                Add New Basket
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => setPrescanOpen(true)}
                disabled={!selectedRaceId || !hasExistingAssignments}
                title={!hasExistingAssignments ? "Run Set Basket first to assign birds to baskets" : undefined}
              >
                <Scan className="h-4 w-4" />
                Prescan
              </Button>
            </div>
          </div>
          <CapacitySummary capacity={totalCapacity} active={activeBirds} phase="Race" />
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Assignment Preview
              {previewSummary && (
                <Badge variant="secondary">
                  {previewSummary.assignedBirds}/{previewSummary.totalBirds} birds · {previewSummary.basketCount} baskets
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              {preview.map((b) => (
                <div
                  key={b.basketId}
                  className="flex items-center justify-between px-3 py-2 rounded-md border text-sm"
                >
                  <span className="font-medium">
                    {b.basketLabel ?? `Basket #${b.basketNo}`}
                  </span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {b.birdCount}/{b.capacity}
                    </Badge>
                    <span className="text-xs truncate max-w-[200px]">
                      {b.breeders.join(", ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {previewSummary && previewSummary.unassignedBirds > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {previewSummary.unassignedBirds} bird(s) could not be assigned — capacity exhausted
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={handleConfirmAssign} disabled={assignMutation.isPending}>
                {assignMutation.isPending ? "Saving..." : "Confirm & Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setPreview(null); setPreviewSummary(null); }}
              >
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <PersistedBasketsView
        eventId={eventId}
        raceId={selectedRaceId}
        baskets={baskets}
        isPending={isPending}
        phase="Race"
        onDelete={handleDelete}
        onEdit={openEdit}
      />

      {/* Edit Basket Dialog */}
      <Dialog open={!!editBasket} onOpenChange={(o) => !o && setEditBasket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Basket #{editBasket?.basketNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-race-label">Name / Label</Label>
              <Input
                id="edit-race-label"
                placeholder="e.g. RB-1"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="edit-race-capacity">Capacity</Label>
              <Input
                id="edit-race-capacity"
                type="number"
                min="1"
                value={editCapacity}
                onChange={(e) => setEditCapacity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBasket(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Basket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Race Basket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="race-basket-no">No.</Label>
              <Input
                id="race-basket-no"
                type="number"
                value={basketNo}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="race-basket-capacity">Capacity</Label>
              <Input
                id="race-basket-capacity"
                type="number"
                min="1"
                placeholder="Enter capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave(false)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave(true)}
              disabled={createMutation.isPending || !capacity}
            >
              {createMutation.isPending ? "Saving..." : "Save and New"}
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={createMutation.isPending || !capacity}
            >
              {createMutation.isPending ? "Saving..." : "Save and Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-assign confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-assign All Race Baskets?</AlertDialogTitle>
            <AlertDialogDescription>
              Birds are already assigned to race baskets. Running Set Baskets will clear all
              existing race assignments and redistribute randomly. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                handlePreviewAssign("reset");
              }}
            >
              Preview & Re-assign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {prescanOpen && selectedRaceId && (
        <PrescanDialog
          eventId={eventId}
          raceId={selectedRaceId}
          onClose={() => setPrescanOpen(false)}
        />
      )}
    </>
  );
}

// ============================================================
// PRESCAN DIALOG
// ============================================================

type PrescanRow = {
  rfid: string;
  birdName: string | null;
  attention: boolean;
  basketLabel: string;
  status: "scanned" | "already_scanned" | "foreign";
  raceItemId?: number;
};

function PrescanDialog({ eventId, raceId, onClose }: { eventId: string; raceId: string; onClose: () => void }) {
  const [rows, setRows] = useState<PrescanRow[]>([]);
  const [isPollActive, setIsPollActive] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);

  const doScan = useCallback(async (rfid: string) => {
    if (rfid === lastScannedRef.current) return;
    lastScannedRef.current = rfid;

    const res = await fetch(`/api/admin/event/${eventId}/baskets/prescan-race`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfid, raceId: parseInt(raceId) }),
    });
    const data = await res.json();

    const newRow: PrescanRow = {
      rfid,
      birdName: data.bird?.birdName ?? data.bird?.band ?? null,
      attention: data.bird?.attention ?? false,
      basketLabel: data.basketLabel ?? "-",
      status: data.status,
      raceItemId: data.raceItemId,
    };

    setRows((prev) => {
      const existing = prev.findIndex((r) => r.rfid === rfid);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = newRow;
        return next;
      }
      return [...prev, newRow];
    });

    if (data.status === "already_scanned") toast.info(`Already basketed: ${newRow.birdName ?? rfid}`);
    else if (data.status === "foreign") toast.warning(`Foreign bird: ${rfid}`);
    else toast.success(`Scanned: ${newRow.birdName ?? rfid} → ${newRow.basketLabel}`);
  }, [eventId, raceId]);

  const startPoll = useCallback(() => {
    setIsPollActive(true);
    lastScannedRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success("Prescan scanner started");

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scanner/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
        });
        const d = await res.json();
        if (d?.length > 0 && d[0].el && d[0].el !== lastScannedRef.current) {
          await doScan(d[0].el);
        }
      } catch { /* silent */ }
    }, 2000);
  }, [doScan]);

  const stopPoll = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    setIsPollActive(false);
    lastScannedRef.current = null;
    toast.info("Prescan scanner stopped");
  }, []);

  const handleClose = () => {
    stopPoll();
    onClose();
  };

  const handleAddForeign = async (row: PrescanRow) => {
    try {
      const res = await fetch(`/api/admin/event/${eventId}/baskets/prescan-race`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfid: row.rfid, raceId: parseInt(raceId), action: "register_foreign" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? "Failed to register"); return; }
      setRows((prev) => prev.map((r) =>
        r.rfid === row.rfid ? { ...r, birdName: data.bird?.birdName ?? data.bird?.band ?? r.rfid, status: "scanned", raceItemId: data.raceItemId } : r
      ));
      toast.success("Bird registered under admin for later reassignment");
    } catch { toast.error("Failed to register bird"); }
  };

  const handleRemoveForeign = async (row: PrescanRow) => {
    if (row.raceItemId) {
      try {
        await fetch(`/api/admin/event/${eventId}/baskets/prescan-race`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raceItemId: row.raceItemId }),
        });
      } catch { /* best effort */ }
    }
    setRows((prev) => prev.filter((r) => r.rfid !== row.rfid));
  };

  const statusBadge = (status: PrescanRow["status"]) => {
    if (status === "scanned") return <Badge variant="default" className="text-xs">Basketed</Badge>;
    if (status === "already_scanned") return <Badge variant="secondary" className="text-xs">Already Basketed</Badge>;
    return <Badge variant="destructive" className="text-xs">Foreign</Badge>;
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>Prescan — Race Basket</span>
            <div className="flex items-center gap-2">
              {isPollActive ? (
                <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={stopPoll}>
                  <Square className="h-4 w-4" />Stop Scanner
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={startPoll}>
                  <Wifi className="h-4 w-4" />Start Scanner
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              {isPollActive ? "Waiting for scans..." : "Start scanner to begin scanning birds"}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-primary text-primary-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Bird Name</th>
                  <th className="text-left px-3 py-2 font-medium font-mono">RFID</th>
                  <th className="text-center px-3 py-2 font-medium">Attention</th>
                  <th className="text-left px-3 py-2 font-medium">Basket</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.rfid} className={row.status === "foreign" ? "bg-red-50" : undefined}>
                    <td className="px-3 py-2">{row.birdName ?? <span className="text-muted-foreground italic">Unknown</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.rfid}</td>
                    <td className="px-3 py-2 text-center">
                      {row.attention && <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />}
                    </td>
                    <td className="px-3 py-2">{row.basketLabel}</td>
                    <td className="px-3 py-2">{statusBadge(row.status)}</td>
                    <td className="px-3 py-2">
                      {row.status === "foreign" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddForeign(row)}>
                            Add Bird
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => handleRemoveForeign(row)}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <span className="text-xs text-muted-foreground mr-auto">
            {rows.filter(r => r.status === "scanned").length} basketed · {rows.filter(r => r.status === "foreign").length} foreign
          </span>
          <Button onClick={handleClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// BIRD PRESCAN PANEL
// ============================================================

type PrescanEntry = {
  rfid: string;
  birdName: string | null;
  band: string | null;
  breederName: string | null;
  status: string | null;
  unknown: boolean;
};

function BirdPrescanPanel({ eventId }: { eventId: string }) {
  const { selectedSeasonId } = useSeasonContext();
  const { data } = useCheckinStatus(eventId, selectedSeasonId);
  const { data: racesData } = useListRaces({ params: { eventId } });
  const races: Race[] = (racesData as { races?: Race[] })?.races ?? [];
  const [pickedRaceId, setSelectedRaceId] = useState<string>("");
  const selectedRaceId = pickedRaceId || (races[0] ? String(races[0].id) : "");

  const rfidMap = new Map<string, CheckinStatusItem>();
  for (const item of (data?.items ?? []) as CheckinStatusItem[]) {
    if (item.bird?.rfid) rfidMap.set(item.bird.rfid, item);
  }

  const [entries, setEntries] = useState<PrescanEntry[]>([]);
  const [isPollActive, setIsPollActive] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  const handleScan = useCallback((rfid: string) => {
    if (rfid === lastScannedRef.current) return;
    lastScannedRef.current = rfid;

    const item = rfidMap.get(rfid);
    const entry: PrescanEntry = item
      ? {
          rfid,
          birdName: item.bird?.birdName ?? null,
          band: item.bird?.band ?? null,
          breederName: [item.breeder?.firstName, item.breeder?.lastName].filter(Boolean).join(" ") || null,
          status: item.isLoftBasketed ? "LOFT_BASKETED" : "REGISTERED",
          unknown: false,
        }
      : { rfid, birdName: null, band: null, breederName: null, status: null, unknown: true };

    setEntries((prev) => {
      const existing = prev.findIndex((e) => e.rfid === rfid);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = entry;
        return next;
      }
      return [entry, ...prev];
    });

    if (entry.unknown) toast.warning(`Unknown RFID: ${rfid}`);
    else toast.success(`${entry.birdName ?? rfid} — ${entry.breederName ?? "?"}`);
  }, [rfidMap]);

  const startPoll = useCallback(() => {
    setIsPollActive(true);
    lastScannedRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success("Prescan scanner started");
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scanner/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
        });
        const d = await res.json();
        if (d?.length > 0 && d[0].el && d[0].el !== lastScannedRef.current) {
          handleScan(d[0].el);
        }
      } catch { /* silent */ }
    }, 2000);
  }, [handleScan]);

  const stopPoll = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    setIsPollActive(false);
    lastScannedRef.current = null;
    toast.info("Prescan scanner stopped");
  }, []);

  const statusBadge = (entry: PrescanEntry) => {
    if (entry.unknown) return <Badge variant="destructive" className="text-xs">Unknown</Badge>;
    if (entry.status === "LOFT_BASKETED") return <Badge variant="default" className="text-xs">Loft Basketed</Badge>;
    return <Badge variant="secondary" className="text-xs">Registered</Badge>;
  };

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Bird Prescan</CardTitle>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => { setEntries([]); lastScannedRef.current = null; }}>
                Clear
              </Button>
            )}
            {isPollActive ? (
              <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={stopPoll}>
                <Square className="h-4 w-4" />Stop Scanner
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={startPoll}>
                <Wifi className="h-4 w-4" />Start Scanner
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Scan any RFID tag to identify bird and breeder. Read-only — no assignments made.
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed rounded-lg">
            {isPollActive ? "Waiting for scans..." : "Start scanner to begin"}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium font-mono">RFID</th>
                  <th className="px-3 py-2 text-left font-medium">Bird Name</th>
                  <th className="px-3 py-2 text-left font-medium">Band</th>
                  <th className="px-3 py-2 text-left font-medium">Breeder</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.rfid} className={entry.unknown ? "bg-red-50" : undefined}>
                    <td className="px-3 py-2 font-mono text-xs">{entry.rfid}</td>
                    <td className="px-3 py-2">{entry.birdName ?? <span className="text-muted-foreground italic">—</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.band ?? "—"}</td>
                    <td className="px-3 py-2">{entry.breederName ?? <span className="text-muted-foreground italic">—</span>}</td>
                    <td className="px-3 py-2">{statusBadge(entry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {entries.filter(e => !e.unknown).length} identified · {entries.filter(e => e.unknown).length} unknown
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Entries</CardTitle>
      </CardHeader>
      <CardContent>
        <EntriesTable
          eventId={eventId}
          raceId={selectedRaceId}
          races={races}
          onRaceChange={setSelectedRaceId}
        />
      </CardContent>
    </Card>
    </>
  );
}

// ============================================================
// LOFT SCAN DIALOG
// ============================================================

// Lookup result from prescan-loft: where the bird is already basketed.
type LoftBasket = { label: string; basketNo: number; capacity: number; count: number };
type LoftScanRow = {
  band: string | null;
  birdName: string | null;
  breeder: string | null;
  loftName: string | null;
  basketLabel: string;
  scannedAt: string;
};

function LoftScanDialog({
  eventId,
  seasonId,
  onClose,
}: {
  eventId: string;
  seasonId?: number | null;
  onClose: () => void;
}) {
  const { data } = useCheckinStatus(eventId, seasonId);

  const allItems: CheckinStatusItem[] = data?.items ?? [];
  // Total birds placed in a loft basket by Set Baskets (the "assign first" step).
  const basketedTotal = allItems.filter((i) => i.isLoftBasketed).length;

  const [scannedLog, setScannedLog] = useState<LoftScanRow[]>([]);
  const [isPollActive, setIsPollActive] = useState(false);
  const [foreignCount, setForeignCount] = useState(0);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const scannedRfidsRef = useRef<Set<string>>(new Set());
  type Bird = { band?: string | null; birdName?: string | null; rfid?: string | null; color?: string | null; sex?: number | null; attention?: boolean | null; note?: string | null };
  type Breeder = { firstName?: string | null; lastName?: string | null };
  type HeroScan =
    | { status: "placed"; bird: Bird; breeder: Breeder | null; loftName: string | null; basket: LoftBasket }
    | { status: "unassigned"; bird: Bird; breeder: Breeder | null; loftName: string | null }
    | { status: "foreign"; rfid: string };
  const [lastScan, setLastScan] = useState<HeroScan | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartedAtRef = useRef<string | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  const breederName = (b: Breeder | null) =>
    b ? [b.firstName, b.lastName].filter(Boolean).join(" ") || null : null;

  const handleScan = useCallback(async (rfid: string) => {
    if (rfid === lastScannedRef.current) return;
    lastScannedRef.current = rfid;

    // Already looked up this tag this session → ignore duplicate.
    if (scannedRfidsRef.current.has(rfid)) {
      setIgnoredCount((c) => c + 1);
      toast.info(`Already scanned: ${rfid}`);
      return;
    }

    try {
      const res = await fetch(`/api/admin/event/${eventId}/baskets/prescan-loft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfid }),
      });
      const d = await res.json();

      if (d?.status === "foreign") {
        setLastScan({ status: "foreign", rfid });
        setForeignCount((c) => c + 1);
        toast.warning(`Foreign bird: ${rfid}`);
        return;
      }

      if (d?.status === "unassigned") {
        setLastScan({ status: "unassigned", bird: d.bird, breeder: d.breeder, loftName: d.loftName });
        toast.warning(`${d.bird?.birdName || d.bird?.band || rfid} — not in a basket yet`);
        return;
      }

      // placed
      scannedRfidsRef.current.add(rfid);
      setLastScan({ status: "placed", bird: d.bird, breeder: d.breeder, loftName: d.loftName, basket: d.basket });
      setScannedLog((prev) => [{
        band: d.bird?.band ?? null,
        birdName: d.bird?.birdName ?? null,
        breeder: breederName(d.breeder),
        loftName: d.loftName ?? null,
        basketLabel: d.basket?.label ?? "—",
        scannedAt: new Date().toISOString(),
      }, ...prev]);
      toast.success(`${d.bird?.birdName || d.bird?.band} → ${d.basket?.label}`);
    } catch {
      toast.error("Scan lookup failed");
      lastScannedRef.current = null;
    }
  }, [eventId]);

  const startPoll = useCallback(() => {
    setIsPollActive(true);
    lastScannedRef.current = null;
    pollStartedAtRef.current = new Date().toISOString();
    toast.success("Scanner started — scan bird RFID tags");
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/scanner/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startedAt: pollStartedAtRef.current }),
        });
        const d = await res.json();
        if (d?.length > 0 && d[0].el && d[0].el !== lastScannedRef.current) {
          await handleScan(d[0].el);
        }
      } catch { /* silent */ }
    }, 2000);
  }, [handleScan]);

  const stopPoll = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    setIsPollActive(false);
    lastScannedRef.current = null;
    toast.info("Scanner stopped");
  }, []);

  const { isConnected: isSerial, connect: connectSerial, disconnect: disconnectSerial } =
    useWebSerial({ onScan: handleScan });

  const handleClose = () => {
    stopPoll();
    disconnectSerial();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>Scan to Place — Loft</span>
            <div className="flex items-center gap-2">
              {isPollActive ? (
                <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={stopPoll}>
                  <Square className="h-4 w-4" />Stop Scanner
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { disconnectSerial(); startPoll(); }}>
                  <Wifi className="h-4 w-4" />Start Scanner
                </Button>
              )}
              <Button
                size="sm"
                variant={isSerial ? "default" : "outline"}
                className="gap-1.5"
                onClick={isSerial ? disconnectSerial : () => { stopPoll(); connectSerial(); }}
              >
                <Usb className="h-4 w-4" />
                {isSerial ? "USB Connected" : "USB Serial"}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          {(isPollActive || isSerial) && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
              {isSerial ? <Usb className="h-4 w-4 text-primary animate-pulse shrink-0" /> : <Radio className="h-4 w-4 text-primary animate-pulse shrink-0" />}
              <p className="text-xs text-muted-foreground animate-pulse">
                {isSerial ? "USB Serial active — scan bird RFID tags" : "Scanning — hold RFID tag to reader"}
              </p>
            </div>
          )}

          {/* Last scanned hero */}
          {lastScan ? (
            <div className={`rounded-xl border-2 p-4 transition-all ${
              lastScan.status === "placed" ? "border-green-400 bg-green-50" :
              lastScan.status === "unassigned" ? "border-amber-400 bg-amber-50" :
              "border-red-400 bg-red-50"
            }`}>
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white text-xl font-bold ${
                  lastScan.status === "placed" ? "bg-green-500" :
                  lastScan.status === "unassigned" ? "bg-amber-500" : "bg-red-500"
                }`}>
                  {lastScan.status === "placed" ? "✓" : lastScan.status === "unassigned" ? "?" : "!"}
                </div>
                {lastScan.status === "foreign" ? (
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold uppercase tracking-widest text-red-700">Foreign Bird</span>
                    <p className="text-xl font-bold font-mono mt-0.5">{lastScan.rfid}</p>
                    <p className="text-sm text-muted-foreground">Not registered in this event</p>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-bold uppercase tracking-widest ${
                      lastScan.status === "placed" ? "text-green-700" : "text-amber-700"
                    }`}>
                      {lastScan.status === "placed" ? "Place in Basket" : "Not Basketed Yet"}
                    </span>
                    <p className="text-xl font-bold font-mono mt-0.5">{lastScan.bird?.band ?? "—"}</p>
                    {lastScan.bird?.birdName && <p className="text-sm text-muted-foreground">{lastScan.bird.birdName}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                      {lastScan.status === "placed" && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Basket</p>
                          <p className="font-medium">{lastScan.basket.label} <span className="text-muted-foreground">({lastScan.basket.count}/{lastScan.basket.capacity})</span></p>
                        </div>
                      )}
                      <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Loft</p><p>{lastScan.loftName ?? "—"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Breeder</p><p>{breederName(lastScan.breeder) ?? "—"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">RFID</p><p className="font-mono text-xs">{lastScan.bird?.rfid ?? "—"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Color</p><p>{lastScan.bird?.color ?? "—"}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sex</p><p>{lastScan.bird?.sex === 1 ? "Cock" : lastScan.bird?.sex === 2 ? "Hen" : "—"}</p></div>
                    </div>
                    {lastScan.status === "unassigned" && (
                      <p className="mt-2 text-sm text-amber-700">Not in a loft basket — run <strong>Set Baskets</strong> or it was skipped.</p>
                    )}
                    {lastScan.bird?.attention && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                        <p className="text-base font-bold text-red-700">ATTENTION REQUIRED</p>
                      </div>
                    )}
                    {lastScan.bird?.note && (
                      <div className="mt-2 rounded-lg bg-yellow-50 border border-yellow-300 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Note</p>
                        <p className="text-base font-bold text-yellow-900">{lastScan.bird.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
              Scan a bird to see which basket to place it in
            </div>
          )}

          {/* Scan log */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {scannedLog.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">No birds scanned yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Band</th>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Loft</th>
                    <th className="px-3 py-2 text-left font-medium">Breeder</th>
                    <th className="px-3 py-2 text-left font-medium">Basket</th>
                    <th className="px-3 py-2 text-left font-medium">Scanned At</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {scannedLog.map((row, i) => (
                    <tr key={`${row.band}-${row.scannedAt}`}>
                      <td className="px-3 py-2 text-muted-foreground">{scannedLog.length - i}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.band || "—"}</td>
                      <td className="px-3 py-2 font-medium">{row.birdName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.loftName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.breeder || "—"}</td>
                      <td className="px-3 py-2 text-primary font-medium">{row.basketLabel}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(row.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          <div className="flex justify-center gap-10">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{basketedTotal}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Basketed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{Math.max(basketedTotal - scannedLog.length, 0)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Left to Scan</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{foreignCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Foreign</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground">{ignoredCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ignored</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

type SortKey =
  | "breeder"
  | "band"
  | "rfid"
  | "color"
  | "sex"
  | "lost"
  | "loftBasket"
  | "loftBasketed"
  | "raceBasket"
  | "raceAssignedAt";
type SortDir = "asc" | "desc";

type EntryRow = {
  id: number;
  birdId: number | null;
  ignored: boolean;
  breeder: string;
  band: string;
  rfid: string;
  color: string;
  sex: string;
  lost: boolean;
  loftBasket: string;
  loftBasketed: boolean;
  raceBasket: string;
  raceAssignedAt: string;
  attention: boolean;
  note: string;
};

const ENTRY_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "breeder", label: "Breeder" },
  { key: "band", label: "Band" },
  { key: "rfid", label: "EID" },
  { key: "color", label: "Color" },
  { key: "lost", label: "Lost" },
  { key: "loftBasket", label: "Loft basket" },
  { key: "loftBasketed", label: "Loft basketed" },
  { key: "raceBasket", label: "Race basket" },
  { key: "raceAssignedAt", label: "Race basket time" },
  { key: "sex", label: "Sex" },
];

const yesNo = (v: boolean) => (v ? "Yes" : "No");

const formatBasketTime = (iso: string) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "medium" }) : "";

function toEntryRows(items: CheckinStatusItem[]): EntryRow[] {
  return items.map((item) => ({
    id: item.id,
    birdId: item.bird?.id ?? null,
    ignored: item.isIgnored ?? false,
    breeder: [item.breeder?.lastName?.toUpperCase(), item.breeder?.firstName]
      .filter(Boolean)
      .join(", "),
    band: item.bird?.band ?? "",
    rfid: item.bird?.rfid ?? "",
    color: item.bird?.color ?? "",
    sex: item.bird?.sex === 1 ? "Cock" : item.bird?.sex === 2 ? "Hen" : "",
    lost: item.isLost ?? false,
    loftBasket: item.isLoftBasketed
      ? item.loftBasketLabel || `Basket #${item.loftBasketNo ?? "?"}`
      : "",
    loftBasketed: item.isLoftBasketed ?? false,
    raceBasket: item.isRaceBasketed
      ? item.raceBasketLabel || `Basket #${item.raceBasketNo ?? "?"}`
      : "",
    raceAssignedAt: item.raceAssignedAt ?? "",
    attention: item.bird?.attention ?? false,
    note: item.bird?.note ?? "",
  }));
}

/** The cell text for a column — shared by the grid, the sort and the CSV export. */
function entryCell(row: EntryRow, key: SortKey): string {
  const v = row[key];
  if (typeof v === "boolean") return yesNo(v);
  return key === "raceAssignedAt" ? formatBasketTime(v) : v;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

/**
 * HayLoft's "Entries" grid: every registered bird of the season, one row each,
 * with where it sits in the selected race's baskets — basketed or not.
 */
function EntriesTable({
  eventId,
  raceId,
  phase,
  baskets,
  races,
  onRaceChange,
}: {
  eventId: string;
  raceId: string;
  /** The panel's basket phase; drives the Capacity / Occupancy totals. */
  phase?: "LOFT" | "RACE";
  baskets?: EventBasketItem[];
  /** Pass both to show a race picker in the toolbar (panels without their own). */
  races?: Race[];
  onRaceChange?: (raceId: string) => void;
}) {
  const { selectedSeasonId } = useSeasonContext();
  const { data, isPending, refetch } = useCheckinStatus(eventId, selectedSeasonId, raceId || undefined);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("breeder");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [printing, setPrinting] = useState(false);
  const [editBirdId, setEditBirdId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const runAction = async (row: EntryRow, url: string, init: RequestInit, okMsg: string) => {
    setBusyId(row.id);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Request failed");
      toast.success(body.message || okMsg);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusyId(null);
    }
  };

  const toggleMark = (row: EntryRow) =>
    row.birdId &&
    runAction(
      row,
      apiEndpoints.admin.birds.birdById(row.birdId),
      { method: "PATCH", body: JSON.stringify({ attention: !row.attention }) },
      row.attention ? "Mark cleared" : "Bird marked"
    );

  const toggleIgnore = (row: EntryRow) =>
    raceId &&
    runAction(
      row,
      row.ignored ? apiEndpoints.races.ignoreBird(raceId, row.id) : apiEndpoints.races.ignoreBirds(raceId),
      row.ignored ? { method: "DELETE" } : { method: "POST", body: JSON.stringify({ inventoryItemId: row.id }) },
      row.ignored ? "Bird re-included" : "Bird ignored"
    );

  // Queries never go stale on their own and basket mutations only invalidate
  // the basket queries, so refresh on mount and whenever the baskets change.
  const basketSig = (baskets ?? [])
    .map((b) => `${b.id}:${b._count?.assignments ?? b.assignments?.length ?? 0}:${b.label ?? ""}`)
    .join("|");
  useEffect(() => {
    refetch();
  }, [basketSig, refetch]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  const allRows = useMemo(
    () => toEntryRows((data?.items ?? []) as CheckinStatusItem[]),
    [data]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allRows.filter((r) =>
          [r.breeder, r.band, r.rfid].some((v) => v.toLowerCase().includes(q))
        )
      : allRows;
    return [...filtered].sort((a, b) => {
      const av = sortKey === "raceAssignedAt" ? a.raceAssignedAt : entryCell(a, sortKey);
      const bv = sortKey === "raceAssignedAt" ? b.raceAssignedAt : entryCell(b, sortKey);
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allRows, search, sortKey, sortDir]);

  const handleSort = (col: SortKey) => {
    if (col === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
  };

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    const escape = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      [...ENTRY_COLUMNS.map((c) => c.label), "Flags"],
      ...rows.map((r) => [
        ...ENTRY_COLUMNS.map((c) => entryCell(r, c.key)),
        [r.attention ? "Marked" : "", r.ignored ? "Ignored" : "", r.note].filter(Boolean).join(" - "),
      ]),
    ];
    const csv = lines.map((l) => l.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `entries-race-${raceId || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals: { label: string; value: number }[] = [
    { label: "Race basketed", value: allRows.filter((r) => r.raceBasket !== "").length },
    { label: "Loft basketed", value: allRows.filter((r) => r.loftBasketed).length },
    { label: "Total birds", value: allRows.length },
  ];
  if (phase && baskets) {
    totals.push(
      { label: "Capacity", value: baskets.reduce((s, b) => s + b.capacity, 0) },
      {
        label: "Occupancy",
        value: baskets.reduce((s, b) => s + (b._count?.assignments ?? b.assignments?.length ?? 0), 0),
      }
    );
  }

  return (
    <div id="entries-print" className="space-y-3">
      {printing && (
        <style>{`@media print {
  body * { visibility: hidden !important; }
  #entries-print, #entries-print * { visibility: visible !important; }
  #entries-print { position: absolute; left: 0; top: 0; width: 100%; }
}`}</style>
      )}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search breeder, band or EID"
            className="h-8 w-64 pl-8 text-sm"
          />
        </div>
        {races && onRaceChange && (
          <Select value={raceId} onValueChange={onRaceChange}>
            <SelectTrigger className="h-8 w-[220px] text-sm">
              <SelectValue placeholder="Select a race" />
            </SelectTrigger>
            <SelectContent>
              {races.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name ?? `Race ${r.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {search.trim() && (
          <span className="text-xs text-muted-foreground">
            Showing {rows.length} of {allRows.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
            <Download className="h-4 w-4" />Export CSV
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPrinting(true)}>
            <Printer className="h-4 w-4" />Print
          </Button>
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="rounded-lg border overflow-auto max-h-[32rem] print:max-h-none print:overflow-visible">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground sticky top-0">
              <tr>
                {ENTRY_COLUMNS.map(({ key, label }) => (
                  <th key={key} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort(key)}>
                      {label}
                      <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-medium">Flags</th>
                <th className="px-3 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={ENTRY_COLUMNS.length + 2} className="px-3 py-6 text-center text-muted-foreground">
                    {allRows.length === 0 ? "No birds registered for this season" : "No birds match the search"}
                  </td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r.id} className={`${r.attention ? "bg-red-50" : "hover:bg-muted/40 transition-colors"} ${r.ignored ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{r.breeder || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.band || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.rfid || "—"}</td>
                  <td className="px-3 py-2">{r.color || "—"}</td>
                  <td className="px-3 py-2">
                    {r.lost ? <Badge variant="destructive" className="text-[10px] px-1.5">Yes</Badge> : "No"}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.loftBasket || "—"}</td>
                  <td className="px-3 py-2">{yesNo(r.loftBasketed)}</td>
                  <td className="px-3 py-2 font-medium">{r.raceBasket || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatBasketTime(r.raceAssignedAt) || "—"}
                  </td>
                  <td className="px-3 py-2">{r.sex || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {r.attention && <Badge variant="destructive" className="text-[10px] px-1">!</Badge>}
                      {r.ignored && <Badge variant="outline" className="text-[10px] px-1">Ignored</Badge>}
                      {r.note && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={r.note}>{r.note}</span>}
                    </div>
                  </td>
                  <td className="px-2 py-1 print:hidden">
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit bird"
                        disabled={!r.birdId} onClick={() => setEditBirdId(r.birdId)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title={r.attention ? "Clear mark" : "Mark bird"}
                        disabled={!r.birdId || busyId === r.id} onClick={() => toggleMark(r)}>
                        <Flag className={`h-3.5 w-3.5 ${r.attention ? "fill-red-500 text-red-500" : ""}`} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        title={!raceId ? "Select a race to ignore birds" : r.ignored ? "Re-include in race" : "Ignore bird for this race"}
                        disabled={!raceId || busyId === r.id} onClick={() => toggleIgnore(r)}>
                        <Ban className={`h-3.5 w-3.5 ${r.ignored ? "text-destructive" : ""}`} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        {totals.map((t) => (
          <span key={t.label}>
            <span className="text-muted-foreground">{t.label}:</span>{" "}
            <span className="font-semibold tabular-nums">{t.value}</span>
          </span>
        ))}
      </div>

      {editBirdId != null && (
        <EntryBirdEditor
          birdId={editBirdId}
          onClose={() => setEditBirdId(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

/** Loads the full bird, then reuses the bird page's edit dialog. */
function EntryBirdEditor({ birdId, onClose, onSaved }: { birdId: number; onClose: () => void; onSaved: () => void }) {
  const { data } = useBird(birdId, "ADMIN");
  const bird = (data as { bird?: Bird } | undefined)?.bird;
  if (!bird) return null;
  return (
    <BirdEditDialog
      key={bird.id}
      bird={bird}
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      onSaved={() => { onSaved(); onClose(); }}
    />
  );
}

function PersistedBasketsView({
  eventId,
  raceId,
  baskets,
  isPending,
  phase,
  onDelete,
  onMove,
  onEdit,
}: {
  eventId: string;
  raceId: string;
  baskets: EventBasketItem[];
  isPending: boolean;
  phase: "Loft" | "Race";
  onDelete?: (basket: EventBasketItem) => void;
  onMove?: (basket: EventBasketItem) => void;
  onEdit?: (basket: EventBasketItem) => void;
}) {
  const [view, setView] = useState<"grouped" | "table">("table");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {view === "grouped" ? `${phase} Baskets` : "Entries"}
            {view === "grouped" && <Badge variant="secondary" className="ml-2">{baskets.length}</Badge>}
          </CardTitle>
          <div className="flex items-center rounded-md border">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-l-md transition-colors ${view === "grouped" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setView("grouped")}
            >
              <LayoutList className="h-3.5 w-3.5" />Grouped
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-r-md transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setView("table")}
            >
              <Table2 className="h-3.5 w-3.5" />Entries
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {view === "table" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
            <EntriesTable
              eventId={eventId}
              raceId={raceId}
              phase={phase === "Loft" ? "LOFT" : "RACE"}
              baskets={baskets}
            />
            <div className="rounded-lg border overflow-auto max-h-[36rem] self-start print:hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{phase} basket</th>
                    <th className="px-3 py-2 text-right font-medium">Capacity</th>
                    <th className="px-3 py-2 text-right font-medium">Occupied</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {baskets.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No {phase.toLowerCase()} baskets yet</td></tr>
                  ) : baskets.map((b) => {
                    const occupied = b._count?.assignments ?? b.assignments?.length ?? 0;
                    return (
                      <tr key={b.id} className={occupied > b.capacity ? "bg-red-50" : undefined}>
                        <td className="px-3 py-1.5 font-medium">{b.label ?? `#${b.basketNo}`}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{b.capacity}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{occupied}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : baskets.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No {phase.toLowerCase()} baskets yet.
          </div>
        ) : (
          <div className="space-y-2">
            {baskets.map((basket) => (
              <PersistedBasketCard key={basket.id} basket={basket} onDelete={onDelete} onMove={onMove} onEdit={onEdit} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PersistedBasketCard({
  basket,
  onDelete,
  onMove,
  onEdit,
}: {
  basket: EventBasketItem;
  onDelete?: (basket: EventBasketItem) => void;
  onMove?: (basket: EventBasketItem) => void;
  onEdit?: (basket: EventBasketItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const birdCount = basket._count?.assignments ?? basket.assignments?.length ?? 0;
  const breeders = [
    ...new Set(
      (basket.assignments || [])
        .map((a) => a.inventoryItem?.eventInventory?.breeder?.lastName)
        .filter(Boolean)
    ),
  ];

  return (
    <div className="border rounded-lg">
      <div className="flex items-center">
        <button
          className="flex-1 flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">{basket.label || `Basket #${basket.basketNo}`}</span>
            <Badge variant="secondary">{birdCount}/{basket.capacity}</Badge>
          </div>
          <span className="text-sm text-muted-foreground">{breeders.join(", ")}</span>
        </button>
        <div className="flex items-center mr-2">
          {onEdit && (
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onEdit(basket)} title="Edit">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onMove && (
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => onMove(basket)} title="Clear">
              <ArrowRightLeft className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button className="p-2 text-muted-foreground hover:text-destructive transition-colors" onClick={() => onDelete(basket)} title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {expanded && basket.assignments && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-medium">Band</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium">Name</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium">Breeder</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium">Color</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium">Sex</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium">Basketed At</th>
                <th className="px-3 py-1.5 text-left text-xs font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...basket.assignments]
                .sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime())
                .map((a) => {
                  const bird = a.inventoryItem?.bird;
                  const breeder = a.inventoryItem?.eventInventory?.breeder;
                  return (
                    <tr key={a.id} className={bird?.attention ? "bg-red-50" : undefined}>
                      <td className="px-3 py-1.5 font-mono text-xs">{bird?.band ?? "—"}</td>
                      <td className="px-3 py-1.5">{bird?.birdName ?? "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{breeder?.lastName ?? "—"}</td>
                      <td className="px-3 py-1.5">{bird?.color ?? "—"}</td>
                      <td className="px-3 py-1.5">{bird?.sex === 1 ? "Cock" : bird?.sex === 2 ? "Hen" : "—"}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        {(() => { const t = a.inventoryItem?.birdEventHistory?.[0]?.createdAt ?? a.assignedAt; return t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"; })()}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          {bird?.attention && <Badge variant="destructive" className="text-[10px] px-1">!</Badge>}
                          {bird?.note && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={bird.note}>{bird.note}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
