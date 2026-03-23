"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEventBaskets } from "@/lib/api/event-baskets";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { RaceItem, EventBasketItem } from "@/lib/types";

interface BasketRaceItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: RaceItem[];
  eventId: string;
  onSuccess?: () => void;
}

export function BasketRaceItemsDialog({
  open,
  onOpenChange,
  selectedItems,
  eventId,
  onSuccess,
}: BasketRaceItemsDialogProps) {
  const [basketPhase, setBasketPhase] = useState<"LOFT" | "RACE">("LOFT");
  const [selectedBasketId, setSelectedBasketId] = useState<string>("");

  const { data: basketsData } = useEventBaskets(eventId, basketPhase);

  const baskets: EventBasketItem[] = basketsData?.baskets || [];

  const handleBasket = async () => {
    if (!selectedBasketId) {
      toast.error("Please select a basket");
      return;
    }

    // TODO: implement basket assignment via API when needed
    toast.info("Manual basket assignment not yet implemented — use Check-in tab for loft baskets");
    onOpenChange(false);
    setSelectedBasketId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Basket Birds</DialogTitle>
          <DialogDescription>
            Assign {selectedItems.length} selected bird(s) to a basket
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected Items Preview */}
          <div className="space-y-2">
            <Label>Selected Birds ({selectedItems.length})</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="text-sm flex items-center justify-between gap-2"
                >
                  <span className="font-mono">{item.bird?.band}</span>
                  <span className="text-muted-foreground truncate">
                    {item.bird?.birdName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Basket Phase Selection */}
          <div className="space-y-2">
            <Label htmlFor="basket-phase">Basket Type</Label>
            <Select
              value={basketPhase}
              onValueChange={(value: "LOFT" | "RACE") => {
                setBasketPhase(value);
                setSelectedBasketId("");
              }}
            >
              <SelectTrigger id="basket-phase">
                <SelectValue placeholder="Select basket type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOFT">Loft Basket</SelectItem>
                <SelectItem value="RACE">Race Basket</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Basket Selection */}
          <div className="space-y-2">
            <Label htmlFor="basket">
              Select {basketPhase === "LOFT" ? "Loft" : "Race"} Basket
            </Label>
            <Select value={selectedBasketId} onValueChange={setSelectedBasketId}>
              <SelectTrigger id="basket">
                <SelectValue placeholder="Select a basket" />
              </SelectTrigger>
              <SelectContent>
                {baskets.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No {basketPhase.toLowerCase()} baskets available
                  </div>
                ) : (
                  baskets.map((basket) => (
                    <SelectItem key={basket.id} value={String(basket.id)}>
                      <div className="flex items-center gap-2">
                        <span>{basket.label || `Basket #${basket.basketNo}`}</span>
                        <Badge variant="outline" className="text-xs">
                          {basket._count?.assignments ?? 0}/{basket.capacity}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleBasket}
            disabled={!selectedBasketId}
          >
            Basket Birds
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
