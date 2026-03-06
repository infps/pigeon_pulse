"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useCreatePrizeScheme,
  useDeletePrizeScheme,
  useListPrizeSchemes,
  useUpdatePrizeScheme,
} from "@/lib/api/prize-schemes";
import { useListRaceTypes } from "@/lib/api/race-types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrizeScheme, RaceType } from "@/lib/types";

export default function PrizeSchemeComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    prizeSchemeItems: [] as {
      raceTypeId: string;
      fromPosition: number;
      toPosition: number;
      prizeAmount: number;
    }[],
  });

  const { data: prizeSchemesData, isPending, isError } = useListPrizeSchemes({});
  const { data: raceTypesData } = useListRaceTypes({});
  const prizeSchemes: PrizeScheme[] = prizeSchemesData?.prizeSchemes || [];
  const raceTypes: RaceType[] = raceTypesData?.raceTypes || [];

  const createMutation = useCreatePrizeScheme({});
  const updateMutation = useUpdatePrizeScheme({});
  const deleteMutation = useDeletePrizeScheme({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Prize scheme name is required");
      return;
    }

    try {
      if (editingId) {
        if (!updateMutation.mutateAsync) return;
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast.success("Prize scheme updated successfully");
      } else {
        if (!createMutation.mutateAsync) return;
        await createMutation.mutateAsync(formData);
        toast.success("Prize scheme created successfully");
      }
      handleClose();
    } catch (error) {
      toast.error(
        editingId ? "Failed to update prize scheme" : "Failed to create prize scheme"
      );
    }
  };

  const handleEdit = (prizeScheme: PrizeScheme) => {
    setEditingId(prizeScheme.prizeSchemeId);
    setFormData({
      name: prizeScheme.name,
      description: prizeScheme.description || "",
      prizeSchemeItems: prizeScheme.prizeSchemeItems || [],
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prize scheme?")) return;

    try {
      if (!deleteMutation.mutateAsync) return;
      await deleteMutation.mutateAsync({ id });
      toast.success("Prize scheme deleted successfully");
    } catch (error) {
      toast.error("Failed to delete prize scheme");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      prizeSchemeItems: [],
    });
  };

  const addPrizeSchemeItem = () => {
    setFormData({
      ...formData,
      prizeSchemeItems: [
        ...formData.prizeSchemeItems,
        {
          raceTypeId: raceTypes[0]?.id || "",
          fromPosition: 1,
          toPosition: 1,
          prizeAmount: 0,
        },
      ],
    });
  };

  const removePrizeSchemeItem = (index: number) => {
    const newItems = formData.prizeSchemeItems.filter((_, i) => i !== index);
    setFormData({ ...formData, prizeSchemeItems: newItems });
  };

  const updatePrizeSchemeItem = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const newItems = [...formData.prizeSchemeItems];
    (newItems[index] as any)[field] = value;
    setFormData({ ...formData, prizeSchemeItems: newItems });
  };

  if (isPending) {
    return <Skeleton className="h-100 w-full" />;
  }

  if (isError) {
    return <div className="text-red-500">Error loading prize schemes</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Prize Schemes</h2>
        <Button onClick={() => setIsOpen(true)}>Add Prize Scheme</Button>
      </div>

      <div className="space-y-2">
        {prizeSchemes.map((scheme) => (
          <div
            key={scheme.prizeSchemeId}
            className="flex items-center justify-between p-4 border rounded-lg bg-transparent shadow-sm hover:shadow-md transition-shadow"
          >
            <span className="font-medium">{scheme.name}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEdit(scheme)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(scheme.prizeSchemeId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Prize Scheme" : "Add Prize Scheme"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            {/* Description (kept, not in reference) */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            {/* Prize Distribution Items */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {formData.prizeSchemeItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-4"
                >
                  <div className="w-full">
                    <Label>Race Type</Label>
                    <Select
                      value={item.raceTypeId}
                      onValueChange={(value) =>
                        updatePrizeSchemeItem(index, "raceTypeId", value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {raceTypes.map((rt) => (
                          <SelectItem key={rt.id} value={rt.id}>
                            {rt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full">
                    <Label>From Position</Label>
                    <Input
                      type="text"
                      value={item.fromPosition}
                      onChange={(e) =>
                        updatePrizeSchemeItem(
                          index,
                          "fromPosition",
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                  </div>

                  <div className="w-full">
                    <Label>To Position</Label>
                    <Input
                      type="text"
                      value={item.toPosition}
                      onChange={(e) =>
                        updatePrizeSchemeItem(
                          index,
                          "toPosition",
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                  </div>

                  <div className="w-full">
                    <Label>Prize Amount</Label>
                    <Input
                      type="text"
                      value={item.prizeAmount}
                      onChange={(e) =>
                        updatePrizeSchemeItem(
                          index,
                          "prizeAmount",
                          parseFloat(e.target.value) || 0
                        )
                      }
                    />
                  </div>

                  <Button
                    className="mt-5"
                    type="button"
                    variant="destructive"
                    onClick={() => removePrizeSchemeItem(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                onClick={addPrizeSchemeItem}
                disabled={raceTypes.length === 0}
              >
                Add Distribution
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
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
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
