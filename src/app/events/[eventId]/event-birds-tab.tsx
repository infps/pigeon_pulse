"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useListEventInventoryItems } from "@/lib/api/event-inventory-items";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EventInventoryItem, EventInventory } from "@/lib/types";

interface EventBirdsTabProps {
  eventId: string;
}

interface BreederDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: EventInventory | null;
  allBirds: EventInventoryItem[];
}

function BreederDialog({ open, onOpenChange, inventory, allBirds }: BreederDialogProps) {
  if (!inventory) return null;

  const breeder = inventory.breeder;
  const breederBirds = allBirds.filter(
    item => item.eventInventory?.breederId === breeder.id
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={breeder.image || undefined} alt={breeder.name} />
              <AvatarFallback className="text-lg">
                {getInitials(breeder.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <div className="text-xl font-bold">{breeder.name}</div>
              <div className="text-sm text-muted-foreground font-normal">
                Loft: {inventory.loft}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-3">Birds ({breederBirds.length})</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Band</TableHead>
                <TableHead>Bird Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Sex</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breederBirds.map((item) => (
                <TableRow key={item.eventInventoryItemId}>
                  <TableCell className="font-mono">{item.bird?.band || "-"}</TableCell>
                  <TableCell>{item.bird?.birdName || "-"}</TableCell>
                  <TableCell>{item.bird?.color || "-"}</TableCell>
                  <TableCell className="capitalize">{item.bird?.sex?.toLowerCase() || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EventBirdsTab({ eventId }: EventBirdsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<EventInventory | null>(null);

  const { data, isPending } = useListEventInventoryItems(eventId);
  const birds = (data?.eventInventoryItems || []) as EventInventoryItem[];

  const handleLoftClick = (inventory: EventInventory) => {
    setSelectedInventory(inventory);
    setDialogOpen(true);
  };

  const columns: ColumnDef<EventInventoryItem>[] = [
  {
    id: "band",
    accessorKey: "bird.band",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Band" />
    ),
    cell: ({ row }) => {
      const band = row.original.bird?.band;
      return <span className="font-mono">{band || "-"}</span>;
    },
  },
  {
    id: "birdName",
    accessorKey: "bird.birdName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bird Name" />
    ),
    cell: ({ row }) => {
      const birdName = row.original.bird?.birdName;
      return <span>{birdName || "-"}</span>;
    },
  },
  {
    id: "breeder",
    accessorKey: "eventInventory.breeder.name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder" />
    ),
    cell: ({ row }) => {
      const breederName = row.original.eventInventory?.breeder?.name;
      return <span>{breederName || "-"}</span>;
    },
  },
  {
    id: "loft",
    accessorKey: "eventInventory.loft",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loft" />
    ),
    cell: ({ row }) => {
      const loft = row.original.eventInventory?.loft;
      const inventory = row.original.eventInventory;
      return (
        <button
          onClick={() => handleLoftClick(inventory)}
          className="text-blue-600 hover:underline font-medium cursor-pointer"
        >
          {loft || "-"}
        </button>
      );
    },
  },
];

  if (isPending) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Registered Birds ({birds.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={birds}
            filterableColumns={[
              { id: "band", title: "Band" },
              { id: "birdName", title: "Bird Name" },
              { id: "breeder", title: "Breeder" },
            ]}
          />
        </CardContent>
      </Card>

      <BreederDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        inventory={selectedInventory}
        allBirds={birds}
      />
    </>
  );
}
