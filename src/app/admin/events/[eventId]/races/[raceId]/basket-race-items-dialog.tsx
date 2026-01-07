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
import { useBasketRaceItems } from "@/lib/api/race-item-basket";
import { useListBaskets } from "@/lib/api/baskets";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { RaceItem, Basket } from "@/lib/types";

interface BasketRaceItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: RaceItem[];
  raceId: string;
  onSuccess?: () => void;
}

export function BasketRaceItemsDialog({
  open,
  onOpenChange,
  selectedItems,
  raceId,
  onSuccess,
}: BasketRaceItemsDialogProps) {
  const [basketType, setBasketType] = useState<"loft" | "race">("loft");
  const [selectedBasketId, setSelectedBasketId] = useState<string>("");

  const { data: basketsData } = useListBaskets({
    params: { raceId },
  });

  const basketMutation = useBasketRaceItems();

  const baskets = (basketsData?.baskets || []) as Basket[];
  const filteredBaskets = baskets.filter(
    (basket) => basket.isRaceBasket === (basketType === "race")
  );

  console.log({ baskets, filteredBaskets });

  const handleBasket = async () => {
    if (!selectedBasketId) {
      toast.error("Please select a basket");
      return;
    }

    try {
      await basketMutation.mutateAsync({
        raceItemIds: selectedItems.map((item) => item.raceItemId),
        basketId: selectedBasketId,
        basketType,
      });

      toast.success(
        `${selectedItems.length} bird(s) basketed successfully to ${basketType} basket`
      );
      onSuccess?.();
      onOpenChange(false);
      // Reset selections
      setSelectedBasketId("");
      setBasketType("loft");
    } catch (error: any) {
      toast.error(error?.message || "Failed to basket race items");
    }
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
                  key={item.raceItemId}
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

          {/* Basket Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="basket-type">Basket Type</Label>
            <Select
              value={basketType}
              onValueChange={(value: "loft" | "race") => {
                setBasketType(value);
                setSelectedBasketId(""); // Reset basket selection
              }}
            >
              <SelectTrigger id="basket-type">
                <SelectValue placeholder="Select basket type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loft">Loft Basket</SelectItem>
                <SelectItem value="race">Race Basket</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Basket Selection */}
          <div className="space-y-2">
            <Label htmlFor="basket">
              Select {basketType === "loft" ? "Loft" : "Race"} Basket
            </Label>
            <Select value={selectedBasketId} onValueChange={setSelectedBasketId}>
              <SelectTrigger id="basket">
                <SelectValue placeholder="Select a basket" />
              </SelectTrigger>
              <SelectContent>
                {filteredBaskets.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No {basketType} baskets available
                  </div>
                ) : (
                  filteredBaskets.map((basket) => (
                    <SelectItem key={basket.basketId} value={basket.basketId}>
                      <div className="flex items-center gap-2">
                        <span>Basket #{basket.basketNo}</span>
                        <Badge variant="outline" className="text-xs">
                          {basket.isRaceBasket ? "Race" : "Loft"}
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
            disabled={!selectedBasketId || basketMutation.isPending}
          >
            {basketMutation.isPending ? "Basketing..." : "Basket Birds"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
