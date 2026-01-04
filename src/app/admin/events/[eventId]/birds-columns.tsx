"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { EventInventoryItemDetail } from "@/lib/types";

export const birdsColumns: ColumnDef<EventInventoryItemDetail>[] = [
  {
    accessorKey: "eventInventory.registrationDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registration Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.eventInventory.registrationDate);
      return <span>{date.toLocaleDateString()}</span>;
    },
  },
  {
    accessorKey: "eventInventory.loft",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loft" />
    ),
    cell: ({ row }) => {
      return <span>{row.original.eventInventory.loft}</span>;
    },
  },
  {
    accessorKey: "bird.band",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bird Band" />
    ),
  },
  {
    accessorKey: "bird.color",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Color" />
    ),
  },
  {
    accessorKey: "bird.birdName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "arrivalTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Arrival Time" />
    ),
    cell: ({ row }) => {
      const arrivalTime = row.original.arrivalTime;
      if (!arrivalTime) return <span className="text-gray-400">-</span>;
      const date = new Date(arrivalTime);
      return <span>{date.toLocaleString()}</span>;
    },
  },
];
