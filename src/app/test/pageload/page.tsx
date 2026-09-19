"use client"

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { InfiniteTable } from "@/components/ui/infinite-table"
import { Badge } from "@/components/ui/badge"

type Bird = {
  id: number
  band: string | null
  birdName: string | null
  color: string | null
  sex: number | null
  rfid: string | null
  breeder: { firstName: string; lastName: string } | null
}

const columns: ColumnDef<Bird, unknown>[] = [
  { accessorKey: "id", header: "ID", cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
  { accessorKey: "band", header: "Band", cell: ({ getValue }) => getValue() ?? "—" },
  { accessorKey: "birdName", header: "Name", cell: ({ getValue }) => getValue() ?? "—" },
  { accessorKey: "color", header: "Color", cell: ({ getValue }) => getValue() ?? "—" },
  {
    accessorKey: "sex",
    header: "Sex",
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      return v === 1 ? <Badge variant="outline">M</Badge> : v === 2 ? <Badge variant="outline">F</Badge> : "—"
    },
  },
  { accessorKey: "rfid", header: "RFID", cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) ?? "—"}</span> },
  {
    id: "breeder",
    header: "Breeder",
    cell: ({ row }) => {
      const b = row.original.breeder
      return b ? `${b.firstName} ${b.lastName}` : "—"
    },
  },
]

const PAGE_SIZE = 200

export default function PageloadTestPage() {
  const [rows, setRows] = React.useState<Bird[]>([])
  const [cursor, setCursor] = React.useState<number | null>(null)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const loadingRef = React.useRef(false)

  const fetchPage = React.useCallback(async (cur: number | null) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setIsLoading(true)
    try {
      const url = `/api/admin/birds?limit=${PAGE_SIZE}${cur ? `&cursor=${cur}` : ""}`
      const res = await fetch(url)
      if (!res.ok) throw new Error("fetch failed")
      const data = await res.json()
      setRows((prev) => [...prev, ...data.birds])
      setCursor(data.nextCursor)
      setHasMore(data.nextCursor !== null)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
      loadingRef.current = false
    }
  }, [])

  React.useEffect(() => { fetchPage(null) }, [fetchPage])

  const onLoadMore = React.useCallback(() => fetchPage(cursor), [fetchPage, cursor])

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Infinite Scroll — Birds</h1>
          <p className="text-sm text-muted-foreground">Loads 200 rows at a time · sentinel triggers at row 150</p>
        </div>
        <Badge variant="secondary">{rows.length} loaded</Badge>
      </div>
      <InfiniteTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        triggerAt={150}
      />
    </div>
  )
}
