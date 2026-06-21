"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBirdHistory,
  type BirdHistoryEntry,
  type BirdHistoryEntryType,
} from "@/lib/api/birds";
import {
  ClipboardList,
  Package,
  Rocket,
  Flag,
  AlertTriangle,
  HelpCircle,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<BirdHistoryEntryType, LucideIcon> = {
  REGISTERED: ClipboardList,
  BASKETED: Package,
  RELEASED: Rocket,
  ARRIVED: Flag,
  FOREIGN_BIRD: HelpCircle,
  LOST: AlertTriangle,
};

function primaryText(e: BirdHistoryEntry): string {
  switch (e.type) {
    case "REGISTERED":
      return `Registered for ${e.eventName ?? "event"}`;
    case "BASKETED":
      return `Basketed in ${e.basketLabel ?? "basket"}`;
    case "RELEASED":
      return `Released in ${e.raceName ?? "race"}`;
    case "ARRIVED":
      return e.position
        ? `Arrived #${e.position} in ${e.raceName ?? "race"}`
        : `Arrived in ${e.raceName ?? "race"}`;
    case "FOREIGN_BIRD":
      return `Did not finish ${e.raceName ?? "race"}`;
    case "LOST":
      return `Lost at ${e.raceName ?? "race"}`;
  }
}

function subText(e: BirdHistoryEntry): string | null {
  const parts: string[] = [];
  if (e.type !== "REGISTERED" && e.eventName) parts.push(e.eventName);
  if (e.type === "BASKETED" && e.phase) parts.push(`${e.phase} phase`);
  if (e.type === "ARRIVED" && e.prizeValue) parts.push(`Prize $${e.prizeValue}`);
  return parts.length ? parts.join(" • ") : null;
}

export function BirdHistoryPanel({ birdId }: { birdId: string | number }) {
  const { data, isPending, isError } = useBirdHistory(birdId);
  const entries = (data as { entries?: BirdHistoryEntry[] } | undefined)?.entries ?? [];

  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">History unavailable.</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ol className="relative max-h-90 space-y-4 overflow-y-auto border-l pl-4 pr-1">
            {entries.map((e, i) => {
              const Icon = ICON_MAP[e.type];
              const sub = subText(e);
              return (
                <li key={i} className="relative">
                  <span className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-border">
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.date).toLocaleString()}
                    </span>
                    <span className="text-sm font-medium">{primaryText(e)}</span>
                    {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
