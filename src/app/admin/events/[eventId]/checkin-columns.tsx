"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Check, X, Link, Unlink } from "lucide-react";
import type { CheckinStatusItem } from "@/lib/types";

export const createCheckinColumns = (
  onLink: (item: CheckinStatusItem) => void,
  onUnlink: (item: CheckinStatusItem) => void
): ColumnDef<CheckinStatusItem>[] => [
  {
    id: "breeder",
    accessorFn: (row) => {
      const b = row.breeder;
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
  },
  {
    id: "band",
    accessorFn: (row) => row.bird?.band ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Band" />
    ),
    cell: ({ getValue }) => (
      <span className="font-mono text-sm">{(getValue() as string) || "N/A"}</span>
    ),
  },
  {
    id: "rfid",
    accessorFn: (row) => row.hasRfid,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="RFID" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      if (item.hasRfid) {
        return (
          <div className="flex items-center gap-1.5">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground font-mono">
              {item.bird?.rfid}
            </span>
          </div>
        );
      }
      return <X className="h-4 w-4 text-red-500" />;
    },
  },
  {
    id: "paid",
    accessorFn: (row) => row.hasPaid,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paid" />
    ),
    cell: ({ getValue }) =>
      getValue() ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-red-500" />
      ),
  },
  {
    id: "status",
    accessorFn: (row) => row.isCheckedIn,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      if (item.isLoftBasketed) {
        return <Badge variant="default">Basketed</Badge>;
      }
      if (item.isCheckedIn) {
        return <Badge variant="secondary">Checked In</Badge>;
      }
      if (!item.hasPaid) {
        return <Badge variant="destructive">Unpaid</Badge>;
      }
      return <Badge variant="outline">Needs RFID</Badge>;
    },
  },
  {
    id: "loftBasket",
    accessorFn: (row) => row.loftBasketLabel ?? "",
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
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;
      if (!item.hasRfid) {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onLink(item)}
            className="gap-1.5"
          >
            <Link className="h-3.5 w-3.5" />
            Link RFID
          </Button>
        );
      }
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUnlink(item)}
          className="gap-1.5 text-red-600 hover:text-red-700"
        >
          <Unlink className="h-3.5 w-3.5" />
          Unlink
        </Button>
      );
    },
  },
];
