"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useCreateFeeScheme,
  useDeleteFeeScheme,
  useListFeeSchemes,
  useUpdateFeeScheme,
} from "@/lib/api/fee-schemes";
import { useListRaceTypes } from "@/lib/api/race-types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import type { FeeScheme, BirdFeeItem, RaceType } from "@/lib/types";

export default function FeeSchemeComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    perchFee: 0,
    isRefundable: false,
    maxBirds: 0,
    feesCutPercent: 0,
    birdFeeItems: [] as { birdNo: number; fee: number }[],
    raceTypes: [] as { raceTypeId: string; fee: number }[],
  });

  const { data: feeSchemesData, isPending, isError } = useListFeeSchemes({});
  const { data: raceTypesData } = useListRaceTypes({});
  const feeSchemes: FeeScheme[] = feeSchemesData?.feeSchemes || [];
  const raceTypes: RaceType[] = raceTypesData?.raceTypes || [];

  const createMutation = useCreateFeeScheme({});
  const updateMutation = useUpdateFeeScheme({});
  const deleteMutation = useDeleteFeeScheme({});

  // Update perch fee items when maxBirds changes
  useEffect(() => {
    const newPerchFeeItems = Array.from({ length: formData.maxBirds }, (_, i) => {
      const existing = formData.birdFeeItems[i];
      return existing || { birdNo: i + 1, fee: 0 };
    });
    setFormData((prev) => ({ ...prev, birdFeeItems: newPerchFeeItems }));
  }, [formData.maxBirds]);

  // Initialize race types when dialog opens
  useEffect(() => {
    if (isOpen && !editingId && raceTypes.length > 0) {
      const initialRaceTypes = raceTypes.map((rt) => ({
        raceTypeId: rt.id,
        fee: 0,
      }));
      setFormData((prev) => ({ ...prev, raceTypes: initialRaceTypes }));
    }
  }, [isOpen, editingId, raceTypes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Fee scheme name is required");
      return;
    }

    try {
      if (editingId) {
        if (!updateMutation.mutateAsync) return;
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast.success("Fee scheme updated successfully");
      } else {
        if (!createMutation.mutateAsync) return;
        await createMutation.mutateAsync(formData);
        toast.success("Fee scheme created successfully");
      }
      handleClose();
    } catch (error) {
      toast.error(editingId ? "Failed to update fee scheme" : "Failed to create fee scheme");
    }
  };

  const handleEdit = (feeScheme: FeeScheme) => {
    setEditingId(feeScheme.id);
    setFormData({
      name: feeScheme.name,
      description: feeScheme.description || "",
      perchFee: feeScheme.perchFee,
      isRefundable: feeScheme.isRefundable,
      maxBirds: feeScheme.maxBirds,
      feesCutPercent: feeScheme.feesCutPercent,
      birdFeeItems: feeScheme.birdFeeItems || [],
      raceTypes: feeScheme.raceTypes || [],
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fee scheme?")) return;

    try {
      if (!deleteMutation.mutateAsync) return;
      await deleteMutation.mutateAsync({ id });
      toast.success("Fee scheme deleted successfully");
    } catch (error) {
      toast.error("Failed to delete fee scheme");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      perchFee: 0,
      isRefundable: false,
      maxBirds: 0,
      feesCutPercent: 0,
      birdFeeItems: [],
      raceTypes: [],
    });
  };

  if (isPending) {
    return <Skeleton className="h-100 w-full" />;
  }

  if (isError) {
    return <div className="text-red-500">Error loading fee schemes</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Fee Schemes</h2>
        <Button onClick={() => setIsOpen(true)}>Add Fee Scheme</Button>
      </div>

      <div className="space-y-2">
        {feeSchemes.map((scheme) => (
          <div
            key={scheme.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
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
                onClick={() => handleDelete(scheme.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Fee Scheme" : "Add Fee Scheme"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="perchFee">Purge Fee</Label>
                <Input
                  id="perchFee"
                  type="number"
                  step="0.01"
                  value={formData.perchFee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      perchFee: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="maxBirds">Max Birds</Label>
                <Input
                  id="maxBirds"
                  type="number"
                  value={formData.maxBirds}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxBirds: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="feesCutPercent">Fees Cut Percent</Label>
                <Input
                  id="feesCutPercent"
                  type="number"
                  step="0.01"
                  value={formData.feesCutPercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      feesCutPercent: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="flex items-center space-x-2 pt-8">
                <input
                  id="isRefundable"
                  type="checkbox"
                  checked={formData.isRefundable}
                  onChange={(e) =>
                    setFormData({ ...formData, isRefundable: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="isRefundable" className="cursor-pointer">
                  Is Refundable
                </Label>
              </div>
            </div>

            {formData.maxBirds > 0 && (
              <div>
                <Label>Per Bird Fee Items</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto">
                  {formData.birdFeeItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Label className="w-20">Bird {item.birdNo}:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.fee}
                        onChange={(e) => {
                          const newItems = [...formData.birdFeeItems];
                          newItems[index].fee = parseFloat(e.target.value) || 0;
                          setFormData({ ...formData, birdFeeItems: newItems });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {raceTypes.length > 0 && (
              <div>
                <Label>Race Type Fees</Label>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                  {raceTypes.map((raceType, index) => {
                    const raceTypeFee = formData.raceTypes.find(
                      (rt) => rt.raceTypeId === raceType.id
                    );
                    return (
                      <div key={raceType.id} className="flex gap-2 items-center">
                        <Label className="w-40">{raceType.name}:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={raceTypeFee?.fee || 0}
                          onChange={(e) => {
                            const newRaceTypes = [...formData.raceTypes];
                            const existingIndex = newRaceTypes.findIndex(
                              (rt) => rt.raceTypeId === raceType.id
                            );
                            if (existingIndex >= 0) {
                              newRaceTypes[existingIndex].fee =
                                parseFloat(e.target.value) || 0;
                            } else {
                              newRaceTypes.push({
                                raceTypeId: raceType.id,
                                fee: parseFloat(e.target.value) || 0,
                              });
                            }
                            setFormData({ ...formData, raceTypes: newRaceTypes });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
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
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
