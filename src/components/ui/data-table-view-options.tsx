"use client"

import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu"
import { Table } from "@tanstack/react-table"
import { Settings2, GripVertical } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
  columnOrder: string[]
  onColumnOrderChange: (order: string[]) => void
}

export function DataTableViewOptions<TData>({
  table,
  columnOrder,
  onColumnOrderChange,
}: DataTableViewOptionsProps<TData>) {
  const dragCol = useRef<string | null>(null)

  // Ordered list of hideable columns
  const allHideable = table
    .getAllColumns()
    .filter((c) => typeof c.accessorFn !== "undefined" && c.getCanHide())

  const ordered = columnOrder.length
    ? columnOrder
        .map((id) => allHideable.find((c) => c.id === id))
        .filter(Boolean)
    : allHideable

  const handleDragStart = (id: string) => {
    dragCol.current = id
  }

  const handleDrop = (targetId: string) => {
    const src = dragCol.current
    if (!src || src === targetId) return
    const ids = ordered.map((c) => c!.id)
    const fromIdx = ids.indexOf(src)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const next = [...ids]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, src)
    onColumnOrderChange(next)
    dragCol.current = null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Columns — drag to reorder</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ordered.map((column) => {
          if (!column) return null
          return (
            <div
              key={column.id}
              draggable
              onDragStart={() => handleDragStart(column.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(column.id)}
              className="flex items-center"
            >
              <span className="px-2 py-1 cursor-grab text-muted-foreground">
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              <DropdownMenuCheckboxItem
                className="flex-1 capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                onSelect={(e) => e.preventDefault()}
              >
                {(column.columnDef.meta as any)?.label ?? column.id}
              </DropdownMenuCheckboxItem>
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
