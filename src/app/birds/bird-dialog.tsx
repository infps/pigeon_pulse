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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { FEDERATIONS, COLORS, SEX_LABELS } from "@/lib/bird-constants";

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

interface StagedBird {
  tempId: string;
  name: string;
  band1: string;
  band2: string;
  band3: string;
  band4: string;
  color: string;
  sex: number;
  rfid: string;
}

interface BirdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bird?: Bird | null;
  onSuccess: (createdBird?: Bird) => void;
}

export function BirdDialog({ open, onOpenChange, bird, onSuccess }: BirdDialogProps) {
  const [name, setName] = useState("");
  const [federation, setFederation] = useState("AU");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [letters, setLetters] = useState("");
  const [bandNumber, setBandNumber] = useState("");
  const [color, setColor] = useState("BB");
  const [sex, setSex] = useState("1");
  const [rfid, setRfid] = useState("");
  const [stagedBirds, setStagedBirds] = useState<StagedBird[]>([]);

  const isEdit = !!bird;

  const createMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.birds,
    method: "POST",
    queryKey: ["breeder", "birds"],
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

  const bulkMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.birdsBulk,
    method: "POST",
    queryKey: ["breeder", "birds"],
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
      setRfid("");
    } else {
      setName("");
      setFederation("AU");
      setYear(new Date().getFullYear().toString());
      setLetters("");
      setBandNumber("");
      setColor("BB");
      setSex("1");
      setRfid("");
    }
    if (!open) {
      setStagedBirds([]);
    }
  }, [bird, open]);

  const validateForm = () => {
    if (!name.trim() || !letters.trim() || !bandNumber.trim()) {
      toast.error("Fill in all required fields");
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    name: name.trim(),
    band1: federation,
    band2: year,
    band3: letters.toUpperCase(),
    band4: bandNumber,
    color,
    sex: parseInt(sex),
    ...(rfid.trim() ? { rfid: rfid.trim() } : {}),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = buildPayload();

    if (isEdit) {
      await updateMutation.mutateAsync(payload);
    } else {
      const result = await createMutation.mutateAsync(payload);
      const createdBird = (result as any)?.data?.bird as Bird | undefined;
      toast.success("Bird added");
      onSuccess(createdBird);
      onOpenChange(false);
    }
  };

  const handleSaveAndNew = () => {
    if (!validateForm()) return;

    const bandKey = `${federation}-${year}-${letters.toUpperCase()}-${bandNumber}`;
    if (stagedBirds.some(b => `${b.band1}-${b.band2}-${b.band3}-${b.band4}` === bandKey)) {
      toast.error("Band already staged");
      return;
    }

    setStagedBirds(prev => [...prev, {
      tempId: crypto.randomUUID(),
      name: name.trim(),
      band1: federation,
      band2: year,
      band3: letters.toUpperCase(),
      band4: bandNumber,
      color,
      sex: parseInt(sex),
      rfid: rfid.trim(),
    }]);

    // Reset: clear name, letters, color, sex, rfid. Keep federation + year. Increment band number.
    setName("");
    setLetters("");
    setColor("BB");
    setSex("1");
    setRfid("");
    const parsed = parseInt(bandNumber);
    setBandNumber(isNaN(parsed) ? "" : String(parsed + 1));
  };

  const handleCreateAll = async () => {
    try {
      const result = await bulkMutation.mutateAsync({
        birds: stagedBirds.map(b => ({
          name: b.name,
          band1: b.band1,
          band2: b.band2,
          band3: b.band3,
          band4: b.band4,
          color: b.color,
          sex: b.sex,
          ...(b.rfid ? { rfid: b.rfid } : {}),
        })),
      });

      const data = (result as any)?.data;
      if (data.errors?.length > 0) {
        const failedBands = new Set(data.errors.map((e: any) => e.band));
        setStagedBirds(prev => prev.filter(b =>
          failedBands.has(`${b.band1}-${b.band2}-${b.band3}-${b.band4}`)
        ));
        toast.error(`${data.errors.length} bird(s) failed`);
      }
      if (data.created > 0) {
        toast.success(`${data.created} bird(s) created`);
        (data.birds || []).forEach((b: Bird) => onSuccess(b));
      }
      if (!data.errors?.length) {
        setStagedBirds([]);
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to create birds");
    }
  };

  const removeStagedBird = (tempId: string) => {
    setStagedBirds(prev => prev.filter(b => b.tempId !== tempId));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const hasStaged = stagedBirds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Bird" : hasStaged ? `Add Birds (${stagedBirds.length} staged)` : "Add Bird"}
          </DialogTitle>
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

            {/* Band fields: 6x1 grid */}
            <div className="grid grid-cols-6 gap-3">
              <div className="space-y-2">
                <Label>Federation *</Label>
                <Select value={federation} onValueChange={setFederation}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                  onChange={(e) => setLetters(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="ABCD"
                  maxLength={4}
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
              <div className="space-y-2">
                <Label>Color *</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Unknown</SelectItem>
                    <SelectItem value="1">Cock</SelectItem>
                    <SelectItem value="2">Hen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
{/* 
            <div className="space-y-2">
              <Label htmlFor="rfid">RFID</Label>
              <Input
                id="rfid"
                value={rfid}
                onChange={(e) => setRfid(e.target.value)}
                placeholder="RFID tag (optional)"
              />
            </div> */}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!isEdit && (
              <Button type="button" variant="secondary" onClick={handleSaveAndNew}>
                Save & New
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Update" : "Add Bird"}
            </Button>
          </DialogFooter>
        </form>

        {/* Staged birds table */}
        {hasStaged && !isEdit && (
          <div className="border-t pt-4 mt-2">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold">Staged ({stagedBirds.length})</h4>
              <Button
                size="sm"
                onClick={handleCreateAll}
                disabled={bulkMutation.isPending}
              >
                {bulkMutation.isPending ? "Creating..." : "Create All"}
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Sex</TableHead>
                    <TableHead>RFID</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagedBirds.map(b => (
                    <TableRow key={b.tempId}>
                      <TableCell className="py-1">{b.name}</TableCell>
                      <TableCell className="py-1 text-xs">
                        {b.band1}-{b.band2}-{b.band3}-{b.band4}
                      </TableCell>
                      <TableCell className="py-1">{b.color}</TableCell>
                      <TableCell className="py-1">{SEX_LABELS[b.sex] || "Unknown"}</TableCell>
                      <TableCell className="py-1 text-xs">{b.rfid || "-"}</TableCell>
                      <TableCell className="py-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeStagedBird(b.tempId)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
