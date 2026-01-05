"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCreateEventType, useDeleteEventType, useListEventTypes, useUpdateEventType } from "@/lib/api/event-types";
import { DataTable } from "@/components/ui/data-table";
import { createColumns, EventType } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";

export default function EventTypesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Fetch event types
  const { data: eventTypesData, isPending, isError } = useListEventTypes({});
  const eventTypes: EventType[] = eventTypesData?.eventTypes || [];

  // Create mutation
  const createMutation = useCreateEventType({});

  // Update mutation
  const updateMutation = useUpdateEventType({});

  // Delete mutation
  const deleteMutation = useDeleteEventType({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Event type name is required");
      return;
    }

    try {
      if (editingId) {
        // Update
        if(!updateMutation.mutateAsync) return;
        await updateMutation.mutateAsync({ eventTypeId: editingId, ...formData });
        toast.success("Event type updated successfully");
        setEditingId(null);
      } else {
        // Create
        if(!createMutation.mutateAsync) return;
        await createMutation.mutateAsync(formData);
        toast.success("Event type created successfully");
      }
      setFormData({ name: "", description: "" });
      setIsCreating(false);
    } catch (error) {
      toast.error(editingId ? "Failed to update event type" : "Failed to create event type");
    }
  };

  const handleEdit = (eventType: EventType) => {
    setEditingId(eventType.eventTypeId);
    setFormData({ 
      name: eventType.name, 
      description: eventType.description || "" 
    });
    setIsCreating(true);
  };

  const handleDelete = async (eventTypeId: string) => {
    if (!confirm("Are you sure you want to delete this event type?")) return;

    try {
      if(!deleteMutation.mutateAsync) return;
      await deleteMutation.mutateAsync({ eventTypeId });
      toast.success("Event type deleted successfully");
    } catch (error) {
      toast.error("Failed to delete event type");
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({ name: "", description: "" });
  };

  const columns = createColumns(handleEdit, handleDelete);

  if (isPending) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-62.5" />
          <Skeleton className="h-100 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <div className="text-red-500">Error loading event types</div>
      </div>
    );
  }

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Event Types</h1>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>Create New Event Type</Button>
        )}
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "Edit Event Type" : "Create New Event Type"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter event type name"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter event type description (optional)"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingId
                  ? "Update"
                  : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        columns={columns}
        data={eventTypes}
        filterableColumns={[
          { id: "name", title: "Name" },
          { id: "description", title: "Description" },
        ]}
      />
    </div>
  );
}
