"use client";

import type { Event, EventInventoryItem } from "@/lib/types";
import { useListEventInventory } from "@/lib/api/event-inventory";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { breedersColumns } from "./breeders-columns";

interface BreedersTabProps {
  event: Event;
  eventId: string;
}

export function BreedersTab({ event, eventId }: BreedersTabProps) {
  const { data, isPending, error } = useListEventInventory(eventId);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <p>Error loading event inventory</p>
      </div>
    );
  }

  const eventInventory: EventInventoryItem[] = data?.eventInventory || [];

  return (
    <div className="space-y-4">
      <DataTable columns={breedersColumns} data={eventInventory} />
    </div>
  );
}
