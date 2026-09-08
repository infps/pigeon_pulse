"use client";

import { ColumnDef, SortingFn } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import type { RaceItem } from "@/lib/types";

const nullsLast: SortingFn<RaceItem> = (a, b, colId) => {
  const av = a.getValue(colId) ?? null;
  const bv = b.getValue(colId) ?? null;
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
};

export const raceItemsColumns: ColumnDef<RaceItem>[] = [
  {
    accessorKey: "birdPosition",
    sortingFn: nullsLast,
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
    sortingFn: nullsLast,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
        REGISTERED: { label: "Registered", variant: "outline" },
        CHECKED_IN: { label: "Checked In", variant: "secondary" },
        LOFT_BASKETED: { label: "Loft", variant: "secondary" },
        RELEASED: { label: "Released", variant: "default" },
        ARRIVED: { label: "Arrived", variant: "default" },
        FOREIGN_BIRD: { label: "Foreign", variant: "destructive" },
      };
      const config = (status && statusConfig[status]) || { label: status ?? "Unknown", variant: "outline" as const };
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
  },
  {
    id: "band",
    accessorKey: "bird.band",
    sortingFn: nullsLast,
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
    sortingFn: nullsLast,
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
    accessorKey: "bird.breeder.firstName",
    sortingFn: nullsLast,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder" />
    ),
    cell: ({ row }) => {
      const breederName = row.original.bird?.breeder?.firstName;
      return <span>{breederName || "-"}</span>;
    },
  },
  {
    id: "loft",
    accessorKey: "eventInventoryItem.eventInventory.loft",
    sortingFn: nullsLast,
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
    sortingFn: nullsLast,
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
    sortingFn: nullsLast,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Speed" />
    ),
    cell: ({ row }) => {
      const speed = row.original.speed;
      return <span>{speed ? `${speed.toFixed(2)} mph` : "-"}</span>;
    },
  },
  {
    accessorKey: "loftBasketLabel",
    sortingFn: nullsLast,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loft Basket" />
    ),
    cell: ({ row }) => {
      const label = row.original.loftBasketLabel;
      return label ? (
        <Badge variant="outline">{label}</Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: "raceBasketLabel",
    sortingFn: nullsLast,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Race Basket" />
    ),
    cell: ({ row }) => {
      const label = row.original.raceBasketLabel;
      return label ? (
        <Badge variant="outline">{label}</Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
];
