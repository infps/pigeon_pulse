"use client";

import type { Event, EventInventoryItem } from "@/lib/types";
import { useState } from "react";
import { useListEventInventoryItems } from "@/lib/api/event-inventory-items";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { createBirdsColumns } from "./birds-columns";
import { EditBirdDialog } from "@/components/edit-bird-dialog";

interface BirdsTabProps {
  event: Event;
  eventId: string;
}

export function BirdsTab({ event, eventId }: BirdsTabProps) {
  const [editingItem, setEditingItem] = useState<EventInventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data, isPending, error } = useListEventInventoryItems(eventId);

  const handleEdit = (item: EventInventoryItem) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditingItem(null);
  };

  const columns = createBirdsColumns(handleEdit);


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
        <p>Error loading birds</p>
      </div>
    );
  }

  const eventInventoryItems: EventInventoryItem[] =
    data?.eventInventoryItems || [];

  return (
    <div className="space-y-4">
      <DataTable columns={columns} data={eventInventoryItems} />
      
      <EditBirdDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        eventInventoryItem={editingItem}
        event={event}
        eventId={eventId}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
