"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { FEDERATIONS, COLORS } from "@/lib/bird-constants";

interface Bird {
  id: number;
  band: string;
  band1?: string;
  band2?: string;
  band3?: string;
  band4?: string;
  birdName: string;
  color: string;
  sex: number;
}

interface BirdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bird?: Bird | null;
  onSuccess: () => void;
}

export function BirdDialog({ open, onOpenChange, bird, onSuccess }: BirdDialogProps) {
  const [name, setName] = useState("");
  const [federation, setFederation] = useState("AU");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [letters, setLetters] = useState("");
  const [bandNumber, setBandNumber] = useState("");
  const [color, setColor] = useState("BB");
  const [sex, setSex] = useState("1");

  const isEdit = !!bird;

  const createMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.birds,
    method: "POST",
    queryKey: ["breeder", "birds"],
    onSuccess: () => {
      toast.success("Bird added");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      const msg = error?.message || "";
      if (msg.includes("409") || msg.includes("unique") || msg.includes("P2002")) {
        toast.error("Band already exists");
      } else {
        toast.error("Failed to add bird");
      }
    },
  });

  const updateMutation = useApiMutation({
    endpoint: bird ? apiEndpoints.breeder.birdById(bird.id) : "",
    method: "PATCH",
    queryKey: ["breeder", "birds"],
    onSuccess: () => {
      toast.success("Bird updated");
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update bird"),
  });

  useEffect(() => {
    if (bird) {
      setName(bird.birdName || "");
      setFederation(bird.band1 || "AU");
      setYear(bird.band2 || new Date().getFullYear().toString());
      setLetters(bird.band3 || "");
      setBandNumber(bird.band4 || "");
      setColor(bird.color || "BB");
      setSex(String(bird.sex ?? 1));
    } else {
      setName("");
      setFederation("AU");
      setYear(new Date().getFullYear().toString());
      setLetters("");
      setBandNumber("");
      setColor("BB");
      setSex("1");
    }
  }, [bird, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !letters.trim() || !bandNumber.trim()) {
      toast.error("Fill in all required fields");
      return;
    }

    const payload = {
      name: name.trim(),
      band1: federation,
      band2: year,
      band3: letters.toUpperCase(),
      band4: bandNumber,
      color,
      sex: parseInt(sex),
    };

    if (isEdit) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Bird" : "Add Bird"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="birdName">Bird Name *</Label>
              <Input
                id="birdName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter bird name"
                required
              />
            </div>

            {/* Band fields: 2x2 grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Federation *</Label>
                <Select value={federation} onValueChange={setFederation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEDERATIONS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="letters">Letters *</Label>
                <Input
                  id="letters"
                  value={letters}
                  onChange={(e) => setLetters(e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="ABC"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bandNumber">Band Number *</Label>
                <Input
                  id="bandNumber"
                  value={bandNumber}
                  onChange={(e) => setBandNumber(e.target.value)}
                  placeholder="12345"
                />
              </div>
            </div>

            {/* Color + Sex */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Color *</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLORS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sex *</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Unknown</SelectItem>
                    <SelectItem value="1">Cock</SelectItem>
                    <SelectItem value="2">Hen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Update" : "Add Bird"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
