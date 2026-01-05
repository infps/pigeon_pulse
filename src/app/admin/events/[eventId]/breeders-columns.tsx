"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { EventInventory } from "@/lib/types";

export const createBreedersColumns = (
  onBreederClick: (eventInventoryId: string) => void
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
    accessorKey: "breeder.name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder Name" />
    ),
    cell: ({ row }) => {
      const breeder = row.original.breeder;
      return (
        <span
          className="cursor-pointer hover:underline text-blue-600"
          onClick={() => onBreederClick(row.original.eventInventoryId)}
        >
          {breeder.name} {breeder.lastName || ""}
        </span>
      );
    },
  },
  {
    accessorKey: "reservedBirds",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reserved Birds" />
    ),
  },
  {
    accessorKey: "registrationDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registration Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.registrationDate);
      return <span>{date.toLocaleDateString()}</span>;
    }
  },
  {
    header: "Perch Fees Value",
    cell: ({row})=>{
        const perchFeesValue = row.original.payments.filter(p => p.paymentType === 'PERCH_FEE').reduce((sum, p) => sum + p.amountToPay, 0);
        return <span>${perchFeesValue.toFixed(2)}</span>;
    }
  },
  {
    header: "Perch Fees Paid",
    cell: ({row})=>{
        const perchFeesPaid = row.original.payments.filter(p => p.paymentType === 'PERCH_FEE').reduce((sum, p) => sum + p.amountPaid, 0);
        return <span>${perchFeesPaid.toFixed(2)}</span>;
    }
  },
  {
    header: "Entry Fees Value",
    cell: ({row})=>{
        const entryFeesValue = row.original.payments.filter(p => p.paymentType === 'ENTRY_FEE').reduce((sum, p) => sum + p.amountToPay, 0);
        return <span>${entryFeesValue.toFixed(2)}</span>;
    }
  },
  {
    header: "Entry Fees Paid",
    cell: ({row})=>{
        const entryFeesPaid = row.original.payments.filter(p => p.paymentType === 'ENTRY_FEE').reduce((sum, p) => sum + p.amountPaid, 0);
        return <span>${entryFeesPaid.toFixed(2)}</span>;
    }
  }
];
