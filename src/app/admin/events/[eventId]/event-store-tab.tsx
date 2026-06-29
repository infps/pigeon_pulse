"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EventStoreListing } from "@/lib/types";
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
import { useListEventInventory } from "@/lib/api/event-inventory";
import type { EventInventory } from "@/lib/types";

interface EventStoreTabProps {
  eventId: string;
}

export function EventStoreTab({ eventId }: EventStoreTabProps) {
  const qc = useQueryClient();
  const [purchaseDialogListing, setPurchaseDialogListing] = useState<EventStoreListing | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>("");

  const { data, isPending, isError } = useQuery<{ listings: EventStoreListing[] }>({
    queryKey: ["event-store", eventId],
    queryFn: () =>
      fetch(`/api/admin/event/${eventId}/store`).then((r) => r.json()),
  });

  const { data: inventoryData } = useListEventInventory(eventId, {});

  const purchaseMutation = useMutation({
    mutationFn: ({ listingId, buyerBreederId }: { listingId: number; buyerBreederId: number }) =>
      fetch(`/api/admin/event/${eventId}/store/${listingId}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerBreederId }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-store", eventId] });
      toast.success("Purchase recorded");
      setPurchaseDialogListing(null);
      setSelectedBuyerId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (listingId: number) =>
      fetch(`/api/admin/event/${eventId}/store`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-store", eventId] });
      toast.success("Listing removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAssignPurchase = () => {
    if (!purchaseDialogListing || !selectedBuyerId) return;
    purchaseMutation.mutate({
      listingId: purchaseDialogListing.id,
      buyerBreederId: parseInt(selectedBuyerId),
    });
  };

  if (isPending) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-red-500 text-center py-12">Error loading store</p>;
  }

  const listings = data.listings ?? [];
  const available = listings.filter((l) => l.status === "AVAILABLE");
  const sold = listings.filter((l) => l.status === "SOLD");

  const breeders: EventInventory[] = inventoryData?.eventInventory ?? [];

  const renderListing = (l: EventStoreListing) => {
    const birdCount = l.items?.length ?? 0;
    const originalName = l.originalBreeder
      ? `${l.originalBreeder.firstName ?? ""} ${l.originalBreeder.lastName ?? ""}`.trim()
      : `Breeder #${l.originalBreederId}`;
    const buyerName = l.purchasedBy
      ? `${l.purchasedBy.firstName ?? ""} ${l.purchasedBy.lastName ?? ""}`.trim()
      : null;

    return (
      <div key={l.id} className="border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="font-semibold">{originalName}</span>
            <span className="text-muted-foreground text-sm ml-2">
              {birdCount} bird(s) — ${l.listingPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={l.status === "SOLD" ? "secondary" : "default"}>
              {l.status}
            </Badge>
            {l.status === "AVAILABLE" && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setPurchaseDialogListing(l);
                    setSelectedBuyerId("");
                  }}
                >
                  Assign Purchase
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Remove this listing?")) deleteMutation.mutate(l.id);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Remove
                </Button>
              </>
            )}
          </div>
        </div>
        {l.status === "SOLD" && buyerName && (
          <p className="text-sm text-muted-foreground">
            Sold to <span className="font-medium">{buyerName}</span>
            {l.purchasedAt && ` on ${new Date(l.purchasedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {listings.length === 0 && (
        <p className="text-center py-12 text-muted-foreground">No store listings for this event.</p>
      )}

      {available.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Available ({available.length})
          </h3>
          {available.map(renderListing)}
        </div>
      )}

      {sold.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Sold ({sold.length})
          </h3>
          {sold.map(renderListing)}
        </div>
      )}

      <Dialog
        open={!!purchaseDialogListing}
        onOpenChange={(open) => {
          if (!open) {
            setPurchaseDialogListing(null);
            setSelectedBuyerId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Purchase</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select the breeder who purchased this listing (${purchaseDialogListing?.listingPrice.toFixed(2)}).
            </p>
            <Select value={selectedBuyerId} onValueChange={setSelectedBuyerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select breeder" />
              </SelectTrigger>
              <SelectContent>
                {breeders
                  .filter((inv) => inv.breederId != null)
                  .map((inv) => {
                    const name = [inv.breeder?.firstName, inv.breeder?.lastName].filter(Boolean).join(" ") || `Breeder #${inv.breederId}`;
                    return (
                      <SelectItem key={inv.breederId!} value={String(inv.breederId!)}>
                        {name}{inv.loft ? ` (${inv.loft})` : ""}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAssignPurchase}
              disabled={!selectedBuyerId || purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? "Saving..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
