"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createEventType, deleteEventType, listEventTypes, updateEventType } from "@/lib/api/event-types";

interface EventType {
  eventTypeId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export default function EventTypesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Fetch event types
  const { data: eventTypesData, isPending, isError } = listEventTypes({});
  const eventTypes: EventType[] = eventTypesData?.eventTypes || [];

  // Create mutation
  const createMutation = createEventType({});

  // Update mutation
  const updateMutation = updateEventType({});

  // Delete mutation
  const deleteMutation = deleteEventType({ eventTypeId: "" });

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
      const deleteMut = deleteEventType({ eventTypeId });
      if(!deleteMut.mutateAsync) return;
      await deleteMut.mutateAsync({});
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

  if (isPending) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <p>Loading event types...</p>
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

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {eventTypes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No event types found. Create one to get started.
                </td>
              </tr>
            ) : (
              eventTypes.map((eventType) => (
                <tr key={eventType.eventTypeId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{eventType.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">
                      {eventType.description || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(eventType.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(eventType)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(eventType.eventTypeId)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
