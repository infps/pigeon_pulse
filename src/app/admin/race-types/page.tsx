"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCreateRaceType, useDeleteRaceType, useListRaceTypes, useUpdateRaceType } from "@/lib/api/race-types";
import { DataTable } from "@/components/ui/data-table";
import { createColumns, RaceType } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";

export default function RaceTypesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", isPaid: false });

  // Fetch race types
  const { data: raceTypesData, isPending, isError } = useListRaceTypes({});
  const raceTypes: RaceType[] = raceTypesData?.raceTypes || [];

  // Create mutation
  const createMutation = useCreateRaceType({});

  // Update mutation
  const updateMutation = useUpdateRaceType({});

  // Delete mutation
  const deleteMutation = useDeleteRaceType({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Race type name is required");
      return;
    }

    try {
      if (editingId) {
        // Update
        if(!updateMutation.mutateAsync) return;
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast.success("Race type updated successfully");
        setEditingId(null);
      } else {
        // Create
        if(!createMutation.mutateAsync) return;
        await createMutation.mutateAsync(formData);
        toast.success("Race type created successfully");
      }
      setFormData({ name: "", isPaid: false });
      setIsCreating(false);
    } catch (error) {
      toast.error(editingId ? "Failed to update race type" : "Failed to create race type");
    }
  };

  const handleEdit = (raceType: RaceType) => {
    setEditingId(raceType.id);
    setFormData({ name: raceType.name, isPaid: raceType.isPaid });
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this race type?")) return;

    try {
      if(!deleteMutation.mutateAsync) return;
      await deleteMutation.mutateAsync({ id });
      toast.success("Race type deleted successfully");
    } catch (error) {
      console.log(error);
      toast.error("Failed to delete race type");
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({ name: "", isPaid: false });
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
        <div className="text-red-500">Error loading race types</div>
      </div>
    );
  }

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Race Types</h1>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>Create New Race Type</Button>
        )}
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "Edit Race Type" : "Create New Race Type"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter race type name"
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="isPaid"
                type="checkbox"
                checked={formData.isPaid}
                onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="isPaid" className="cursor-pointer">
                Is Paid
              </Label>
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
        data={raceTypes}
        filterableColumns={[
          { id: "name", title: "Name" },
        ]}
      />
    </div>
  );
}
