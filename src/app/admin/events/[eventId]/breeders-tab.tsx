"use client";

import type { Event, EventInventory, EventInventoryItem } from "@/lib/types";
import { useState } from "react";
import { useListEventInventory } from "@/lib/api/event-inventory";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { createBreedersColumns } from "./breeders-columns";
import { BreederDetailsDialog } from "@/components/breeder-details-dialog";

interface BreedersTabProps {
  event: Event;
  eventId: string;
}

export function BreedersTab({ event, eventId }: BreedersTabProps) {
  const [selectedEventInventoryId, setSelectedEventInventoryId] = useState<string | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const { data, isPending, error } = useListEventInventory(eventId);

  const handleBreederClick = (eventInventoryId: string) => {
    setSelectedEventInventoryId(eventInventoryId);
    setIsDetailsDialogOpen(true);
  };

  const columns = createBreedersColumns(handleBreederClick);

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

  const eventInventory: EventInventory[] = data?.eventInventory || [];

  return (
    <div className="space-y-4">
      <DataTable 
        columns={columns} 
        data={eventInventory}
        filterableColumns={[
          { id: "loft", title: "Loft" },
          { id: "breederName", title: "Breeder Name" },
        ]}
      />
      
      <BreederDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        eventInventoryId={selectedEventInventoryId}
        event={event}
      />
    </div>
  );
}
