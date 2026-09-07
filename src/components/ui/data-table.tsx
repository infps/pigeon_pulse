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
import { Check, ListFilter, X } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface FacetedFilter {
  id: string
  title: string
  options: { label: string; value: string }[]
}

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
  facetedFilters?: FacetedFilter[]
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => void
  onRowClick?: (row: TData) => void
  rowClickMode?: "none" | "highlight" | "action"
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
  facetedFilters = [],
  rowSelection: externalRowSelection,
  onRowSelectionChange: externalOnRowSelectionChange,
  onRowClick,
  rowClickMode,
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

  const filteredCount = table.getFilteredRowModel().rows.length
  const totalCount = data.length
  const isFiltered = filteredCount !== totalCount

  const anyFacetActive = facetedFilters.some(
    (ff) => ((table.getColumn(ff.id)?.getFilterValue() as string[]) ?? []).length > 0
  )

  const clearAllFacets = () => {
    facetedFilters.forEach((ff) => table.getColumn(ff.id)?.setFilterValue(undefined))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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

          {facetedFilters.map((ff) => {
            const selected = (table.getColumn(ff.id)?.getFilterValue() as string[]) ?? []
            const toggle = (value: string) => {
              const next = selected.includes(value)
                ? selected.filter((v) => v !== value)
                : [...selected, value]
              table.getColumn(ff.id)?.setFilterValue(next.length ? next : undefined)
            }
            return (
              <DropdownMenu key={ff.id}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 border-dashed">
                    <ListFilter className="h-3.5 w-3.5" />
                    {ff.title}
                    {selected.length > 0 && (
                      <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
                        {selected.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>{ff.title}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ff.options.map((opt) => {
                    const checked = selected.includes(opt.value)
                    return (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        checked={checked}
                        onCheckedChange={() => toggle(opt.value)}
                      >
                        {opt.label}
                        {checked && <Check className="ml-auto h-3.5 w-3.5 opacity-60" />}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                  {selected.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={false}
                        onCheckedChange={() => table.getColumn(ff.id)?.setFilterValue(undefined)}
                        className="text-muted-foreground"
                      >
                        Clear filter
                      </DropdownMenuCheckboxItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          })}

          {isFiltered && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {filteredCount} of {totalCount}
              </span>
              {anyFacetActive && (
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={clearAllFacets}>
                  <X className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          )}
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
                  className={
                    (rowClickMode === "action" || rowClickMode === "highlight" || (!rowClickMode && onRowClick))
                      ? "cursor-pointer hover:bg-muted/60"
                      : undefined
                  }
                  onClick={() => (rowClickMode !== "none") && onRowClick?.(row.original)}
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
