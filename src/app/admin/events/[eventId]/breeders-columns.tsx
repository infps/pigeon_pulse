"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import type { EventInventory } from "@/lib/types";
import { computePaymentStatus } from "@/lib/paymentStatus";

// Server-computed status (accounts for hotspot gates); local calc only if the list API omitted it.
const rowStatus = (row: EventInventory) =>
  row.feeTotals?.status ?? computePaymentStatus(row.items ?? [], row.payments ?? []);

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
    accessorFn: (row) => row.feeTotals?.entry ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Entry Fee" />,
    cell: ({ row }) => <span>${(row.original.feeTotals?.entry ?? 0).toFixed(2)}</span>,
  },
  {
    id: "birdFeesValue",
    accessorFn: (row) => row.feeTotals?.perBird ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Per Bird Fee" />,
    cell: ({ row }) => <span>${(row.original.feeTotals?.perBird ?? 0).toFixed(2)}</span>,
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
    accessorFn: (row) => row.feeTotals?.perchHotspot ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Perch Fee (Hot Spot)" />,
    cell: ({ row }) => <span>${(row.original.feeTotals?.perchHotspot ?? 0).toFixed(2)}</span>,
  },
  {
    id: "paymentStatus",
    accessorFn: (row) => rowStatus(row),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Payment Status" />
    ),
    cell: ({ row }) => {
      const status = rowStatus(row.original);
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
        const status = rowStatus(row.original);
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
