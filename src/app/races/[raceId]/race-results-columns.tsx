"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import type { RaceItem } from "@/lib/types";

export const raceResultsColumns: ColumnDef<RaceItem>[] = [
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
];
