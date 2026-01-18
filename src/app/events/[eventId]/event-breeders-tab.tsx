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
import { getCountryFlag, getStateFlag, getCountryName, getStateName } from "@/lib/flag-constants";
import Image from "next/image";

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
              {(breeder.country || breeder.state) && (
                <div className="flex items-center gap-3 mt-2">
                  {breeder.country && (
                    <div className="flex items-center gap-1.5">
                      {getCountryFlag(breeder.country) && (
                        <Image
                          src={getCountryFlag(breeder.country)!}
                          alt={getCountryName(breeder.country)}
                          width={20}
                          height={15}
                          className="rounded"
                        />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {getCountryName(breeder.country)}
                      </span>
                    </div>
                  )}
                  {breeder.state && (
                    <div className="flex items-center gap-1.5">
                      {getStateFlag(breeder.state) && (
                        <Image
                          src={getStateFlag(breeder.state)!}
                          alt={getStateName(breeder.state)}
                          width={20}
                          height={15}
                          className="rounded"
                        />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {getStateName(breeder.state)}
                      </span>
                    </div>
                  )}
                </div>
              )}
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
  country?: string | null;
  state?: string | null;
}

export function EventBreedersTab({ eventId }: EventBreedersTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<EventInventory | null>(null);
  const { data: session } = authClient.useSession();

  const { data, isPending } = useListEventInventoryItems(
    eventId,
    apiEndpoints.breeder.eventInventoryItems(eventId)
  );
  const birds = (data?.eventInventoryItems || []) as EventInventoryItem[];

  const loggedInBreederId = session?.user?.id;

  // Group birds by breeder
  const breederMap = new Map<string, BreederRow>();
  
  birds.forEach(item => {
    const breederId = item.eventInventory?.breederId;
    const breederName = item.eventInventory?.breeder?.name;
    const loft = item.eventInventory?.loft;
    const breederImage = item.eventInventory?.breeder?.image;
    const country = item.eventInventory?.breeder?.country;
    const state = item.eventInventory?.breeder?.state;
    
    if (breederId && breederName && loft) {
      if (!breederMap.has(breederId)) {
        breederMap.set(breederId, {
          breederId,
          breederName,
          loft,
          birdCount: 0,
          breederImage: breederImage || null,
          inventory: item.eventInventory,
          country,
          state,
        });
      }
      const breederData = breederMap.get(breederId)!;
      breederData.birdCount++;
    }
  });

  const allBreeders = Array.from(breederMap.values());
  
  // Separate logged-in breeder and others
  const myBreeder = allBreeders.find(b => b.breederId === loggedInBreederId);
  const otherBreeders = allBreeders.filter(b => b.breederId !== loggedInBreederId);
  const breeders = myBreeder ? [myBreeder, ...otherBreeders] : allBreeders;

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
        const isMe = row.original.breederId === loggedInBreederId;
        
        return (
          <div className={isMe ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
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
            <div className="flex items-center gap-2">
              <span className="text-blue-600 hover:underline font-medium">{name}</span>
              {isMe && (
                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>
          </button>
          </div>
        );
      },
    },
    {
      id: "loft",
      accessorKey: "loft",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Loft" />
      ),
      cell: ({ row }) => {
        const loft = row.original.loft;
        const isMe = row.original.breederId === loggedInBreederId;
        return (
          <div className={isMe ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
            {loft}
          </div>
        );
      },
    },
    {
      id: "country",
      accessorKey: "country",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Country" />
      ),
      cell: ({ row }) => {
        const country = row.original.country;
        const isMe = row.original.breederId === loggedInBreederId;
        if (!country) return <div className={isMe ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>-</div>;
        const flag = getCountryFlag(country);
        return (
          <div className={isMe ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
            <div className="flex items-center gap-2">
              {flag && (
                <Image
                  src={flag}
                  alt={getCountryName(country)}
                  width={20}
                  height={15}
                  className="rounded"
                />
              )}
              <span>{getCountryName(country)}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: "state",
      accessorKey: "state",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="State" />
      ),
      cell: ({ row }) => {
        const state = row.original.state;
        const isMe = row.original.breederId === loggedInBreederId;
        if (!state) return <div className={isMe ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>-</div>;
        const flag = getStateFlag(state);
        return (
          <div className={isMe ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
            <div className="flex items-center gap-2">
              {flag && (
                <Image
                  src={flag}
                  alt={getStateName(state)}
                  width={20}
                  height={15}
                  className="rounded"
                />
              )}
              <span>{getStateName(state)}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: "birdCount",
      accessorKey: "birdCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Birds Registered" />
      ),
      cell: ({ row }) => {
        const count = row.original.birdCount;
        const isMe = row.original.breederId === loggedInBreederId;
        return (
          <div className={isMe ? "bg-blue-50 -mx-6 px-6 -my-3 py-3" : ""}>
            <span className="font-semibold">{count}</span>
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
          <CardTitle>Registered Breeders ({breeders.length})</CardTitle>
          {myBreeder && (
            <Button
              onClick={() => handleBreederClick(myBreeder.inventory)}
              className="gap-2"
              variant="outline"
            >
              <User className="h-4 w-4" />
              My Loft
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <DataTable
              columns={columns}
              data={breeders}
              filterableColumns={[
                { id: "breeder", title: "Breeder" },
                { id: "loft", title: "Loft" },
              ]}
            />
          </div>
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
