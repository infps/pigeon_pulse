"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { SEX_LABELS } from "@/lib/bird-constants";

export interface Bird {
  id: number;
  band: string;
  birdName: string;
  color: string;
  sex: number;
  totalRaces?: number;
  wins?: number;
  bestPosition?: number | null;
  currentStatus?: string | null;
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
    cell: ({ row }) => <span>{SEX_LABELS[row.original.sex as keyof typeof SEX_LABELS] ?? "-"}</span>,
  },
  {
    id: "stats",
    header: "Races / Wins / Best",
    cell: ({ row }) => {
      const { totalRaces, wins, bestPosition } = row.original;
      if (totalRaces === undefined) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <span className="text-sm tabular-nums">
          {totalRaces} / {wins ?? 0} / {bestPosition != null ? `#${bestPosition}` : "—"}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.currentStatus;
      if (!s) return null;
      const map: Record<string, string> = {
        REGISTERED: "bg-blue-100 text-blue-700",
        LOFT_BASKETED: "bg-yellow-100 text-yellow-700",
        RELEASED: "bg-orange-100 text-orange-700",
        ARRIVED: "bg-green-100 text-green-700",
        FOREIGN_BIRD: "bg-red-100 text-red-700",
      };
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[s] ?? "bg-muted text-muted-foreground"}`}>
          {s.replace(/_/g, " ")}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(row.original); }}>
        <Pencil className="h-4 w-4" />
      </Button>
    ),
  },
];
