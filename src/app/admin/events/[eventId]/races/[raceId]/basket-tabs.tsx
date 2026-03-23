"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEventBaskets } from "@/lib/api/event-baskets";
import type { EventBasketItem } from "@/lib/types";

interface BasketTabsProps {
  eventId: string;
}

export function BasketTabs({ eventId }: BasketTabsProps) {
  const { data, isPending } = useEventBaskets(eventId);

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

  const allBaskets: EventBasketItem[] = data?.baskets || [];
  const loftBaskets = allBaskets.filter((b) => b.phase === "LOFT");
  const raceBaskets = allBaskets.filter((b) => b.phase === "RACE");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Baskets</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="loft" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="loft">
              Loft
              <Badge variant="secondary" className="ml-2">
                {loftBaskets.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="race">
              Race
              <Badge variant="secondary" className="ml-2">
                {raceBaskets.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="loft" className="space-y-2">
            <BasketList baskets={loftBaskets} emptyMessage="No loft baskets" />
          </TabsContent>

          <TabsContent value="race" className="space-y-2">
            <BasketList baskets={raceBaskets} emptyMessage="No race baskets" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function BasketList({
  baskets,
  emptyMessage,
}: {
  baskets: EventBasketItem[];
  emptyMessage: string;
}) {
  if (baskets.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {baskets.map((basket) => (
        <BasketCard key={basket.id} basket={basket} />
      ))}
    </div>
  );
}

function BasketCard({ basket }: { basket: EventBasketItem }) {
  const [expanded, setExpanded] = useState(false);
  const count = basket._count?.assignments ?? basket.assignments?.length ?? 0;

  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center justify-between p-2.5 hover:bg-muted/50 transition-colors text-sm"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span className="font-medium">Basket #{basket.basketNo}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {count}/{basket.capacity}
        </Badge>
      </button>
      {expanded && basket.assignments && (
        <div className="border-t px-2.5 py-1.5 space-y-0.5">
          {basket.assignments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs py-0.5">
              <span className="font-mono text-muted-foreground truncate w-24">
                {a.inventoryItem?.bird?.band || "N/A"}
              </span>
              <span className="flex-1 truncate">
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
