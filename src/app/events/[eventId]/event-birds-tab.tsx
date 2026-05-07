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
import { Bird as BirdIcon, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";

const EXPORT_FORMATS: { format: "xlsx" | "csv" | "pdf" | "html"; label: string }[] = [
  { format: "xlsx", label: "Excel (.xlsx)" },
  { format: "csv", label: "CSV (.csv)" },
  { format: "pdf", label: "PDF (.pdf)" },
  { format: "html", label: "Web Page (.html)" },
];

function EventExportMenu({ eventId }: { eventId: string }) {
  const open = (kind: "results" | "baskets", format: string) => {
    const qs = new URLSearchParams({ format, eventId });
    window.open(`/api/breeder/export/${kind}?${qs.toString()}`, "_blank");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Race Results</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {EXPORT_FORMATS.map((f) => (
              <DropdownMenuItem key={f.format} onClick={() => open("results", f.format)}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Baskets</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {EXPORT_FORMATS.map((f) => (
              <DropdownMenuItem key={f.format} onClick={() => open("baskets", f.format)}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface EventBirdsTabProps {
  eventId: string;
}

interface BreederDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: EventInventory | null;
  allBirds: EventInventoryItem[];
}

interface BirdDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EventInventoryItem | null;
}

function BirdDetailDialog({ open, onOpenChange, item }: BirdDetailDialogProps) {
  const bird = item?.bird;
  const bandDisplay = bird
    ? bird.band ||
      [bird.band1, bird.band2, bird.band3, bird.band4].filter(Boolean).join("-")
    : "";

  const latestArrived = (() => {
    const ris = (item?.raceItems ?? []) as Array<{
      status?: string;
      result?: { arrivalTime?: string | Date | null; birdPosition?: number | null } | null;
      race?: { name?: string | null } | null;
    }>;
    const arrived = ris.filter(
      (ri) => ri.status === "ARRIVED" && ri.result?.arrivalTime
    );
    if (arrived.length === 0) return null;
    return arrived.reduce((latest, ri) => {
      const t = new Date(ri.result!.arrivalTime!).getTime();
      const lt = new Date(latest.result!.arrivalTime!).getTime();
      return t > lt ? ri : latest;
    });
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bird Details</DialogTitle>
        </DialogHeader>
        {!bird ? (
          <div className="py-4 text-sm text-muted-foreground">No bird selected.</div>
        ) : (
          <div className="space-y-4">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center">
              {bird.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bird.image}
                  alt={bird.birdName ?? "Bird"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <BirdIcon className="h-16 w-16 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{bird.birdName || "Unnamed Bird"}</h2>
              <p className="font-mono text-sm text-muted-foreground">
                {bandDisplay || "No band"}
              </p>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Latest Race
              </p>
              {latestArrived ? (
                <p className="text-sm">
                  {latestArrived.result?.birdPosition
                    ? `Position #${latestArrived.result.birdPosition}`
                    : "Arrived"}
                  {latestArrived.race?.name ? ` — ${latestArrived.race.name}` : ""}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No race results yet</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BreederDialog({ open, onOpenChange, inventory, allBirds }: BreederDialogProps) {
  if (!inventory) return null;

  const breeder = inventory.breeder;
  const breederBirds = allBirds.filter(
    item => item.eventInventory?.breederId === breeder?.id
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
              <AvatarImage src={breeder?.image ?? undefined} alt={breeder?.firstName ?? ""} />
              <AvatarFallback className="text-lg">
                {getInitials(breeder?.firstName ?? "")}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <div className="text-xl font-bold">{breeder?.firstName}</div>
              <div className="text-sm text-muted-foreground font-normal">
                Loft: {inventory.loft}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-3">Birds ({breederBirds.length})</h3>
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
              {breederBirds.map((item) => (
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

export function EventBirdsTab({ eventId }: EventBirdsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<EventInventory | null>(null);
  const [birdDetailOpen, setBirdDetailOpen] = useState(false);
  const [selectedBird, setSelectedBird] = useState<EventInventoryItem | null>(null);
  const { data: session } = authClient.useSession();

  const { data, isPending } = useListEventInventoryItems(
    eventId,
    apiEndpoints.breeder.eventInventoryItems(eventId)
  );
  const allBirds = (data?.eventInventoryItems || []) as EventInventoryItem[];

  const loggedInUserId = session?.user?.id;
  const isOwner = (item: EventInventoryItem) =>
    !!loggedInUserId && item.eventInventory?.breeder?.userId === loggedInUserId;

  // Separate logged-in breeder's birds and others
  const myBirds = allBirds.filter(isOwner);
  const otherBirds = allBirds.filter((b) => !isOwner(b));
  const birds = [...myBirds, ...otherBirds];

  // Get logged-in breeder's inventory for "My Loft" button
  const myInventory = myBirds.length > 0 ? myBirds[0].eventInventory : null;

  const handleLoftClick = (inventory: EventInventory) => {
    setSelectedInventory(inventory);
    setDialogOpen(true);
  };

  const handleBirdClick = (item: EventInventoryItem) => {
    setSelectedBird(item);
    setBirdDetailOpen(true);
  };

  const columns: ColumnDef<EventInventoryItem>[] = [
  {
    id: "birdName",
    accessorKey: "bird.birdName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bird Name" />
    ),
    cell: ({ row }) => {
      const birdName = row.original.bird?.birdName || "-";
      const isMyBird = isOwner(row.original);
      return (
        <div className={isMyBird ? "bg-transparent -mx-6 px-6 -my-3 py-3" : ""}>
          <button
            onClick={() => handleBirdClick(row.original)}
            className={`text-blue-600 hover:underline cursor-pointer text-left ${
              isMyBird ? "font-bold" : ""
            }`}
          >
            {birdName}
          </button>
        </div>
      );
    },
  },
  {
    id: "breeder",
    accessorFn: (row) => row.eventInventory?.breeder?.firstName,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder" />
    ),
    cell: ({ row }) => {
      const breederName = row.original.eventInventory?.breeder?.name;
      const isMyBird = isOwner(row.original);
      return (
        <div className={isMyBird ? "bg-transparent -mx-6 px-6 -my-3 py-3" : ""}>
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
      const isMyBird = isOwner(row.original);
      return (
        <div className={isMyBird ? "bg-transparent -mx-6 px-6 -my-3 py-3" : ""}>
          <span className={isMyBird ? "font-bold" : "font-medium"}>
            {loft || "-"}
          </span>
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
          <div className="flex items-center gap-2">
            <EventExportMenu eventId={eventId} />
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
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={birds}
            filterableColumns={[
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

      <BirdDetailDialog
        open={birdDetailOpen}
        onOpenChange={setBirdDetailOpen}
        item={selectedBird}
      />
    </>
  );
}
