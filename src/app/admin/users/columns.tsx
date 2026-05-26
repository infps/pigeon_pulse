"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Info, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { User, UserRole, UserStatus } from "@/lib/types"
import { getCountryFlag, getStateFlag, getCountryName, getStateName } from "@/lib/flag-constants"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import Image from "next/image"

export const createColumns = (
  onEdit: (user: User) => void,
  onDelete: (id: string) => void,
  onViewTeams: (user: User) => void,
  splitName = false,
  onCopy?: (user: User) => void,
): ColumnDef<User>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  ...(splitName
    ? [
        {
          accessorKey: "name",
          header: ({ column }: { column: import("@tanstack/react-table").Column<User> }) => (
            <DataTableColumnHeader column={column} title="First Name" />
          ),
          cell: ({ row }: { row: import("@tanstack/react-table").Row<User> }) => (
            <span>{row.getValue("name") as string}</span>
          ),
        } as ColumnDef<User>,
        {
          accessorKey: "lastName",
          header: ({ column }: { column: import("@tanstack/react-table").Column<User> }) => (
            <DataTableColumnHeader column={column} title="Last Name" />
          ),
          cell: ({ row }: { row: import("@tanstack/react-table").Row<User> }) => (
            <span>{(row.getValue("lastName") as string | null) || "-"}</span>
          ),
        } as ColumnDef<User>,
      ]
    : [
        {
          id: "name",
          accessorKey: "name",
          header: ({ column }: { column: import("@tanstack/react-table").Column<User> }) => (
            <DataTableColumnHeader column={column} title="Name" />
          ),
          cell: ({ row }: { row: import("@tanstack/react-table").Row<User> }) => {
            const name = row.getValue("name") as string
            const lastName = row.original.lastName
            return <span>{`${name}${lastName ? ` ${lastName}` : ""}`}</span>
          },
          sortingFn: (rowA: import("@tanstack/react-table").Row<User>, rowB: import("@tanstack/react-table").Row<User>) => {
            const a = `${rowA.original.lastName || ""} ${rowA.original.name}`.trim().toLowerCase()
            const b = `${rowB.original.lastName || ""} ${rowB.original.name}`.trim().toLowerCase()
            return a.localeCompare(b)
          },
        } as ColumnDef<User>,
      ]),
  {
    accessorKey: "loftName",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <DataTableColumnHeader column={column} title="Loft" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium mb-1">Loft Name</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Identifies the breeder&apos;s physical loft during basketting</li>
              <li>Printed on basket labels (e.g. LB-SMITH-1)</li>
              <li>Common designations: AGN, AS, OLR tags, or custom names</li>
              <li>Useful when one person manages multiple lofts</li>
            </ul>
          </TooltipContent>
        </Tooltip>
      </div>
    ),
    cell: ({ row }) => <span>{(row.getValue("loftName") as string | null) || "-"}</span>,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
  },
  {
    accessorKey: "username",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Username" />
    ),
    cell: ({ row }) => {
      const username = row.getValue("username") as string | undefined
      return <span>{username || "-"}</span>
    },
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      const role = row.getValue("role") as UserRole
      const variant = 
        role === "SUPERADMIN" ? "default" : 
        role === "ADMIN" ? "secondary" : 
        "outline"
      return <Badge variant={variant}>{role}</Badge>
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as UserStatus
      const variant = 
        status === "ACTIVE" ? "default" : 
        status === "INACTIVE" ? "destructive" : 
        "secondary"
      return <Badge variant={variant}>{status}</Badge>
    },
  },
  {
    accessorKey: "phoneNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
    cell: ({ row }) => {
      const phone = row.getValue("phoneNumber") as string | undefined
      return <span>{phone || "-"}</span>
    },
  },
  {
    accessorKey: "country",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Country" />
    ),
    cell: ({ row }) => {
      const country = row.getValue("country") as string | undefined
      if (!country) return <span>-</span>
      const flag = getCountryFlag(country)
      return (
        <div className="flex items-center gap-2">
          {flag && (
            <Image
              src={flag}
              alt={getCountryName(country)}
              width={20}
              height={15}
              className="rounded"
            />
          )}
          <span>{getCountryName(country)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "state",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="State" />
    ),
    cell: ({ row }) => {
      const state = row.getValue("state") as string | undefined
      if (!state) return <span>-</span>
      const flag = getStateFlag(state)
      return (
        <div className="flex items-center gap-2">
          {flag && (
            <Image
              src={flag}
              alt={getStateName(state)}
              width={20}
              height={15}
              className="rounded"
            />
          )}
          <span>{getStateName(state)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "city",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="City" />
    ),
    cell: ({ row }) => <span>{(row.getValue("city") as string) || "-"}</span>,
  },
  {
    accessorKey: "address",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Address" />
    ),
    cell: ({ row }) => <span>{(row.getValue("address") as string) || "-"}</span>,
  },
  {
    accessorKey: "postalCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Postal Code" />
    ),
    cell: ({ row }) => <span>{(row.getValue("postalCode") as string) || "-"}</span>,
  },
  {
    accessorKey: "webAddress",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Website" />
    ),
    cell: ({ row }) => <span>{(row.getValue("webAddress") as string) || "-"}</span>,
  },
  {
    accessorKey: "ssn",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="SSN" />
    ),
    cell: ({ row }) => <span>{(row.getValue("ssn") as string) || "-"}</span>,
  },
  {
    accessorKey: "taxNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tax Number" />
    ),
    cell: ({ row }) => <span>{(row.getValue("taxNumber") as string) || "-"}</span>,
  },
  {
    accessorKey: "legalName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Legal Name" />
    ),
    cell: ({ row }) => <span>{(row.getValue("legalName") as string) || "-"}</span>,
  },
  {
    accessorKey: "timezone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timezone" />
    ),
    cell: ({ row }) => <span>{(row.getValue("timezone") as string) || "-"}</span>,
  },
  {
    accessorKey: "note",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Note" />
    ),
    cell: ({ row }) => <span>{(row.getValue("note") as string) || "-"}</span>,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"))
      return <span>{date.toLocaleDateString()}</span>
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original
      const stop = (e: React.SyntheticEvent) => e.stopPropagation()

      return (
        <div onClick={stop}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={stop}>
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={stop}>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(user.id)}
              >
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(user.email)}
              >
                Copy Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onViewTeams(user)}>
                View Teams
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onCopy && (
                <DropdownMenuItem onClick={() => onCopy(user)}>
                  Copy Breeder
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit(user)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(user.id)}
                className="text-red-600"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]
