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
import { ChevronDown, ChevronRight, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useEventBaskets,
  useGenerateLoftBaskets,
  useGenerateRaceBaskets,
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

function LoftBasketPanel({ eventId }: { eventId: string }) {
  const { data, isPending, refetch } = useEventBaskets(eventId, "LOFT");
  const generateMutation = useGenerateLoftBaskets(eventId);

  const [showBulk, setShowBulk] = useState(false);
  const [capacity, setCapacity] = useState("20");
  const [preview, setPreview] = useState<PreviewBasket[] | null>(null);
  const [previewSummary, setPreviewSummary] = useState<{ total: number; basketCount: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const baskets: EventBasketItem[] = data?.baskets || [];
  const hasExisting = baskets.length > 0;

  const handlePreview = async () => {
    const cap = parseInt(capacity);
    if (isNaN(cap) || cap < 1) {
      toast.error("Capacity must be a positive number");
      return;
    }
    try {
      const res = await generateMutation.mutateAsync({ capacity: cap, preview: true });
      const result = (res as any)?.data || res;
      if (result?.baskets?.length === 0) {
        toast.info(result.message || "No checked-in birds found");
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
    const cap = parseInt(capacity);
    if (isNaN(cap) || cap < 1) {
      toast.error("Capacity must be a positive number");
      return;
    }
    try {
      await generateMutation.mutateAsync({ capacity: cap, preview: false });
      toast.success("Loft baskets generated");
      setPreview(null);
      setPreviewSummary(null);
      setShowBulk(false);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate");
    }
  };

  return (
    <>
      {/* Info card */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Loft baskets are created automatically when scanning birds on the Check-in tab.
            Use bulk generate below as a fallback.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5"
            onClick={() => setShowBulk(!showBulk)}
          >
            <Sparkles className="h-4 w-4" />
            {showBulk ? "Hide Bulk Generate" : "Bulk Generate"}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk generate (collapsed by default) */}
      {showBulk && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-[200px]">
                <Label htmlFor="loft-capacity">Basket Capacity</Label>
                <Input
                  id="loft-capacity"
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
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
      )}

      {/* Preview */}
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

      {/* Persisted Baskets (read-only view) */}
      {!preview && (
        <PersistedBasketsView baskets={baskets} isPending={isPending} phase="Loft" />
      )}

      {/* Confirm Regenerate */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Existing Loft Baskets?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all existing loft baskets and create new ones. This action cannot be undone.
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
            <div className="flex-1 max-w-[200px]">
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
}: {
  baskets: EventBasketItem[];
  isPending: boolean;
  phase: string;
}) {
  if (isPending) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (baskets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No {phase.toLowerCase()} baskets generated yet.
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
            <PersistedBasketCard key={basket.id} basket={basket} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PersistedBasketCard({ basket }: { basket: EventBasketItem }) {
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
          <span className="font-medium">{basket.label || `Basket #${basket.basketNo}`}</span>
          <Badge variant="secondary">
            {birdCount}/{basket.capacity}
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {breeders.join(", ")}
        </span>
      </button>
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
