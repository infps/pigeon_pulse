"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSeasonContext } from "@/lib/season-context";
import type { DefaulterBreeder, EventInventoryItem, Event } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BreederDetailsDialog } from "@/components/breeder-details-dialog";

interface DefaultersTabProps {
  eventId: string;
  event: Event;
}

interface DefaultersResponse {
  defaulters: DefaulterBreeder[];
  isInDefaulterWindow: boolean;
  paymentRaceDate: string | null;
}

function formatCurrency(n: number) {
  return `$${n.toFixed(2)}`;
}

function getBirdLabel(bird: EventInventoryItem) {
  const b = bird.bird;
  if (!b) return `#${bird.birdNo ?? "?"}`;
  const band = [b.band1, b.band2, b.band3, b.band4].filter(Boolean).join("-") || b.band || "?";
  const sex = b.sex === 1 ? "Cock" : b.sex === 0 ? "Hen" : null;
  const parts = [band, b.color, sex].filter(Boolean).join(" · ");
  return parts;
}

export function DefaultersTab({ eventId, event }: DefaultersTabProps) {
  const qc = useQueryClient();
  const { selectedSeasonId } = useSeasonContext();
  const [storePriceInputs, setStorePriceInputs] = useState<Record<number, string>>({});
  const [selectBirdsOpen, setSelectBirdsOpen] = useState<DefaulterBreeder | null>(null);
  const [selectedBirdIds, setSelectedBirdIds] = useState<Set<number>>(new Set());
  const [detailsDialogId, setDetailsDialogId] = useState<number | null>(null);

  const { data, isPending, isError } = useQuery<DefaultersResponse>({
    queryKey: ["defaulters", eventId, String(selectedSeasonId ?? "")],
    queryFn: () => {
      const params = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";
      return fetch(`/api/admin/event/${eventId}/defaulters${params}`).then((r) => r.json());
    },
  });

  const cashPromiseMutation = useMutation({
    mutationFn: (inventoryId: number) =>
      fetch(`/api/admin/event/${eventId}/event-inventory/${inventoryId}/cash-promise`, {
        method: "POST",
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["defaulters", eventId] });
      toast.success("Cash promise toggled");
    },
    onError: () => toast.error("Failed to toggle cash promise"),
  });

  const moveToStoreMutation = useMutation({
    mutationFn: ({
      breederId,
      itemIds,
      listingPrice,
    }: {
      breederId: number;
      itemIds: number[];
      listingPrice: number;
    }) =>
      fetch(`/api/admin/event/${eventId}/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breederId, itemIds, listingPrice }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message);
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["defaulters", eventId] });
      qc.invalidateQueries({ queryKey: ["event-store", eventId] });
      toast.success("Birds moved to store");
      setSelectBirdsOpen(null);
      setSelectedBirdIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getPriceFor = useCallback(
    (inventoryId: number) => parseFloat(storePriceInputs[inventoryId] ?? "0"),
    [storePriceInputs]
  );

  const handleMoveAll = (d: DefaulterBreeder) => {
    const price = getPriceFor(d.eventInventoryId);
    if (!price || price <= 0) {
      toast.error("Set a listing price first");
      return;
    }
    moveToStoreMutation.mutate({
      breederId: d.breederId,
      itemIds: d.birds.map((b) => b.id),
      listingPrice: price,
    });
  };

  const handleMoveSelected = () => {
    if (!selectBirdsOpen) return;
    const price = getPriceFor(selectBirdsOpen.eventInventoryId);
    if (!price || price <= 0) {
      toast.error("Set a listing price first");
      return;
    }
    if (selectedBirdIds.size === 0) {
      toast.error("Select at least one bird");
      return;
    }
    moveToStoreMutation.mutate({
      breederId: selectBirdsOpen.breederId,
      itemIds: [...selectedBirdIds],
      listingPrice: price,
    });
  };

  const openSelectBirds = (d: DefaulterBreeder) => {
    setSelectBirdsOpen(d);
    setSelectedBirdIds(new Set());
  };

  if (isPending) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-red-500 text-center py-12">Error loading defaulters</p>;
  }

  const { defaulters, isInDefaulterWindow, paymentRaceDate } = data;

  if (!isInDefaulterWindow) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {paymentRaceDate
          ? `Defaulter window opens ${new Date(paymentRaceDate).toLocaleDateString()} (7 days before payment-required race)`
          : "No payment-required races configured for this event."}
      </div>
    );
  }

  const actionable = defaulters.filter((d) => !d.cashPromised);
  const cashPromised = defaulters.filter((d) => d.cashPromised);

  const renderRow = (d: DefaulterBreeder) => (
    <div key={d.eventInventoryId} className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span
            className="font-semibold cursor-pointer text-blue-600 hover:underline"
            onClick={() => setDetailsDialogId(d.eventInventoryId)}
          >
            {d.breederName}
          </span>
          {d.loft && <span className="text-muted-foreground text-sm ml-2">({d.loft})</span>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{formatCurrency(d.balanceOwed)} owed</Badge>
          <Badge variant="secondary">{d.birds.length} bird(s)</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="Listing price"
          className="h-8 w-36"
          value={storePriceInputs[d.eventInventoryId] ?? ""}
          onChange={(e) =>
            setStorePriceInputs((prev) => ({ ...prev, [d.eventInventoryId]: e.target.value }))
          }
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => cashPromiseMutation.mutate(d.eventInventoryId)}
          disabled={cashPromiseMutation.isPending}
        >
          {d.cashPromised ? "Unmark Cash Promise" : "Mark Cash Promise"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleMoveAll(d)}
          disabled={moveToStoreMutation.isPending}
        >
          Move All to Store
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openSelectBirds(d)}
        >
          Select Birds → Store
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {actionable.length === 0 && cashPromised.length === 0 && (
        <p className="text-center py-12 text-muted-foreground">No defaulters for this event.</p>
      )}

      {actionable.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Actionable ({actionable.length})
          </h3>
          {actionable.map(renderRow)}
        </div>
      )}

      {cashPromised.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Cash Promised ({cashPromised.length})
          </h3>
          {cashPromised.map(renderRow)}
        </div>
      )}

      <BreederDetailsDialog
        open={detailsDialogId !== null}
        onOpenChange={(open) => { if (!open) setDetailsDialogId(null); }}
        eventInventoryId={detailsDialogId}
        event={event}
      />

      {/* Bird selector dialog */}
      <Dialog
        open={!!selectBirdsOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectBirdsOpen(null);
            setSelectedBirdIds(new Set());
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Birds — {selectBirdsOpen?.breederName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectBirdsOpen?.birds.map((bird) => (
              <label
                key={bird.id}
                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedBirdIds.has(bird.id)}
                  onCheckedChange={(checked) => {
                    setSelectedBirdIds((prev) => {
                      const next = new Set(prev);
                      checked ? next.add(bird.id) : next.delete(bird.id);
                      return next;
                    });
                  }}
                />
                <span className="flex-1">{getBirdLabel(bird)}</span>
                {bird.bird?.isLost === 1 && <Badge variant="destructive" className="text-xs">Lost</Badge>}
                {bird.bird?.isActive === 0 && bird.bird?.isLost !== 1 && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={handleMoveSelected}
              disabled={moveToStoreMutation.isPending || selectedBirdIds.size === 0}
            >
              Move {selectedBirdIds.size} to Store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
