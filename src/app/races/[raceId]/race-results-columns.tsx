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
      if (!position) return <span>-</span>;
      if (position === 1) return <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">1st</Badge>;
      if (position === 2) return <Badge className="bg-gray-400 text-white hover:bg-gray-400">2nd</Badge>;
      if (position === 3) return <Badge className="bg-amber-700 text-white hover:bg-amber-700">3rd</Badge>;
      return <Badge variant="outline">{position}</Badge>;
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
    accessorKey: "bird.breeder.firstName",
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
