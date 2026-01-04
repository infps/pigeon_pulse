"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { EventInventoryItem } from "@/lib/types";

export const breedersColumns: ColumnDef<EventInventoryItem>[] = [
  {
    accessorKey: "loft",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loft" />
    ),
  },
  {
    accessorKey: "breeder.name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Breeder Name" />
    ),
    cell: ({ row }) => {
      const breeder = row.original.breeder;
      return (
        <span>
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
  }
];
