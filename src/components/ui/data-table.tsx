"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { DataTableViewOptions } from "@/components/ui/data-table-view-options"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  filterableColumns?: {
    id: string
    title: string
  }[]
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  filterableColumns = [],
  rowSelection: externalRowSelection,
  onRowSelectionChange: externalOnRowSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [selectedColumn, setSelectedColumn] = React.useState<string>(
    filterableColumns.length > 0 ? filterableColumns[0].id : ""
  )

  // Use external state if provided, otherwise use internal state
  const rowSelection = externalRowSelection ?? internalRowSelection
  const setRowSelection = externalOnRowSelectionChange ?? setInternalRowSelection

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Determine if we should use column-specific filtering or global filtering
  const useColumnFiltering = filterableColumns.length > 0
  const currentFilterValue = useColumnFiltering
    ? (table.getColumn(selectedColumn)?.getFilterValue() as string) ?? ""
    : (table.getState().globalFilter as string) ?? ""

  const handleFilterChange = (value: string) => {
    if (useColumnFiltering) {
      table.getColumn(selectedColumn)?.setFilterValue(value)
    } else {
      table.setGlobalFilter(value)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {useColumnFiltering ? (
            <>
              <Select
                value={selectedColumn}
                onValueChange={(value) => {
                  setSelectedColumn(value)
                  // Clear the previous column filter
                  table.resetColumnFilters()
                }}
              >
                <SelectTrigger className="h-8 w-45">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {filterableColumns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={`Filter ${filterableColumns.find((c) => c.id === selectedColumn)?.title.toLowerCase() || ""}...`}
                value={currentFilterValue}
                onChange={(event) => handleFilterChange(event.target.value)}
                className="h-8 w-62.5"
              />
            </>
          ) : searchKey ? (
            <Input
              placeholder={searchPlaceholder}
              value={currentFilterValue}
              onChange={(event) => handleFilterChange(event.target.value)}
              className="h-8 w-37.5 lg:w-62.5"
            />
          ) : null}
        </div>
        <DataTableViewOptions table={table} />
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
