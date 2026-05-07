"use client";

import { useEffect, useState } from "react";
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
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  useEventBaskets,
  useCreateBasket,
  useDeleteBasket,
  useAssignBaskets,
  useAssignRaceBaskets,
  useCheckinStatus,
} from "@/lib/api/event-baskets";
import { useListRaces } from "@/lib/api/races";
import type { EventBasketItem, Race } from "@/lib/types";
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
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="loft">Loft Baskets</TabsTrigger>
        <TabsTrigger value="race">Race Baskets</TabsTrigger>
      </TabsList>
      <TabsContent value="loft" className="space-y-4 mt-4">
        <LoftBasketPanel eventId={eventId} />
      </TabsContent>
      <TabsContent value="race" className="space-y-4 mt-4">
        <RaceBasketPanel eventId={eventId} />
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
  const { data, isPending, refetch } = useEventBaskets(eventId, "LOFT");
  const { data: checkinData } = useCheckinStatus(eventId);
  const createMutation = useCreateBasket(eventId);
  const deleteMutation = useDeleteBasket(eventId);
  const assignMutation = useAssignBaskets(eventId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [assignPreview, setAssignPreview] = useState<AssignPreviewItem[] | null>(null);
  const [assignUnassigned, setAssignUnassigned] = useState<UnassignedItem[]>([]);
  const [assignSummary, setAssignSummary] = useState<AssignSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      await createMutation.mutateAsync({ capacity: cap, phase: "LOFT" });
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

  const handleDelete = async (basket: EventBasketItem) => {
    try {
      await deleteMutation.mutateAsync({ basketId: basket.id });
      toast.success(`Basket #${basket.basketNo} deleted`);
      refetch();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to delete basket");
    }
  };

  const handlePreviewAssign = async () => {
    try {
      const res = await assignMutation.mutateAsync({ preview: true });
      const result = (res as { data?: unknown })?.data || res;
      const r = result as { assigned?: AssignPreviewItem[]; unassigned?: UnassignedItem[]; summary?: AssignSummary; message?: string };
      if (!r?.assigned?.length && !r?.unassigned?.length) {
        toast.info(r?.message || "No registered birds found");
        return;
      }
      setAssignPreview(r.assigned ?? []);
      setAssignUnassigned(r.unassigned ?? []);
      setAssignSummary(r.summary ?? null);
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to preview assignment");
    }
  };

  const handleConfirmAssign = async () => {
    try {
      await assignMutation.mutateAsync({ preview: false });
      toast.success("Birds assigned to baskets");
      setAssignPreview(null);
      setAssignUnassigned([]);
      setAssignSummary(null);
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
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Create baskets below, then use <strong>Set Baskets</strong> to auto-assign birds via BFD.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={hasExistingAssignments ? () => setConfirmOpen(true) : handlePreviewAssign}
                disabled={assignMutation.isPending || baskets.length === 0 || insufficient}
                title={insufficient ? `Not enough capacity for ${activeBirds} active birds` : undefined}
              >
                <Wand2 className="h-4 w-4" />
                {assignMutation.isPending ? "Running..." : "Set Baskets"}
              </Button>
              <Button size="sm" className="gap-1.5" onClick={openDialog}>
                <Plus className="h-4 w-4" />
                Add New Basket
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
        baskets={baskets}
        isPending={isPending}
        phase="Loft"
        onDelete={handleDelete}
      />

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
                handlePreviewAssign();
              }}
            >
              Preview & Re-assign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    selectedRaceId || undefined
  );
  const { data: loftData } = useEventBaskets(eventId, "LOFT");
  const createMutation = useCreateBasket(eventId);
  const deleteMutation = useDeleteBasket(eventId);
  const assignMutation = useAssignRaceBaskets(eventId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [preview, setPreview] = useState<RaceBasketPreview[] | null>(null);
  const [previewSummary, setPreviewSummary] = useState<RaceAssignSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"reset" | "incremental">("reset");

  const baskets: EventBasketItem[] = data?.baskets || [];
  const loftBaskets: EventBasketItem[] = loftData?.baskets || [];

  const totalCapacity = baskets.reduce((s, b) => s + b.capacity, 0);
  const activeBirds = loftBaskets.reduce(
    (s, b) => s + (b._count?.assignments ?? b.assignments?.length ?? 0),
    0
  );
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
                    ? "Assign loft baskets first"
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
        baskets={baskets}
        isPending={isPending}
        phase="Race"
        onDelete={handleDelete}
      />

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
    </>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function PersistedBasketsView({
  baskets,
  isPending,
  phase,
  onDelete,
}: {
  baskets: EventBasketItem[];
  isPending: boolean;
  phase: string;
  onDelete?: (basket: EventBasketItem) => void;
}) {
  if (isPending) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (baskets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No {phase.toLowerCase()} baskets yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {phase} Baskets
          <Badge variant="secondary" className="ml-2">
            {baskets.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {baskets.map((basket) => (
            <PersistedBasketCard key={basket.id} basket={basket} onDelete={onDelete} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PersistedBasketCard({
  basket,
  onDelete,
}: {
  basket: EventBasketItem;
  onDelete?: (basket: EventBasketItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const birdCount = basket._count?.assignments ?? basket.assignments?.length ?? 0;
  const isEmpty = birdCount === 0;
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
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="font-medium">{basket.label || `Basket #${basket.basketNo}`}</span>
            <Badge variant="secondary">
              {birdCount}/{basket.capacity}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {breeders.join(", ")}
          </span>
        </button>
        {onDelete && isEmpty && (
          <button
            className="p-2 mr-2 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => onDelete(basket)}
            title="Delete empty basket"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {expanded && basket.assignments && (
        <div className="border-t px-3 py-2 space-y-1">
          {basket.assignments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-sm py-0.5">
              <span className="font-mono text-xs text-muted-foreground w-32 truncate">
                {a.inventoryItem?.bird?.band || "N/A"}
              </span>
              <span className="flex-1">
                {a.inventoryItem?.bird?.birdName || "N/A"}
              </span>
              <span className="text-muted-foreground">
                {a.inventoryItem?.eventInventory?.breeder?.lastName || ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
