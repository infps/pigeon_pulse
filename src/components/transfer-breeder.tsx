"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiEndpoints } from "@/lib/endpoints";
import type { EventInventoryItem } from "@/lib/types";

/** Pick a breeder and move a registered bird's entry to them (POST transfer-breeder). */
export function TransferBreederForm({
  item,
  onSuccess,
}: {
  item: EventInventoryItem | null;
  onSuccess?: () => void;
}) {
  const [transferBreederId, setTransferBreederId] = useState("");
  const [transferring, setTransferring] = useState(false);

  const { data: breedersData } = useQuery<{ breeders: { id: number; firstName: string | null; lastName: string | null }[] }>({
    queryKey: ["breeders"],
    queryFn: () => fetch(apiEndpoints.breeders.base).then((r) => r.json()),
  });
  const breeders = breedersData?.breeders ?? [];

  async function handleTransferBreeder() {
    if (!item || !transferBreederId) return;
    setTransferring(true);
    try {
      const res = await fetch(apiEndpoints.groups.transferBreeder(item.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newBreederId: parseInt(transferBreederId) }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("Breeder transferred");
      setTransferBreederId("");
      onSuccess?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Breeder Transfer</h3>
      {item?.eventInventory?.breeder && (
        <p className="text-sm text-muted-foreground">
          Current: {[item.eventInventory.breeder.firstName, item.eventInventory.breeder.lastName].filter(Boolean).join(" ")}
        </p>
      )}
      <div className="flex gap-2">
        <Select value={transferBreederId} onValueChange={setTransferBreederId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select new breeder…" />
          </SelectTrigger>
          <SelectContent>
            {breeders.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {[b.firstName, b.lastName].filter(Boolean).join(" ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={handleTransferBreeder} disabled={!transferBreederId || transferring}>
          {transferring ? "Transferring…" : "Transfer"}
        </Button>
      </div>
    </div>
  );
}

export function TransferBreederDialog({
  item,
  open,
  onOpenChange,
  onDone,
}: {
  item: EventInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change Breeder</DialogTitle>
        </DialogHeader>
        <TransferBreederForm
          item={item}
          onSuccess={() => {
            onOpenChange(false);
            onDone?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
