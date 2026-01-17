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
import { apiEndpoints } from "@/lib/endpoints";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

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
  const { data: session } = authClient.useSession();

  const { data, isPending } = useListEventInventoryItems(
    eventId,
    apiEndpoints.breeder.eventInventoryItems(eventId)
  );
  const allBirds = (data?.eventInventoryItems || []) as EventInventoryItem[];
  
  const loggedInBreederId = session?.user?.id;
  
  // Separate logged-in breeder's birds and others
  const myBirds = allBirds.filter(bird => bird.eventInventory?.breederId === loggedInBreederId);
  const otherBirds = allBirds.filter(bird => bird.eventInventory?.breederId !== loggedInBreederId);
  const birds = [...myBirds, ...otherBirds];
  
  // Get logged-in breeder's inventory for "My Loft" button
  const myInventory = myBirds.length > 0 ? myBirds[0].eventInventory : null;

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
      const isMyBird = row.original.eventInventory?.breederId === loggedInBreederId;
      return (
        <div className={isMyBird ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
          <span className={`font-mono ${isMyBird ? "font-bold" : ""}`}>
            {band || "-"}
          </span>
        </div>
      );
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
      const isMyBird = row.original.eventInventory?.breederId === loggedInBreederId;
      return (
        <div className={isMyBird ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
          <span className={isMyBird ? "font-bold" : ""}>
            {birdName || "-"}
          </span>
        </div>
      );
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
      const isMyBird = row.original.eventInventory?.breederId === loggedInBreederId;
      return (
        <div className={isMyBird ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
          <div className="flex items-center gap-2">
            <span className={isMyBird ? "font-bold" : ""}>
              {breederName || "-"}
            </span>
            {isMyBird && (
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>
        </div>
      );
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
      const isMyBird = row.original.eventInventory?.breederId === loggedInBreederId;
      return (
        <div className={isMyBird ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
          <button
            onClick={() => handleLoftClick(inventory)}
            className={`text-blue-600 hover:underline cursor-pointer ${
              isMyBird ? "font-bold" : "font-medium"
            }`}
          >
            {loft || "-"}
          </button>
        </div>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registered Birds ({birds.length})</CardTitle>
          {myInventory && (
            <Button
              onClick={() => handleLoftClick(myInventory)}
              className="gap-2"
              variant="outline"
            >
              <User className="h-4 w-4" />
              My Loft
            </Button>
          )}
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
        allBirds={allBirds}
      />
    </>
  );
}
