"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createRaceType, deleteRaceType, listRaceTypes, updateRaceType } from "@/lib/api/race-types";

interface RaceType {
  id: string;
  name: string;
  isPaid: boolean;
  createdAt: string;
}

export default function RaceTypesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", isPaid: false });

  // Fetch race types
  const { data: raceTypesData, isPending, isError } = listRaceTypes({});
  const raceTypes: RaceType[] = raceTypesData?.raceTypes || [];

  // Create mutation
  const createMutation = createRaceType({});

  // Update mutation
  const updateMutation = updateRaceType({});

  // Delete mutation
  const deleteMutation = deleteRaceType({ id: "" });

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
      const deleteMut = deleteRaceType({ id });
        if(!deleteMut.mutateAsync) return;
      await deleteMut.mutateAsync({});
      toast.success("Race type deleted successfully");
    } catch (error) {
      toast.error("Failed to delete race type");
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({ name: "", isPaid: false });
  };

  if (isPending) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <p>Loading race types...</p>
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

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Is Paid
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
            {raceTypes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No race types found. Create one to get started.
                </td>
              </tr>
            ) : (
              raceTypes.map((raceType) => (
                <tr key={raceType.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{raceType.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        raceType.isPaid
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {raceType.isPaid ? "Paid" : "Free"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(raceType.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(raceType)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(raceType.id)}
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
