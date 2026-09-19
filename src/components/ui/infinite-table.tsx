"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"

interface InfiniteTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  rows: TData[]
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
  emptyState?: React.ReactNode
  // ponytail: sentinel placed after this row index (default 150 = 75% of 200-row pages)
  triggerAt?: number
}

export function InfiniteTable<TData>({
  columns,
  rows,
  isLoading,
  hasMore,
  onLoadMore,
  emptyState,
  triggerAt = 150,
}: InfiniteTableProps<TData>) {
  const sentinelRef = useInfiniteScroll(onLoadMore, hasMore && !isLoading)

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const tableRows = table.getRowModel().rows

  return (
    <div className="overflow-auto relative rounded-md border max-h-[75vh]">
      <Table>
        <TableHeader className="bg-primary sticky top-0 z-10">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} colSpan={h.colSpan} className="text-primary-foreground font-medium">
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {tableRows.length === 0 && !isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyState ?? "No results."}
              </TableCell>
            </TableRow>
          ) : (
            tableRows.map((row, idx) => (
              <React.Fragment key={row.id}>
                <TableRow data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {idx === triggerAt - 1 && (
                  <tr aria-hidden>
                    <td colSpan={columns.length} className="p-0">
                      <div ref={sentinelRef} className="h-1" />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={`skel-${i}`}>
              {columns.map((_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!hasMore && rows.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-3">All {rows.length} rows loaded</p>
      )}
    </div>
  )
}
