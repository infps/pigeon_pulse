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

interface EventBreedersTabProps {
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

interface BreederRow {
  breederId: string;
  breederName: string;
  loft: string;
  birdCount: number;
  breederImage: string | null;
  inventory: EventInventory;
}

export function EventBreedersTab({ eventId }: EventBreedersTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<EventInventory | null>(null);

  const { data, isPending } = useListEventInventoryItems(eventId);
  const birds = (data?.eventInventoryItems || []) as EventInventoryItem[];

  // Group birds by breeder
  const breederMap = new Map<string, BreederRow>();
  
  birds.forEach(item => {
    const breederId = item.eventInventory?.breederId;
    const breederName = item.eventInventory?.breeder?.name;
    const loft = item.eventInventory?.loft;
    const breederImage = item.eventInventory?.breeder?.image;
    
    if (breederId && breederName && loft) {
      if (!breederMap.has(breederId)) {
        breederMap.set(breederId, {
          breederId,
          breederName,
          loft,
          birdCount: 0,
          breederImage: breederImage || null,
          inventory: item.eventInventory,
        });
      }
      const breederData = breederMap.get(breederId)!;
      breederData.birdCount++;
    }
  });

  const breeders = Array.from(breederMap.values());

  const handleBreederClick = (inventory: EventInventory) => {
    setSelectedInventory(inventory);
    setDialogOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const columns: ColumnDef<BreederRow>[] = [
    {
      id: "breeder",
      accessorKey: "breederName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Breeder" />
      ),
      cell: ({ row }) => {
        const name = row.original.breederName;
        const image = row.original.breederImage;
        const inventory = row.original.inventory;
        
        return (
          <button
            onClick={() => handleBreederClick(inventory)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={image || undefined} alt={name} />
              <AvatarFallback className="text-sm">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-blue-600 hover:underline font-medium">{name}</span>
          </button>
        );
      },
    },
    {
      id: "loft",
      accessorKey: "loft",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Loft" />
      ),
    },
    {
      id: "birdCount",
      accessorKey: "birdCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Birds Registered" />
      ),
      cell: ({ row }) => {
        const count = row.original.birdCount;
        return <span className="font-semibold">{count}</span>;
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
          <CardTitle>Registered Breeders ({breeders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={breeders}
            filterableColumns={[
              { id: "breeder", title: "Breeder" },
              { id: "loft", title: "Loft" },
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
