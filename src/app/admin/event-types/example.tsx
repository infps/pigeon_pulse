"use client"

import { DataTable } from "@/components/ui/data-table"
import { columns } from "./columns"
import { listEventTypes } from "@/lib/api/event-types"
import { Skeleton } from "@/components/ui/skeleton"

export default function EventTypesPage() {
  const { data: eventTypesData, isPending } = listEventTypes({})
  const eventTypes = eventTypesData?.eventTypes || []

  if (isPending) {
    return (
      <div className="container mx-auto py-10">
        <div className="space-y-4">
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Event Types</h1>
        <p className="text-muted-foreground">
          Manage event types for your pigeon racing events
        </p>
      </div>
      <DataTable
        columns={columns}
        data={eventTypes}
        searchKey="name"
        searchPlaceholder="Search event types..."
      />
    </div>
  )
}
