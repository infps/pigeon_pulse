"use client";

import { useState } from "react";
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
import { AlertTriangle, ChevronDown, ChevronRight, Eye, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  useEventBaskets,
  useCreateLoftBasket,
  useDeleteLoftBasket,
  useGenerateRaceBaskets,
  useAssignBaskets,
} from "@/lib/api/event-baskets";
import type { EventBasketItem, PreviewBasket } from "@/lib/types";

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
  const createMutation = useCreateLoftBasket(eventId);
  const deleteMutation = useDeleteLoftBasket(eventId);
  const assignMutation = useAssignBaskets(eventId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [assignPreview, setAssignPreview] = useState<AssignPreviewItem[] | null>(null);
  const [assignUnassigned, setAssignUnassigned] = useState<UnassignedItem[]>([]);
  const [assignSummary, setAssignSummary] = useState<AssignSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const baskets: EventBasketItem[] = data?.baskets || [];

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
      await createMutation.mutateAsync({ capacity: cap });
      toast.success(`Basket #${basketNo} created`);
      refetch();
      if (keepOpen) {
        setBasketNo(basketNo + 1);
        setCapacity("");
      } else {
        setDialogOpen(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create basket");
    }
  };

  const handleDelete = async (basket: EventBasketItem) => {
    try {
      await deleteMutation.mutateAsync({ basketId: basket.id });
      toast.success(`Basket #${basket.basketNo} deleted`);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete basket");
    }
  };

  const handlePreviewAssign = async () => {
    try {
      const res = await assignMutation.mutateAsync({ preview: true });
      const result = (res as any)?.data || res;
      if (!result?.assigned?.length && !result?.unassigned?.length) {
        toast.info(result?.message || "No registered birds found");
        return;
      }
      setAssignPreview(result.assigned);
      setAssignUnassigned(result.unassigned ?? []);
      setAssignSummary(result.summary);
    } catch (error: any) {
      toast.error(error?.message || "Failed to preview assignment");
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
    } catch (error: any) {
      toast.error(error?.message || "Failed to assign baskets");
    }
  };

  const hasExistingAssignments = baskets.some(
    (b) => (b._count?.assignments ?? b.assignments?.length ?? 0) > 0
  );

  return (
    <>
      <Card>
        <CardContent className="pt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Create baskets below, then use <strong>Set Baskets</strong> to auto-assign birds via BFD.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={hasExistingAssignments ? () => setConfirmOpen(true) : handlePreviewAssign}
              disabled={assignMutation.isPending || baskets.length === 0}
            >
              <Wand2 className="h-4 w-4" />
              {assignMutation.isPending ? "Running..." : "Set Baskets"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openDialog}>
              <Plus className="h-4 w-4" />
              Add New Basket
            </Button>
          </div>
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
            <DialogTitle>Add New Basket</DialogTitle>
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
// RACE BASKET PANEL
// ============================================================

function RaceBasketPanel({ eventId }: { eventId: string }) {
  const { data: loftData } = useEventBaskets(eventId, "LOFT");
  const { data, isPending, refetch } = useEventBaskets(eventId, "RACE");
  const generateMutation = useGenerateRaceBaskets(eventId);

  const [birdsPerBasket, setBirdsPerBasket] = useState("5");
  const [preview, setPreview] = useState<PreviewBasket[] | null>(null);
  const [previewSummary, setPreviewSummary] = useState<{ total: number; basketCount: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loftBaskets: EventBasketItem[] = loftData?.baskets || [];
  const baskets: EventBasketItem[] = data?.baskets || [];
  const hasExisting = baskets.length > 0;

  if (loftBaskets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Generate loft baskets first before creating race baskets.
        </CardContent>
      </Card>
    );
  }

  const handlePreview = async () => {
    const count = parseInt(birdsPerBasket);
    if (isNaN(count) || count < 1) {
      toast.error("Birds per basket must be a positive number");
      return;
    }
    try {
      const res = await generateMutation.mutateAsync({ birdsPerBasket: count, preview: true });
      const result = (res as any)?.data || res;
      if (result?.baskets?.length === 0) {
        toast.info(result.message || "No birds available");
        return;
      }
      setPreview(result.baskets);
      setPreviewSummary(result.summary);
    } catch (error: any) {
      toast.error(error?.message || "Failed to preview");
    }
  };

  const handleGenerate = async () => {
    if (hasExisting) {
      setConfirmOpen(true);
      return;
    }
    await doGenerate();
  };

  const doGenerate = async () => {
    const count = parseInt(birdsPerBasket);
    if (isNaN(count) || count < 1) {
      toast.error("Birds per basket must be a positive number");
      return;
    }
    try {
      await generateMutation.mutateAsync({ birdsPerBasket: count, preview: false });
      toast.success("Race baskets generated");
      setPreview(null);
      setPreviewSummary(null);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate");
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-50">
              <Label htmlFor="race-birds-per-basket">Birds Per Basket</Label>
              <Input
                id="race-birds-per-basket"
                type="number"
                min="1"
                value={birdsPerBasket}
                onChange={(e) => setBirdsPerBasket(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={generateMutation.isPending}
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {generateMutation.isPending ? "Generating..." : hasExisting ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Preview
              <Badge variant="secondary">
                {previewSummary?.total} birds in {previewSummary?.basketCount} baskets
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {preview.map((basket) => (
                <BasketPreviewCard key={basket.basketNo} basket={basket} />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={doGenerate} disabled={generateMutation.isPending}>
                Confirm & Save
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!preview && (
        <PersistedBasketsView baskets={baskets} isPending={isPending} phase="Race" />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Existing Race Baskets?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all existing race baskets and create new ones. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                doGenerate();
              }}
            >
              Replace
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

function BasketPreviewCard({ basket }: { basket: PreviewBasket }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">Basket #{basket.basketNo}</span>
          <Badge variant="secondary">{basket.birdCount} birds</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {basket.breeders.join(", ")}
        </span>
      </button>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-1">
          {basket.birds.map((bird) => (
            <div key={bird.id} className="flex items-center gap-3 text-sm py-0.5">
              <span className="font-mono text-xs text-muted-foreground w-32 truncate">
                {bird.band || "N/A"}
              </span>
              <span className="flex-1">{bird.name || "N/A"}</span>
              <span className="text-muted-foreground">{bird.breeder}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
