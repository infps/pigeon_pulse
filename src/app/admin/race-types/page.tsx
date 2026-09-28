"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCreateRaceType, useDeleteRaceType, useListRaceTypes, useUpdateRaceType } from "@/lib/api/race-types";
import { DataTable } from "@/components/ui/data-table";
import { createColumns, RaceType } from "./columns";
import type { RaceTypePrizeRole } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function RaceTypesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", isPaid: false, isPaymentRequired: false, color: "#1d4ed8", prizeRole: "NONE" as RaceTypePrizeRole });

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
      setFormData({ name: "", isPaid: false, isPaymentRequired: false, color: "#1d4ed8", prizeRole: "NONE" });
      setIsCreating(false);
    } catch (error) {
      toast.error(editingId ? "Failed to update race type" : "Failed to create race type");
    }
  };

  const handleEdit = (raceType: RaceType) => {
    setEditingId(raceType.id);
    setFormData({ name: raceType.name, isPaid: raceType.isPaid, isPaymentRequired: raceType.isPaymentRequired, color: raceType.color || "#1d4ed8", prizeRole: raceType.prizeRole ?? "NONE" });
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
    setFormData({ name: "", isPaid: false, isPaymentRequired: false, color: "#1d4ed8", prizeRole: "NONE" });
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
        <div className="bg-transparent p-6 rounded-lg shadow-md mb-6 border">
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
            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-9 w-12 rounded border cursor-pointer bg-transparent p-0.5"
                />
                <Input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#1d4ed8"
                  className="w-32 font-mono"
                />
                <span
                  className="inline-block h-6 w-6 rounded-full border"
                  style={{ backgroundColor: formData.color }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Used to color stations of this type on the map.
              </p>
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
            <div className="flex items-center space-x-2">
              <input
                id="isPaymentRequired"
                type="checkbox"
                checked={formData.isPaymentRequired}
                onChange={(e) => setFormData({ ...formData, isPaymentRequired: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="isPaymentRequired" className="cursor-pointer">
                Payment Required (triggers defaulter detection 7 days before race)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prizeRole">Prize</Label>
              <select
                id="prizeRole"
                value={formData.prizeRole}
                onChange={(e) =>
                  setFormData({ ...formData, prizeRole: e.target.value as RaceTypePrizeRole })
                }
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="NONE">No prize</option>
                <option value="FINAL">Final race — pays from the season final prize scheme</option>
                <option value="HOTSPOT_1">Hot spot 1 — pays from hot spot 1 prize scheme</option>
                <option value="HOTSPOT_2">Hot spot 2 — pays from hot spot 2 prize scheme</option>
                <option value="HOTSPOT_3">Hot spot 3 — pays from hot spot 3 prize scheme</option>
                <option value="AVERAGE">Average winner — pays from the average prize scheme</option>
              </select>
              <p className="text-muted-foreground text-sm">
                Races of this type award prize money from the chosen season scheme. A final
                race ranks only birds whose entry fee is paid, and splits a drop&apos;s prizes
                evenly; hot spot races rank only birds that paid a hot spot fee.
              </p>
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
