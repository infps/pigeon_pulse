"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useApiQuery } from "@/hooks/useApi";
import { apiEndpoints } from "@/lib/endpoints";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EventInventory } from "@/lib/types";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { User, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { getCountryFlag, getStateFlag, getCountryName, getStateName } from "@/lib/flag-constants";
import Image from "next/image";

interface PublicDefaulter {
  eventInventoryId: number;
  breederName: string;
  loft: string | null;
  birds: Array<{
    id: number;
    band: string | null;
    band1: string | null;
    band2: string | null;
    band3: string | null;
    band4: string | null;
    birdName: string | null;
    color: string | null;
    sex: unknown;
  }>;
}

function DefaultersCard({ eventId }: { eventId: string }) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data, isPending } = useApiQuery({
    queryKey: ["event-defaulters-public", eventId],
    endpoint: apiEndpoints.breeder.eventDefaulters(eventId),
    enabled: !!eventId,
  });

  const defaulters: PublicDefaulter[] = data?.defaulters ?? [];

  if (isPending) return <Skeleton className="h-24 w-full" />;
  if (defaulters.length === 0) return null;

  const toggle = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          Defaulters ({defaulters.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Breeder</TableHead>
              <TableHead>Loft</TableHead>
              <TableHead>Birds</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {defaulters.map((d) => {
              const expanded = expandedIds.has(d.eventInventoryId);
              return (
                <>
                  <TableRow
                    key={d.eventInventoryId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => d.birds.length > 0 && toggle(d.eventInventoryId)}
                  >
                    <TableCell className="w-8">
                      {d.birds.length > 0 && (
                        expanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{d.breederName}</TableCell>
                    <TableCell>{d.loft ?? "-"}</TableCell>
                    <TableCell>{d.birds.length}</TableCell>
                  </TableRow>
                  {expanded && d.birds.length > 0 && (
                    <TableRow key={`${d.eventInventoryId}-birds`}>
                      <TableCell colSpan={4} className="bg-muted/30 px-8 py-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Band</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Color</TableHead>
                              <TableHead>Sex</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {d.birds.map((b) => (
                              <TableRow key={b.id}>
                                <TableCell className="font-mono text-sm">{b.band ?? "-"}</TableCell>
                                <TableCell>{b.birdName ?? "-"}</TableCell>
                                <TableCell>{b.color ?? "-"}</TableCell>
                                <TableCell className="capitalize">{b.sex != null ? String(b.sex) : "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface EventBreedersTabProps {
  eventId: string;
}

interface BreederDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: EventInventory | null;
}

function BreederDialog({ open, onOpenChange, inventory }: BreederDialogProps) {
  if (!inventory) return null;

  const breeder = inventory.breeder;
  const birds = inventory.items || [];

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
              <AvatarImage src={breeder?.user?.image ?? breeder?.image ?? undefined} alt={breeder?.firstName ?? ""} />
              <AvatarFallback className="text-lg">
                {getInitials(breeder?.firstName ?? "")}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <div className="text-xl font-bold">{breeder?.firstName}</div>
              <div className="text-sm text-muted-foreground font-normal">
                Loft: {inventory.loft}
              </div>
              {(breeder?.country || breeder?.state) && (
                <div className="flex items-center gap-3 mt-2">
                  {breeder?.country && (
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
                  {breeder?.state1 && (
                    <div className="flex items-center gap-1.5">
                      {getStateFlag(breeder.state1) && (
                        <Image
                          src={getStateFlag(breeder.state1)!}
                          alt={getStateName(breeder.state1)}
                          width={20}
                          height={15}
                          className="rounded"
                        />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {getStateName(breeder.state1)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-3">Birds ({birds.length})</h3>
          <Table>
            <TableHeader className="bg-primary">
              <TableRow>
                <TableHead className="text-primary-foreground font-medium">Band</TableHead>
                <TableHead className="text-primary-foreground font-medium">Bird Name</TableHead>
                <TableHead className="text-primary-foreground font-medium">Color</TableHead>
                <TableHead className="text-primary-foreground font-medium">Sex</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {birds.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.bird?.band || "-"}</TableCell>
                  <TableCell>{item.bird?.birdName || "-"}</TableCell>
                  <TableCell>{item.bird?.color || "-"}</TableCell>
                  <TableCell className="capitalize">{item.bird?.sex != null ? String(item.bird.sex) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EventBreedersTab({ eventId }: EventBreedersTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<EventInventory | null>(null);
  const { data: session } = authClient.useSession();

  const { data, isPending } = useApiQuery({
    queryKey: ["event-inventory-public", "list", String(eventId)],
    endpoint: apiEndpoints.breeder.eventInventory(eventId),
    enabled: !!eventId,
  });

  const inventories: EventInventory[] = (data?.eventInventory || []) as EventInventory[];
  const loggedInBreederId = session?.user?.id;

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

  // Put logged-in breeder first
  const myInventory = inventories.find(inv => String(inv.breeder?.userId) === loggedInBreederId);
  const others = inventories.filter(inv => String(inv.breeder?.userId) !== loggedInBreederId);
  const breeders = myInventory ? [myInventory, ...others] : inventories;

  const columns: ColumnDef<EventInventory>[] = [
    {
      id: "breeder",
      accessorFn: (row) => row.breeder?.firstName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Breeder" />
      ),
      cell: ({ row }) => {
        const inv = row.original;
        const name = inv.breeder?.firstName ?? "";
        const image = inv.breeder?.user?.image ?? inv.breeder?.image;
        const isMe = String(inv.breeder?.userId) === loggedInBreederId;

        return (
          <button
            onClick={() => handleBreederClick(inv)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={image || undefined} alt={name} />
              <AvatarFallback className="text-sm">{getInitials(name)}</AvatarFallback>
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
      id: "country",
      accessorFn: (row) => row.breeder?.country,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Country" />
      ),
      cell: ({ row }) => {
        const country = row.original.breeder?.country;
        if (!country) return <span>-</span>;
        const flag = getCountryFlag(country);
        return (
          <div className="flex items-center gap-2">
            {flag && (
              <Image src={flag} alt={getCountryName(country)} width={20} height={15} className="rounded" />
            )}
            <span>{getCountryName(country)}</span>
          </div>
        );
      },
    },
    {
      id: "state",
      accessorFn: (row) => row.breeder?.state1,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="State" />
      ),
      cell: ({ row }) => {
        const state = row.original.breeder?.state1;
        if (!state) return <span>-</span>;
        const flag = getStateFlag(state ?? "");
        return (
          <div className="flex items-center gap-2">
            {flag && (
              <Image src={flag} alt={getStateName(state ?? "")} width={20} height={15} className="rounded" />
            )}
            <span>{getStateName(state ?? "")}</span>
          </div>
        );
      },
    },
    {
      id: "birdCount",
      accessorFn: (row) => row.items?.length ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Birds Registered" />
      ),
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.items?.length ?? 0}</span>
      ),
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
          {myInventory && (
            <Button
              onClick={() => handleBreederClick(myInventory)}
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

      <DefaultersCard eventId={eventId} />

      <BreederDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        inventory={selectedInventory}
      />
    </>
  );
}
