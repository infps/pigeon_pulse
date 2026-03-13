"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { Race } from "@/lib/types";
import Link from "next/link";

export const createRacesColumns = (
  onEdit: (race: Race) => void,
  onDelete: (raceId: number) => void,
  eventId: string
): ColumnDef<Race>[] => [
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Race Name" />
    ),
    cell: ({ row }) => {
      const race = row.original;
      return (
        <Link
          href={`/admin/events/${eventId}/races/${race.id}`}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          {race.description}
        </Link>
      );
    },
  },
  {
    accessorKey: "location",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Location" />
    ),
  },
  {
    accessorKey: "raceType.name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Race Type" />
    ),
    cell: ({ row }) => {
      const raceType = row.original.raceType;
      return <span>{raceType?.name || "-"}</span>;
    },
  },
  {
    accessorKey: "distance",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Distance" />
    ),
    cell: ({ row }) => {
      const distance = row.original.distance;
      return <span>{distance} miles</span>;
    },
  },
  {
    accessorKey: "startTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start Time" />
    ),
    cell: ({ row }) => {
      const startTime = row.original.startTime;
      if (!startTime) return <span>-</span>;
      const date = new Date(startTime);
      return <span>{date.toLocaleDateString()}</span>;
    },
  },
  {
    accessorKey: "isClosed",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const isClosed = row.original.isClosed;
      return (
        <Badge variant={isClosed === 1 ? "secondary" : "default"}>
          {isClosed === 1 ? "Closed" : "Open"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "arrivalTemperature",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Arrival Temp" />
    ),
    cell: ({ row }) => {
      const temp = row.original.arrivalTemperature;
      return <span>{temp ? `${temp}°` : "-"}</span>;
    },
  },
  {
    accessorKey: "arrivalWeather",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Arrival Weather" />
    ),
    cell: ({ row }) => {
      const weather = row.original.arrivalWeather;
      return <span>{weather || "-"}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const race = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(race)}>
              Edit race
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(race.id)}
              className="text-red-600"
            >
              Delete race
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
