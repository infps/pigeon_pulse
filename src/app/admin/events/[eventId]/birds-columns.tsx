"use client";

import { BAND_LETTERS_LIST_LEN, shortBand } from "@/lib/bird-constants";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { EventInventoryItem } from "@/lib/types";

export interface BirdsOptionalColumns {
  name: boolean;
  notes: boolean;
  classes: boolean;
  lostHistory: boolean;
}

/** Lost history = any LostHistory row, or the bird is currently flagged lost. */
export const birdHasLostHistory = (item: EventInventoryItem) =>
  (item.bird?._count?.lostHistory ?? 0) > 0 || !!item.bird?.isLost;

export const createBirdsColumns = (
  onEdit: (item: EventInventoryItem) => void,
  onOpenBird: (id: number) => void,
  eventId?: string | number,
  onSubstitute?: (item: EventInventoryItem) => void,
  show: BirdsOptionalColumns = { name: true, notes: false, classes: false, lostHistory: false }
): ColumnDef<EventInventoryItem>[] => {
  const columns: ColumnDef<EventInventoryItem>[] = [
  {
    id: "breeder",
    accessorFn: (row) => {
      const b = row.eventInventory?.breeder;
      if (!b) return "";
      return [b.firstName, b.lastName].filter(Boolean).join(" ");
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder" />
    ),
  },
  {
    id: "birdName",
    accessorFn: (row) => row.bird?.birdName ?? "N/A",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bird Name" />
    ),
    cell: ({ row }) => {
      const bird = row.original.bird;
      const name = bird?.birdName ?? "N/A";
      return <span>{name}</span>;
    },
  },
  {
    id: "birdNo",
    accessorFn: (row) => row.birdNo,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bird No" />
    ),
    cell: ({ getValue }) => getValue() ?? "N/A",
  },
  {
    id: "band1",
    accessorFn: (row) => row.bird?.band1,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assc" />
    ),
    cell: ({ getValue }) => getValue() ?? "N/A",
  },
  {
    id: "band2",
    accessorFn: (row) => row.bird?.band2,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Year" />
    ),
    cell: ({ getValue }) => getValue() ?? "N/A",
  },
  {
    id: "band3",
    accessorFn: (row) => row.bird?.band3,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Letter" />
    ),
    cell: ({ getValue }) => (getValue() as string | null | undefined)?.slice(0, BAND_LETTERS_LIST_LEN) ?? "N/A",
  },
  {
    id: "band4",
    accessorFn: (row) => row.bird?.band4,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Number" />
    ),
    cell: ({ getValue }) => getValue() ?? "N/A",
  },
  {
    id: "band",
    accessorFn: (row) => row.bird?.band,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Full Band" />
    ),
    cell: ({ getValue }) => shortBand(getValue() as string | null | undefined) || "N/A",
  },
  {
    id: "color",
    accessorFn: (row) => row.bird?.color,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Color" />
    ),
    cell: ({ getValue }) => getValue() ?? "N/A",
  },
  {
    id: "sex",
    accessorFn: (row) => row.bird?.sex,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sex" />
    ),
    cell: ({ getValue }) => {
      const val = getValue() as number | null;
      if (val === 0) return "Cock";
      if (val === 1) return "Hen";
      return "Unknown";
    },
  },
  {
    id: "isActive",
    accessorFn: (row) => row.bird?.isActive,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
    cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
  },
  {
    id: "isLost",
    accessorFn: (row) => row.bird?.isLost,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lost" />
    ),
    cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
  },
  {
    id: "lostDate",
    accessorFn: (row) => row.bird?.lostDate,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lost Date" />
    ),
    cell: ({ getValue }) => {
      const val = getValue() as string | null;
      if (!val) return "N/A";
      return new Date(val).toLocaleDateString();
    },
  },
  {
    id: "rfid",
    accessorFn: (row) => row.bird?.rfid,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="RFID" />
    ),
    cell: ({ getValue }) => getValue() ?? "N/A",
  },
  {
    id: "arrivalDate",
    accessorFn: (row) => row.arrivalDate,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Arrival Date" />
    ),
    cell: ({ getValue }) => {
      const val = getValue() as string | null;
      if (!val) return "N/A";
      return new Date(val).toLocaleString();
    },
  },
  {
    id: "departureDate",
    accessorFn: (row) => row.departureDate,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Departure Date" />
    ),
    cell: ({ getValue }) => {
      const val = getValue() as string | null;
      if (!val) return "N/A";
      return new Date(val).toLocaleString();
    },
  },
  {
    id: "isBackup",
    accessorFn: (row) => row.isBackup,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Backup" />
    ),
    cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
  },
  {
    id: "entryFeePaid",
    accessorFn: (row) => row.entryFeePaid,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry Fee Paid" />
    ),
    cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
  },
  {
    id: "notes",
    accessorFn: (row) => row.bird?.note ?? "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Notes" />,
    cell: ({ getValue }) => (getValue() as string) || "-",
  },
  {
    id: "classes",
    accessorFn: (row) => (row.raceClassEntries ?? []).map((e) => e.raceClass.code).join(", "),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Classes" />,
    cell: ({ getValue }) => (getValue() as string) || "-",
  },
  {
    id: "lostHistory",
    accessorFn: (row) => birdHasLostHistory(row),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Lost History" />,
    cell: ({ row }) => {
      const n = row.original.bird?._count?.lostHistory ?? 0;
      return birdHasLostHistory(row.original) ? `Yes${n ? ` (${n})` : ""}` : "No";
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">

            <DropdownMenuItem onClick={() => onEdit(item)}>
              Edit bird
            </DropdownMenuItem>
            {onSubstitute ? (
              <DropdownMenuItem onClick={() => onSubstitute(item)}>
                {item.replacedItemId ? "Restore to lineup" : "Substitute backup"}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
  ];
  const hidden: Record<string, boolean> = {
    birdName: !show.name,
    notes: !show.notes,
    classes: !show.classes,
    lostHistory: !show.lostHistory,
  };
  return columns.filter((c) => !(c.id && hidden[c.id]));
};
