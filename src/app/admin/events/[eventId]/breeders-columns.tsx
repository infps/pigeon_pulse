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
    accessorFn: (row) => {
      const b = row.breeder;
      return [b?.firstName, b?.lastName].filter(Boolean).join(" ");
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder Name" />
    ),
    cell: ({ row }) => {
      const breeder = row.original.breeder;
      return (
        <span>{breeder?.firstName} {breeder?.lastName || ""}</span>
      );
    },
  },
  {
    id: "breederEmail",
    accessorFn: (row) => row.breeder?.email ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => <span>{row.original.breeder?.email || "-"}</span>,
  },
  {
    id: "breederPhone",
    accessorFn: (row) => row.breeder?.phone ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
    cell: ({ row }) => <span>{row.original.breeder?.phone || "-"}</span>,
  },
  {
    id: "reservedBirds",
    accessorKey: "reservedBirds",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reserved Birds" />
    ),
  },
  {
    id: "signInDate",
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
    id: "partners",
    accessorFn: (row) =>
      (row.partners ?? [])
        .map((p) => [p.breeder?.firstName, p.breeder?.lastName].filter(Boolean).join(" "))
        .filter(Boolean)
        .join(", "),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Partners" />
    ),
    cell: ({ row }) => {
      const names = (row.original.partners ?? [])
        .map((p) => [p.breeder?.firstName, p.breeder?.lastName].filter(Boolean).join(" "))
        .filter(Boolean);
      return <span>{names.length ? names.join(", ") : "-"}</span>;
    },
  },
  {
    id: "perchFee",
    accessorFn: (row) => {
      const v = (row.items ?? []).reduce((sum, item) => sum + (item.entryFeeValue ?? 0), 0);
      return v.toFixed(2);
    },
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
    id: "birdFeesValue",
    accessorFn: (row) => {
      const v = (row.items ?? []).reduce((sum, item) => sum + (item.perchFeeValue ?? 0), 0);
      return v.toFixed(2);
    },
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
    id: "birdFeesPaid",
    accessorFn: (row) => {
      const v = (row.payments ?? [])
        .filter((p) => (p.paymentType as unknown) === "PERCH_FEE")
        .reduce((sum, p) => sum + (p.paymentValue ?? 0), 0);
      return v.toFixed(2);
    },
    header: "Bird Fees Paid",
    cell: ({ row }) => {
      const paid = (row.original.payments ?? [])
        .filter((p) => (p.paymentType as unknown) === "PERCH_FEE")
        .reduce((sum, p) => sum + (p.paymentValue ?? 0), 0);
      return <span>${paid.toFixed(2)}</span>;
    },
  },
  {
    id: "raceFeesValue",
    accessorFn: (row) => {
      const v = (row.items ?? []).reduce((sum, item) => sum + (item.raceFeeValue ?? 0), 0);
      return v.toFixed(2);
    },
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
    id: "hotspotFeesValue",
    accessorFn: (row) => {
      const v = (row.items ?? []).reduce((sum, item) => sum + (item.hotSpotFeeValue ?? 0), 0);
      return v.toFixed(2);
    },
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
    accessorFn: (row) => computePaymentStatus(row.items ?? [], row.payments ?? []),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment Status" />
    ),
    cell: ({ row }) => {
      const payments = row.original.payments ?? [];
      const items = row.original.items ?? [];
      const status = computePaymentStatus(items, payments);
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
    accessorFn: (row) => row.note ?? "",
    header: "Note",
    cell: ({ row }) => <span>{row.original.note || "-"}</span>,
  },
];
