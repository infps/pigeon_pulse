"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
import type { FeeScheme, RaceType } from "@/lib/types";

export default function FeeSchemeComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    entryFee: 0,
    isRefundable: false,
    maxBirdCount: 0,
    feesCutPercent: 0,
    minEntryFees: 0,
    maxBackupBirdCount: 0,
    isFloatingBackup: false,
    hotSpot1Fee: 0,
    hotSpot2Fee: 0,
    hotSpot3Fee: 0,
    hotSpotFinalFee: 0,
    raceFeeMode: "PER_BIRD_PER_RACE" as "PER_BIRD_PER_RACE" | "FLAT_PER_RACE",
    birdFeeItems: [] as { birdNo: number; birdFee: number }[],
    raceTypeFees: [] as { raceTypeId: number; fee: number }[],
  });

  const { data: feeSchemesData, isPending, isError } = useListFeeSchemes({});
  const { data: raceTypesData } = useListRaceTypes({});
  const feeSchemes: FeeScheme[] = feeSchemesData?.feeSchemes || [];
  const raceTypes: RaceType[] = raceTypesData?.raceTypes || [];

  const createMutation = useCreateFeeScheme({});
  const updateMutation = useUpdateFeeScheme({});
  const deleteMutation = useDeleteFeeScheme({});

  // Update perch fee items when maxBirdCount changes
  useEffect(() => {
    const newPerchFeeItems = Array.from({ length: formData.maxBirdCount }, (_, i) => {
      const existing = formData.birdFeeItems[i];
      return existing || { birdNo: i + 1, birdFee: 0 };
    });
    setFormData((prev) => ({ ...prev, birdFeeItems: newPerchFeeItems }));
  }, [formData.maxBirdCount]);

  // Initialize race type fees when dialog opens
  useEffect(() => {
    if (isOpen && !editingId && raceTypes.length > 0) {
      const initialRaceTypeFees = raceTypes.map((rt) => ({
        raceTypeId: rt.id,
        fee: 0,
      }));
      setFormData((prev) => ({ ...prev, raceTypeFees: initialRaceTypeFees }));
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
    setEditingId(String(feeScheme.id));
    setFormData({
      name: feeScheme.name || "",
      description: "",
      entryFee: feeScheme.entryFee ?? 0,
      isRefundable: !!feeScheme.isRefundable,
      maxBirdCount: feeScheme.maxBirdCount ?? 0,
      feesCutPercent: feeScheme.feesCutPercent ?? 0,
      minEntryFees: feeScheme.minEntryFees ?? 0,
      maxBackupBirdCount: feeScheme.maxBackupBirdCount ?? 0,
      isFloatingBackup: !!feeScheme.isFloatingBackup,
      hotSpot1Fee: feeScheme.hotSpot1Fee ?? 0,
      hotSpot2Fee: feeScheme.hotSpot2Fee ?? 0,
      hotSpot3Fee: feeScheme.hotSpot3Fee ?? 0,
      hotSpotFinalFee: feeScheme.hotSpotFinalFee ?? 0,
      raceFeeMode: feeScheme.raceFeeMode ?? "PER_BIRD_PER_RACE",
      birdFeeItems: (feeScheme.birdFeeItems || []).map((item) => ({
        birdNo: item.birdNo ?? 0,
        birdFee: item.birdFee ?? 0,
      })),
      raceTypeFees: (feeScheme.raceTypeFees || []).map((rt) => ({
        raceTypeId: rt.raceTypeId,
        fee: rt.fee,
      })),
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
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
      entryFee: 0,
      isRefundable: false,
      maxBirdCount: 0,
      feesCutPercent: 0,
      minEntryFees: 0,
      maxBackupBirdCount: 0,
      isFloatingBackup: false,
      hotSpot1Fee: 0,
      hotSpot2Fee: 0,
      hotSpot3Fee: 0,
      hotSpotFinalFee: 0,
      raceFeeMode: "PER_BIRD_PER_RACE",
      birdFeeItems: [],
      raceTypeFees: [],
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
                onClick={() => handleDelete(scheme.id)}
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
              {editingId ? "Edit Fee Scheme" : "Add Fee Scheme"}
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

            {/* Entry Fee + Fees Cut Percent */}
            <div className="flex items-center space-x-4">
              <div className="w-full">
                <Label htmlFor="entryFee">Entry Fee</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    id="entryFee"
                    type="text"
                    value={formData.entryFee}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        entryFee: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="w-full">
                <Label htmlFor="feesCutPercent">Fees Cut Percent</Label>
                <div className="relative">
                  <Input
                    id="feesCutPercent"
                    type="text"
                    value={formData.feesCutPercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        feesCutPercent: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Min Entry Fees + Is Refundable */}
            <div className="flex space-x-4">
              <div className="w-full">
                <Label htmlFor="minEntryFees">Min entry fees per team</Label>
                <Input
                  id="minEntryFees"
                  type="text"
                  value={formData.minEntryFees}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minEntryFees: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="flex flex-row space-x-3 w-full space-y-0 p-2 self-end items-center">
                <Checkbox
                  id="isRefundable"
                  checked={formData.isRefundable}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isRefundable: checked === true })
                  }
                />
                <Label htmlFor="isRefundable" className="cursor-pointer">
                  Allow entry fee refund when bird is lost
                </Label>
              </div>
            </div>

            {/* Hot Spot Fees */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { key: "hotSpot1Fee", label: "Hot Spot 1" },
                { key: "hotSpot2Fee", label: "Hot Spot 2" },
                { key: "hotSpot3Fee", label: "Hot Spot 3" },
                { key: "hotSpotFinalFee", label: "Hot Spot Final" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <Input
                      id={key}
                      type="text"
                      value={(formData as any)[key]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [key]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pl-8"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Max Birds + Max Backup Birds */}
            <div className="flex space-x-4">
              <div className="w-full">
                <Label htmlFor="maxBirdCount">Maximum number of birds</Label>
                <Input
                  id="maxBirdCount"
                  type="text"
                  value={formData.maxBirdCount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxBirdCount: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="w-full">
                <Label htmlFor="maxBackupBirdCount">Maximum number of backup birds</Label>
                <Input
                  id="maxBackupBirdCount"
                  type="text"
                  value={formData.maxBackupBirdCount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxBackupBirdCount: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Per Bird Fees */}
            {formData.maxBirdCount > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Per Bird Fees</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {formData.birdFeeItems.map((item, index) => (
                    <div key={index}>
                      <Label>Bird {item.birdNo} - Per Bird Fee</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          $
                        </span>
                        <Input
                          type="text"
                          value={item.birdFee}
                          onChange={(e) => {
                            const newItems = [...formData.birdFeeItems];
                            newItems[index].birdFee = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, birdFeeItems: newItems });
                          }}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Floating Backup */}
            <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <Checkbox
                id="isFloatingBackup"
                checked={formData.isFloatingBackup}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isFloatingBackup: checked === true })
                }
              />
              <Label htmlFor="isFloatingBackup" className="cursor-pointer">
                Floating Backup
              </Label>
            </div>

            {/* Race Fee Mode */}
            <div>
              <Label>Race Fee Mode</Label>
              <Select
                value={formData.raceFeeMode}
                onValueChange={(value: "PER_BIRD_PER_RACE" | "FLAT_PER_RACE") =>
                  setFormData({ ...formData, raceFeeMode: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_BIRD_PER_RACE">Per Bird Per Race</SelectItem>
                  <SelectItem value="FLAT_PER_RACE">Flat Per Race</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Race Type Fees */}
            {raceTypes.length > 0 && (
              <div className="space-y-3">
                <Label>Race Type Fees</Label>
                <div className="grid grid-cols-2 gap-4">
                  {raceTypes.map((raceType) => {
                    const raceTypeFee = formData.raceTypeFees.find(
                      (rt) => rt.raceTypeId === raceType.id
                    );
                    return (
                      <div key={raceType.id}>
                        <Label>{raceType.name}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <Input
                            type="text"
                            value={raceTypeFee?.fee || 0}
                            onChange={(e) => {
                              const newRaceTypeFees = [...formData.raceTypeFees];
                              const existingIndex = newRaceTypeFees.findIndex(
                                (rt) => rt.raceTypeId === raceType.id
                              );
                              if (existingIndex >= 0) {
                                newRaceTypeFees[existingIndex].fee =
                                  parseFloat(e.target.value) || 0;
                              } else {
                                newRaceTypeFees.push({
                                  raceTypeId: raceType.id,
                                  fee: parseFloat(e.target.value) || 0,
                                });
                              }
                              setFormData({ ...formData, raceTypeFees: newRaceTypeFees });
                            }}
                            className="pl-8"
                          />
                        </div>
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
