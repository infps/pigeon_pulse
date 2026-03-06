"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useCreateBettingScheme,
  useDeleteBettingScheme,
  useListBettingSchemes,
  useUpdateBettingScheme,
} from "@/lib/api/betting-schemes";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import type { BettingScheme } from "@/lib/types";

export default function BettingSchemeComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    bettingCutPercent: 0,
    belgianShow1: 0,
    belgianShow2: 0,
    belgianShow3: 0,
    belgianShow4: 0,
    belgianShow5: 0,
    belgianShow6: 0,
    belgianShow7: 0,
    standardShow1: 0,
    standardShow2: 0,
    standardShow3: 0,
    standardShow4: 0,
    standardShow5: 0,
    standardShow6: 0,
    wta1: 0,
    wta2: 0,
    wta3: 0,
    wta4: 0,
    wta5: 0,
    standardShowPercentages: [] as { place: number; percValue: number }[],
  });

  const { data: bettingSchemesData, isPending, isError } = useListBettingSchemes({});
  const bettingSchemes: BettingScheme[] = bettingSchemesData?.bettingSchemes || [];

  const createMutation = useCreateBettingScheme({});
  const updateMutation = useUpdateBettingScheme({});
  const deleteMutation = useDeleteBettingScheme({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Betting scheme name is required");
      return;
    }

    try {
      if (editingId) {
        if (!updateMutation.mutateAsync) return;
        await updateMutation.mutateAsync({ id: editingId, ...formData });
        toast.success("Betting scheme updated successfully");
      } else {
        if (!createMutation.mutateAsync) return;
        await createMutation.mutateAsync(formData);
        toast.success("Betting scheme created successfully");
      }
      handleClose();
    } catch (error) {
      toast.error(
        editingId ? "Failed to update betting scheme" : "Failed to create betting scheme"
      );
    }
  };

  const handleEdit = (bettingScheme: BettingScheme) => {
    setEditingId(bettingScheme.bettingSchemeId);
    setFormData({
      name: bettingScheme.name,
      description: bettingScheme.description || "",
      bettingCutPercent: bettingScheme.bettingCutPercent,
      belgianShow1: bettingScheme.belgianShow1,
      belgianShow2: bettingScheme.belgianShow2,
      belgianShow3: bettingScheme.belgianShow3,
      belgianShow4: bettingScheme.belgianShow4,
      belgianShow5: bettingScheme.belgianShow5,
      belgianShow6: bettingScheme.belgianShow6,
      belgianShow7: bettingScheme.belgianShow7,
      standardShow1: bettingScheme.standardShow1,
      standardShow2: bettingScheme.standardShow2,
      standardShow3: bettingScheme.standardShow3,
      standardShow4: bettingScheme.standardShow4,
      standardShow5: bettingScheme.standardShow5,
      standardShow6: bettingScheme.standardShow6 ?? 0,
      wta1: bettingScheme.wta1,
      wta2: bettingScheme.wta2,
      wta3: bettingScheme.wta3,
      wta4: bettingScheme.wta4,
      wta5: bettingScheme.wta5,
      standardShowPercentages: bettingScheme.standardShowPercentages?.map((p) => ({
        place: p.place,
        percValue: p.percValue,
      })) || [],
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this betting scheme?")) return;

    try {
      if (!deleteMutation.mutateAsync) return;
      await deleteMutation.mutateAsync({ id });
      toast.success("Betting scheme deleted successfully");
    } catch (error) {
      toast.error("Failed to delete betting scheme");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      bettingCutPercent: 0,
      belgianShow1: 0,
      belgianShow2: 0,
      belgianShow3: 0,
      belgianShow4: 0,
      belgianShow5: 0,
      belgianShow6: 0,
      belgianShow7: 0,
      standardShow1: 0,
      standardShow2: 0,
      standardShow3: 0,
      standardShow4: 0,
      standardShow5: 0,
      standardShow6: 0,
      wta1: 0,
      wta2: 0,
      wta3: 0,
      wta4: 0,
      wta5: 0,
      standardShowPercentages: [],
    });
  };

  const addPercentage = () => {
    setFormData({
      ...formData,
      standardShowPercentages: [
        ...formData.standardShowPercentages,
        { place: 1, percValue: 0 },
      ],
    });
  };

  const removePercentage = (index: number) => {
    setFormData({
      ...formData,
      standardShowPercentages: formData.standardShowPercentages.filter(
        (_, i) => i !== index
      ),
    });
  };

  const updatePercentage = (
    index: number,
    field: "place" | "percValue",
    value: number
  ) => {
    const updated = [...formData.standardShowPercentages];
    updated[index][field] = value;
    setFormData({ ...formData, standardShowPercentages: updated });
  };

  if (isPending) {
    return <Skeleton className="h-100 w-full" />;
  }

  if (isError) {
    return <div className="text-red-500">Error loading betting schemes</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Betting Schemes</h2>
        <Button onClick={() => setIsOpen(true)}>Add Betting Scheme</Button>
      </div>

      <div className="space-y-2">
        {bettingSchemes.map((scheme) => (
          <div
            key={scheme.bettingSchemeId}
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
                onClick={() => handleDelete(scheme.bettingSchemeId)}
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
              {editingId ? "Edit Betting Scheme" : "Add Betting Scheme"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
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

            {/* Belgian Show */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Belgian Show</h3>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <div key={num}>
                    <Label htmlFor={`belgianShow${num}`}>Show {num}</Label>
                    <div className="relative">
                      <Input
                        id={`belgianShow${num}`}
                        type="text"
                        value={(formData as any)[`belgianShow${num}`]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [`belgianShow${num}`]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Standard Show - 2 column layout */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Standard Show</h3>
              <div className="grid grid-cols-2 gap-8">
                {/* Left: Standard Show values */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <div key={num}>
                        <Label htmlFor={`standardShow${num}`}>Show {num}</Label>
                        <div className="relative">
                          <Input
                            id={`standardShow${num}`}
                            type="text"
                            value={(formData as any)[`standardShow${num}`]}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [`standardShow${num}`]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                            %
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Position Percentages */}
                <div className="space-y-4">
                  <h4 className="font-medium">Position Percentages</h4>
                  <div className="space-y-2">
                    {formData.standardShowPercentages.map((item, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <div className="flex-1">
                          <Input
                            type="text"
                            placeholder="Place"
                            value={item.place}
                            onChange={(e) =>
                              updatePercentage(
                                index,
                                "place",
                                parseInt(e.target.value) || 1
                              )
                            }
                          />
                        </div>
                        <div className="flex-1">
                          <div className="relative">
                            <Input
                              type="text"
                              placeholder="Percentage"
                              value={item.percValue}
                              onChange={(e) =>
                                updatePercentage(
                                  index,
                                  "percValue",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                              %
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removePercentage(index)}
                        >
                          &times;
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addPercentage}
                    className="w-full"
                  >
                    Add Position
                  </Button>
                </div>
              </div>
            </div>

            {/* WTA */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">WTA (Winner Takes All)</h3>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num}>
                    <Label htmlFor={`wta${num}`}>WTA {num}</Label>
                    <div className="relative">
                      <Input
                        id={`wta${num}`}
                        type="text"
                        value={(formData as any)[`wta${num}`]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [`wta${num}`]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Percent for Expenses (moved to bottom like reference) */}
            <div>
              <Label htmlFor="bettingCutPercent">Percent for Expenses</Label>
              <div className="relative max-w-md">
                <Input
                  id="bettingCutPercent"
                  type="text"
                  value={formData.bettingCutPercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bettingCutPercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  %
                </span>
              </div>
            </div>

            <div className="flex gap-4 justify-end">
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
