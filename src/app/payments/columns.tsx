"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<number, string> = {
  0: "Perch Fee", 1: "Per Bird Fee", 2: "Races Fee", 3: "Payouts", 4: "Other",
};
const METHOD_LABELS: Record<number, string> = {
  0: "Cash", 1: "Credit Card", 2: "PayPal", 3: "Bank Transfer",
};
const STATUS_CONFIG: Record<number, { label: string; className: string }> = {
  0: { label: "Pending", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  1: { label: "Paid", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  2: { label: "Partial", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  3: { label: "Failed", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  4: { label: "Refunded", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

interface Payment {
  id: number;
  paymentValue: number | null;
  paymentMethod: number | null;
  paymentType: number | null;
  paymentDate: string | null;
  status: string;
  eventInventory?: {
    event?: { name: string };
  };
}

export const paymentColumns: ColumnDef<Payment>[] = [
  {
    id: "index",
    header: "#",
    cell: ({ row }) => <span className="text-muted-foreground">{row.index + 1}</span>,
  },
  {
    id: "event",
    accessorFn: (row) => row.eventInventory?.event?.name ?? "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Event" />,
    cell: ({ row }) => (
      <span className="max-w-[200px] truncate block">
        {row.original.eventInventory?.event?.name || "-"}
      </span>
    ),
  },
  {
    accessorKey: "paymentType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => {
      const type = row.original.paymentType;
      return <span>{type != null ? TYPE_LABELS[type] ?? type : "-"}</span>;
    },
  },
  {
    accessorKey: "paymentMethod",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
    cell: ({ row }) => {
      const method = row.original.paymentMethod;
      return <span>{method != null ? METHOD_LABELS[method] ?? method : "-"}</span>;
    },
  },
  {
    accessorKey: "paymentValue",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (
      <span className="font-medium text-right block">
        ${(row.original.paymentValue ?? 0).toFixed(2)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const statusStr = row.original.status;
      const statusMap: Record<string, number> = {
        PENDING: 0, PAID: 1, PARTIAL: 2, FAILED: 3, REFUNDED: 4,
      };
      const statusNum = statusMap[statusStr] ?? (typeof statusStr === "number" ? statusStr : -1);
      const config = STATUS_CONFIG[statusNum];
      return config ? (
        <Badge className={config.className}>{config.label}</Badge>
      ) : (
        <Badge variant="outline">{statusStr ?? "-"}</Badge>
      );
    },
  },
  {
    accessorKey: "paymentDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => {
      const date = row.original.paymentDate;
      return <span>{date ? new Date(date).toLocaleDateString() : "-"}</span>;
    },
  },
];
