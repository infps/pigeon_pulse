"use client";

/**
 * The Baskets pane — HayLoft's `basketsP` panel on the right of `TeditRaceF`.
 *
 * A caption, a toolbar, and a page control with two tabs ("Loft baskets" and
 * "Race baskets"), each holding the same `TraceBasketFr` tree list: No,
 * Capacity, Occupied, with Capacity and Occupancy totals in the footer. Both
 * tabs are the same component in the original too — only the query behind them
 * differs (`IS_RACE_BASKET`), which is `phase` here.
 */

import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { EventBasketItem } from "@/lib/types";

export type BasketPhase = "LOFT" | "RACE";

export const basketCount = (b: EventBasketItem) =>
  b._count?.assignments ?? b.assignments?.length ?? 0;

export function BasketsPane({
  phase,
  onPhaseChange,
  baskets,
  isPending,
  selectedBasketId,
  onSelectBasket,
  toolbar,
}: {
  phase: BasketPhase;
  onPhaseChange: (p: BasketPhase) => void;
  baskets: EventBasketItem[];
  isPending: boolean;
  selectedBasketId: number | null;
  onSelectBasket: (id: number | null) => void;
  toolbar?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const sorted = useMemo(
    () => [...baskets].sort((a, b) => a.basketNo - b.basketNo),
    [baskets]
  );

  const totalCapacity = sorted.reduce((s, b) => s + b.capacity, 0);
  const totalOccupancy = sorted.reduce((s, b) => s + basketCount(b), 0);

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col min-h-0 h-full border rounded-lg overflow-hidden bg-card">
      {/* basketCaptionP */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Baskets</span>
          <Badge variant="secondary" className="tabular-nums">{sorted.length}</Badge>
        </div>
      </div>

      {/* BasketToolBar */}
      {toolbar && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b shrink-0">{toolbar}</div>
      )}

      {/* basketPC — Loft baskets / Race baskets */}
      <Tabs
        value={phase}
        onValueChange={(v) => {
          onPhaseChange(v as BasketPhase);
          onSelectBasket(null);
        }}
        className="shrink-0 px-3 pt-2"
      >
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="LOFT" className="text-xs">Loft baskets</TabsTrigger>
          <TabsTrigger value="RACE" className="text-xs">Race baskets</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* basketsG */}
      <div className="flex-1 min-h-0 overflow-auto mt-2">
        {isPending ? (
          <div className="p-3 space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-muted-foreground z-10">
              <tr>
                <th className="w-6 px-1 py-1.5" />
                <th className="px-2 py-1.5 text-right font-bold w-14">No</th>
                <th className="px-2 py-1.5 text-right font-bold">Capacity</th>
                <th className="px-2 py-1.5 text-right font-bold">Occupied</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No {phase === "LOFT" ? "loft" : "race"} baskets yet
                  </td>
                </tr>
              ) : (
                sorted.map((b, i) => {
                  const count = basketCount(b);
                  const full = count >= b.capacity;
                  const isOpen = expanded.has(b.id);
                  const isSelected = selectedBasketId === b.id;
                  return (
                    <Fragment key={b.id}>
                      <tr

                        onClick={() => onSelectBasket(isSelected ? null : b.id)}
                        className={`cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 font-medium"
                            : i % 2 === 1
                            ? "bg-muted/30 hover:bg-muted/60"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="p-0.5 text-muted-foreground hover:text-foreground"
                            onClick={() => toggleExpand(b.id)}
                            aria-label={isOpen ? "Collapse basket" : "Expand basket"}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums font-semibold">
                          {b.basketNo}
                          {b.label && (
                            <span className="ml-1 font-normal text-muted-foreground">{b.label}</span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">{b.capacity}</td>
                        <td
                          className={`px-2 py-1 text-right tabular-nums ${
                            full ? "text-destructive font-semibold" : ""
                          }`}
                        >
                          {count}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-background">
                          <td colSpan={4} className="px-0 py-0">
                            <BasketBirds basket={b} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* totalP — totalCapacityFr / totalOccupancyFr */}
      <div className="flex items-center justify-end gap-5 px-3 py-2 border-t bg-muted/40 text-xs shrink-0">
        <span className="text-muted-foreground">
          Capacity <strong className="text-foreground tabular-nums ml-0.5">{totalCapacity}</strong>
        </span>
        <span className="text-muted-foreground">
          Occupancy{" "}
          <strong
            className={`tabular-nums ml-0.5 ${
              totalOccupancy > totalCapacity ? "text-destructive" : "text-foreground"
            }`}
          >
            {totalOccupancy}
          </strong>
        </span>
      </div>
    </div>
  );
}

function BasketBirds({ basket }: { basket: EventBasketItem }) {
  const assignments = [...(basket.assignments ?? [])].sort(
    (a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime()
  );

  if (assignments.length === 0) {
    return <p className="px-8 py-2 text-muted-foreground">Empty</p>;
  }

  return (
    <table className="w-full text-[11px]">
      <tbody className="divide-y">
        {assignments.map((a) => {
          const bird = a.inventoryItem?.bird;
          const breeder = a.inventoryItem?.eventInventory?.breeder;
          return (
            <tr key={a.id} className={bird?.attention ? "bg-red-50" : undefined}>
              <td className="pl-8 pr-2 py-1 font-mono">{bird?.band ?? "—"}</td>
              <td className="px-2 py-1 text-muted-foreground truncate">
                {breeder?.lastName ?? "—"}
              </td>
              <td className="px-2 py-1 text-muted-foreground">{bird?.color ?? "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
