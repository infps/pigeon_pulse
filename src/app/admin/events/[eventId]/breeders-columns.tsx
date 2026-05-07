"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import type { EventInventory } from "@/lib/types";
import { computePaymentStatus } from "@/lib/paymentStatus";

export const createBreedersColumns = (
  onBreederClick: (eventInventoryId: number) => void
): ColumnDef<EventInventory>[] => [
  {
    id: "loft",
    accessorKey: "loft",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loft" />
    ),
  },
  {
    id: "breederName",
    accessorKey: "breeder.firstName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder Name" />
    ),
    cell: ({ row }) => {
      const breeder = row.original.breeder;
      return (
        <span
          className="cursor-pointer hover:underline text-blue-600"
          onClick={() => onBreederClick(row.original.id)}
        >
          {breeder?.firstName} {breeder?.lastName || ""}
        </span>
      );
    },
  },
  {
    id: "breederEmail",
    header: "Email",
    cell: ({ row }) => <span>{row.original.breeder?.email || "-"}</span>,
  },
  {
    id: "breederPhone",
    header: "Phone",
    cell: ({ row }) => <span>{row.original.breeder?.phone || "-"}</span>,
  },
  {
    accessorKey: "reservedBirds",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reserved Birds" />
    ),
  },
  {
    accessorKey: "signInDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sign In Date" />
    ),
    cell: ({ row }) => {
      const signInDate = row.original.signInDate;
      if (!signInDate) return <span>-</span>;
      const date = new Date(signInDate);
      return <span>{date.toLocaleDateString()}</span>;
    },
  },
  {
    header: "Perch Fee",
    cell: ({ row }) => {
      const value = (row.original.items ?? []).reduce(
        (sum, item) => sum + (item.entryFeeValue ?? 0),
        0
      );
      return <span>${value.toFixed(2)}</span>;
    },
  },
  {
    header: "Bird Fees Value",
    cell: ({ row }) => {
      const value = (row.original.items ?? []).reduce(
        (sum, item) => sum + (item.perchFeeValue ?? 0),
        0
      );
      return <span>${value.toFixed(2)}</span>;
    },
  },
  {
    header: "Bird Fees Paid",
    cell: ({ row }) => {
      const paid = (row.original.payments ?? [])
        .filter((p) => (p.paymentType as unknown) === "PERCH_FEE")
        .reduce((sum, p) => sum + (p.paymentValue ?? 0), 0);
      return <span>${paid.toFixed(2)}</span>;
    },
  },
  {
    header: "Race Fees Value",
    cell: ({ row }) => {
      const value = (row.original.items ?? []).reduce(
        (sum, item) => sum + (item.raceFeeValue ?? 0),
        0
      );
      return <span>${value.toFixed(2)}</span>;
    },
  },
  {
    header: "Hotspot Fees Value",
    cell: ({ row }) => {
      const value = (row.original.items ?? []).reduce(
        (sum, item) => sum + (item.hotSpotFeeValue ?? 0),
        0
      );
      return <span>${value.toFixed(2)}</span>;
    },
  },
  {
    id: "paymentStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment Status" />
    ),
    cell: ({ row }) => {
      const status = computePaymentStatus(row.original.items ?? [], row.original.payments ?? []);
      switch (status) {
        case "PAID":
          return <Badge className="bg-green-600 text-white">Paid</Badge>;
        case "OVERPAID":
          return <Badge className="bg-yellow-500 text-white">Overpaid</Badge>;
        case "PARTIAL":
          return <Badge className="bg-yellow-500 text-white">Partial</Badge>;
        case "PENDING":
          return <Badge className="bg-red-600 text-white">Unpaid</Badge>;
        case "NA":
        default:
          return <Badge variant="outline" className="text-muted-foreground">N/A</Badge>;
      }
    },
    sortingFn: (rowA, rowB) => {
      const score = (row: typeof rowA) => {
        const status = computePaymentStatus(row.original.items ?? [], row.original.payments ?? []);
        switch (status) {
          case "NA": return 0;
          case "OVERPAID": return 1;
          case "PARTIAL": return 2;
          case "PENDING": return 3;
          case "PAID": return 4;
          default: return 0;
        }
      };
      return score(rowA) - score(rowB);
    },
  },
  {
    id: "note",
    header: "Note",
    cell: ({ row }) => <span>{row.original.note || "-"}</span>,
  },
];
