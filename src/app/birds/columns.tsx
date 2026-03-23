"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { SEX_LABELS } from "@/lib/bird-constants";

interface Bird {
  id: number;
  band: string;
  birdName: string;
  color: string;
  sex: number;
}

export const createBirdColumns = (
  onEdit: (bird: Bird) => void
): ColumnDef<Bird>[] => [
  {
    id: "index",
    header: "#",
    cell: ({ row }) => <span className="text-muted-foreground">{row.index + 1}</span>,
  },
  {
    accessorKey: "band",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Band" />,
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.band || "-"}</span>,
  },
  {
    accessorKey: "birdName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => <span>{row.original.birdName || "-"}</span>,
  },
  {
    accessorKey: "color",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Color" />,
    cell: ({ row }) => row.original.color ? <Badge variant="outline">{row.original.color}</Badge> : <span>-</span>,
  },
  {
    accessorKey: "sex",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Sex" />,
    cell: ({ row }) => <span>{SEX_LABELS[row.original.sex] ?? "-"}</span>,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button variant="ghost" size="icon" onClick={() => onEdit(row.original)}>
        <Pencil className="h-4 w-4" />
      </Button>
    ),
  },
];
