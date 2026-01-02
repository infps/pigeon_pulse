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
    wta1: 0,
    wta2: 0,
    wta3: 0,
    wta4: 0,
    wta5: 0,
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
      wta1: bettingScheme.wta1,
      wta2: bettingScheme.wta2,
      wta3: bettingScheme.wta3,
      wta4: bettingScheme.wta4,
      wta5: bettingScheme.wta5,
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
      wta1: 0,
      wta2: 0,
      wta3: 0,
      wta4: 0,
      wta5: 0,
    });
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
                onClick={() => handleDelete(scheme.bettingSchemeId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Betting Scheme" : "Add Betting Scheme"}
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

            <div>
              <Label htmlFor="bettingCutPercent">Betting Cut Percent</Label>
              <Input
                id="bettingCutPercent"
                type="number"
                step="0.01"
                value={formData.bettingCutPercent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bettingCutPercent: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <Label className="text-lg font-semibold">Belgian Show</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <div key={num}>
                    <Label htmlFor={`belgianShow${num}`}>Belgian Show {num}</Label>
                    <Input
                      id={`belgianShow${num}`}
                      type="number"
                      step="0.01"
                      value={(formData as any)[`belgianShow${num}`]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [`belgianShow${num}`]: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-lg font-semibold">Standard Show</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num}>
                    <Label htmlFor={`standardShow${num}`}>Standard Show {num}</Label>
                    <Input
                      id={`standardShow${num}`}
                      type="number"
                      step="0.01"
                      value={(formData as any)[`standardShow${num}`]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [`standardShow${num}`]: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-lg font-semibold">WTA</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div key={num}>
                    <Label htmlFor={`wta${num}`}>WTA {num}</Label>
                    <Input
                      id={`wta${num}`}
                      type="number"
                      step="0.01"
                      value={(formData as any)[`wta${num}`]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [`wta${num}`]: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

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
