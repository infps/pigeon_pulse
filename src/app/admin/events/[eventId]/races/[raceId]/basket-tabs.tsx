"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useListBaskets, useCreateBasket, useDeleteBasket } from "@/lib/api/baskets";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Basket } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface BasketTabsProps {
  raceId: string;
}

export function BasketTabs({ raceId }: BasketTabsProps) {
  const { data, isPending } = useListBaskets({ params: { raceId } });
  const createBasketMutation = useCreateBasket();
  const deleteBasketMutation = useDeleteBasket();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [basketType, setBasketType] = useState<"loft" | "race">("loft");
  const [basketNo, setBasketNo] = useState("");

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Baskets</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const baskets = (data?.baskets || []) as Basket[];
  const loftBaskets = baskets.filter((b) => !b.isRaceBasket);
  const raceBaskets = baskets.filter((b) => b.isRaceBasket);

  const handleCreateBasket = async () => {
    if (!basketNo || !basketNo.trim()) {
      toast.error("Please enter a basket number");
      return;
    }

    try {
      if (!createBasketMutation.mutateAsync) return;
      await createBasketMutation.mutateAsync({
        raceId,
        basketNo: parseInt(basketNo),
        isRaceBasket: basketType === "race",
      });
      toast.success("Basket created successfully");
      setIsDialogOpen(false);
      setBasketNo("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to create basket");
      console.error("Error creating basket:", error);
    }
  };

  const handleDeleteBasket = async (basketId: string, hasItems: boolean) => {
    if (hasItems) {
      toast.error("Cannot delete basket with items");
      return;
    }

    if (!confirm("Are you sure you want to delete this basket?")) return;

    try {
      if (!deleteBasketMutation.mutateAsync) return;
      await deleteBasketMutation.mutateAsync({ basketId });
      toast.success("Basket deleted successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete basket");
      console.error("Error deleting basket:", error);
    }
  };

  const renderBasketList = (basketList: Basket[]) => {
    if (basketList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No baskets found
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {basketList.map((basket) => {
          const itemCount =
            (basket as any)._count?.raceItems || 0 +
            (basket as any)._count?.loftItems || 0;
          const hasItems = itemCount > 0;

          return (
            <div
              key={basket.basketId}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-medium">Basket #{basket.basketNo}</div>
                  <div className="text-sm text-muted-foreground">
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteBasket(basket.basketId, hasItems)}
                disabled={deleteBasketMutation.isPending}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Baskets</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="loft" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="loft">
                Loft Basket
                <Badge variant="secondary" className="ml-2">
                  {loftBaskets.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="race">
                Race Basket
                <Badge variant="secondary" className="ml-2">
                  {raceBaskets.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="loft" className="space-y-4">
              <Button
                onClick={() => {
                  setBasketType("loft");
                  setIsDialogOpen(true);
                }}
                size="sm"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Loft Basket
              </Button>
              {renderBasketList(loftBaskets)}
            </TabsContent>

            <TabsContent value="race" className="space-y-4">
              <Button
                onClick={() => {
                  setBasketType("race");
                  setIsDialogOpen(true);
                }}
                size="sm"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Race Basket
              </Button>
              {renderBasketList(raceBaskets)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {basketType === "loft" ? "Loft" : "Race"} Basket
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="basketNo">Basket Number</Label>
              <Input
                id="basketNo"
                type="number"
                placeholder="Enter basket number"
                value={basketNo}
                onChange={(e) => setBasketNo(e.target.value)}
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setBasketNo("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBasket}
              disabled={createBasketMutation.isPending}
            >
              {createBasketMutation.isPending ? "Creating..." : "Create Basket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
