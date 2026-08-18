"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
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
  tableId?: string
  searchKey?: string
  searchPlaceholder?: string
  filterableColumns?: {
    id: string
    title: string
  }[]
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void
  onRowClick?: (row: TData) => void
  initialColumnVisibility?: VisibilityState
  externalFilterValue?: string
  externalFilterColumn?: string
  emptyState?: React.ReactNode
}

function loadPrefs(tableId: string): { visibility: VisibilityState; order: string[] } | null {
  try {
    const raw = localStorage.getItem(`dt-prefs-${tableId}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function savePrefs(tableId: string, visibility: VisibilityState, order: string[]) {
  try {
    localStorage.setItem(`dt-prefs-${tableId}`, JSON.stringify({ visibility, order }))
  } catch {}
}

export function DataTable<TData, TValue>({
  columns,
  data,
  tableId,
  searchKey,
  searchPlaceholder = "Search...",
  filterableColumns = [],
  rowSelection: externalRowSelection,
  onRowSelectionChange: externalOnRowSelectionChange,
  onRowClick,
  initialColumnVisibility,
  externalFilterValue,
  externalFilterColumn,
  emptyState,
}: DataTableProps<TData, TValue>) {
  const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [selectedColumn, setSelectedColumn] = React.useState<string>(
    filterableColumns.length > 0 ? filterableColumns[0].id : ""
  )

  // Load persisted prefs once on mount
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    if (tableId) {
      const saved = loadPrefs(tableId)
      if (saved?.visibility) return saved.visibility
    }
    return initialColumnVisibility ?? {}
  })

  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
    if (tableId) {
      const saved = loadPrefs(tableId)
      if (saved?.order?.length) return saved.order
    }
    return []
  })

  // Persist whenever visibility or order changes
  React.useEffect(() => {
    if (!tableId) return
    savePrefs(tableId, columnVisibility, columnOrder)
  }, [tableId, columnVisibility, columnOrder])

  const rowSelection = externalRowSelection ?? internalRowSelection
  const setRowSelection = externalOnRowSelectionChange ?? setInternalRowSelection

  const table = useReactTable({
    data,
    columns,
    initialState: { pagination: { pageSize: 20 } },
    state: {
      sorting,
      columnVisibility,
      columnOrder,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  React.useEffect(() => {
    if (externalFilterValue === undefined) return
    const col = externalFilterColumn ?? (filterableColumns.length > 0 ? filterableColumns[0].id : "")
    if (col) {
      if (externalFilterColumn) setSelectedColumn(externalFilterColumn)
      table.getColumn(col)?.setFilterValue(externalFilterValue)
    } else {
      table.setGlobalFilter(externalFilterValue)
    }
  }, [externalFilterValue, externalFilterColumn]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <DataTableViewOptions
          table={table}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
        />
      </div>
      <div className="overflow-auto relative rounded-md border max-h-[65vh]">
        <Table>
          <TableHeader className="bg-primary sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="text-primary-foreground font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyState ?? "No results."}
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
