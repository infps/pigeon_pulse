"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { RaceItem } from "@/lib/types";

export const raceItemsColumns: ColumnDef<RaceItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "birdPosition",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Position" />
    ),
    cell: ({ row }) => {
      const position = row.original.birdPosition;
      return position ? <Badge>{position}</Badge> : <span>-</span>;
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
        REGISTERED: { label: "Registered", variant: "outline" },
        LOFT_BASKETED: { label: "Loft", variant: "secondary" },
        RELEASED: { label: "Released", variant: "default" },
        RACE_BASKETED: { label: "Arrived", variant: "default" },
        FOREIGN_BIRD: { label: "Foreign", variant: "destructive" },
      };
      const config = statusConfig[status] || { label: status, variant: "outline" as const };
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
  },
  {
    id: "band",
    accessorKey: "bird.band",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Band" />
    ),
    cell: ({ row }) => {
      const band = row.original.bird?.band;
      return <span className="font-mono text-sm">{band || "-"}</span>;
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
    accessorKey: "bird.breeder.name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder" />
    ),
    cell: ({ row }) => {
      const breederName = row.original.bird?.breeder?.name;
      return <span>{breederName || "-"}</span>;
    },
  },
  {
    id: "loft",
    accessorKey: "eventInventoryItem.eventInventory.loft",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loft" />
    ),
    cell: ({ row }) => {
      const loft = row.original.eventInventoryItem?.eventInventory?.loft;
      return <span>{loft || "-"}</span>;
    },
  },
  {
    accessorKey: "arrivalTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Arrival Time" />
    ),
    cell: ({ row }) => {
      const arrivalTime = row.original.arrivalTime;
      return (
        <span>
          {arrivalTime ? new Date(arrivalTime).toLocaleString() : "-"}
        </span>
      );
    },
  },
  {
    accessorKey: "speed",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Speed" />
    ),
    cell: ({ row }) => {
      const speed = row.original.speed;
      return <span>{speed ? `${speed.toFixed(2)} mph` : "-"}</span>;
    },
  },
  {
    accessorKey: "loftBasket",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loft Basket" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return item.isLoftBasketed ? (
        <Badge variant="outline">
          #{item.loftBasket?.basketNo || "-"}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: "raceBasket",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Race Basket" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return item.isRaceBasketed ? (
        <Badge variant="outline">
          #{item.raceBasket?.basketNo || "-"}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
];
