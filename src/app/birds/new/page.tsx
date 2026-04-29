"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowLeft, Trash2, Save, Plus } from "lucide-react";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/useApiMutation";
import { apiEndpoints } from "@/lib/endpoints";
import { FEDERATIONS, COLORS, SEX_LABELS } from "@/lib/bird-constants";
import { ImageCapture } from "@/components/image-capture";

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
  imageUrl: string | null;
  imageFile: File | null;
}

export default function AddBirdPage() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [federation, setFederation] = useState("AU");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [letters, setLetters] = useState("");
  const [bandNumber, setBandNumber] = useState("");
  const [color, setColor] = useState("BB");
  const [sex, setSex] = useState("1");
  const [rfid, setRfid] = useState("");
  const [note, setNote] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Staged birds
  const [stagedBirds, setStagedBirds] = useState<StagedBird[]>([]);

  const createMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.birds,
    method: "POST",
    queryKey: ["breeder", "birds"],
    onSuccess: () => {
      toast.success("Bird added");
      router.push("/birds");
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

  const bulkMutation = useApiMutation({
    endpoint: apiEndpoints.breeder.birdsBulk,
    method: "POST",
    queryKey: ["breeder", "birds"],
  });

  const validateForm = () => {
    if (!name.trim() || !letters.trim() || !bandNumber.trim()) {
      toast.error("Fill in all required fields");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    await createMutation.mutateAsync({
      name: name.trim(),
      band1: federation,
      band2: year,
      band3: letters.toUpperCase(),
      band4: bandNumber,
      color,
      sex: parseInt(sex),
      ...(rfid.trim() ? { rfid: rfid.trim() } : {}),
    });
  };

  const handleSaveAndNew = () => {
    if (!validateForm()) return;

    const bandKey = `${federation}-${year}-${letters.toUpperCase()}-${bandNumber}`;
    if (stagedBirds.some((b) => `${b.band1}-${b.band2}-${b.band3}-${b.band4}` === bandKey)) {
      toast.error("Band already staged");
      return;
    }

    setStagedBirds((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        name: name.trim(),
        band1: federation,
        band2: year,
        band3: letters.toUpperCase(),
        band4: bandNumber,
        color,
        sex: parseInt(sex),
        rfid: rfid.trim(),
        imageUrl,
        imageFile,
      },
    ]);

    // Reset form, keep federation + year, increment band number
    setName("");
    setLetters("");
    setColor("BB");
    setSex("1");
    setRfid("");
    setNote("");
    setImageUrl(null);
    setImageFile(null);
    const parsed = parseInt(bandNumber);
    setBandNumber(isNaN(parsed) ? "" : String(parsed + 1));
  };

  const handleCreateAll = async () => {
    try {
      const result = await bulkMutation.mutateAsync({
        birds: stagedBirds.map((b) => ({
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
        setStagedBirds((prev) =>
          prev.filter((b) => failedBands.has(`${b.band1}-${b.band2}-${b.band3}-${b.band4}`))
        );
        toast.error(`${data.errors.length} bird(s) failed`);
      }
      if (data.created > 0) {
        toast.success(`${data.created} bird(s) created`);
      }
      if (!data.errors?.length) {
        router.push("/birds");
      }
    } catch {
      toast.error("Failed to create birds");
    }
  };

  const removeStagedBird = (tempId: string) => {
    setStagedBirds((prev) => prev.filter((b) => b.tempId !== tempId));
  };

  const bandPreview = [federation, year, letters.toUpperCase(), bandNumber]
    .filter(Boolean)
    .join("-");

  const isPending = createMutation.isPending;
  const hasStaged = stagedBirds.length > 0;

  return (
    <div className="container mx-auto p-6">
      <Button variant="ghost" onClick={() => router.push("/birds")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to My Birds
      </Button>

      <h1 className="text-2xl font-bold mb-6">
        {hasStaged ? `Add Birds (${stagedBirds.length} staged)` : "Add Bird"}
      </h1>

      {/* 2-column hero */}
      <div className="grid grid-cols-1 md:grid-cols-[3fr_6fr] gap-6">
        {/* Left: Image + band preview */}
        <div className="space-y-3">
          <ImageCapture
            value={imageUrl}
            onChange={(url, file) => {
              setImageUrl(url);
              setImageFile(file ?? null);
            }}
          />
          <div className="flex flex-row">
            <div className="w-full">
              <p className="text-xs text-muted-foreground">Name of the Pigeon</p>
              <h2 className="text-xl font-bold text-muted-foreground">
                {bandPreview || "XX-XXXX-XXX-XXXXX"}
              </h2>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
            </div>
          </div>
        </div>

        {/* Right: stacked rows — details on top, band info + actions on bottom */}
        <div className="space-y-6">
          {/* Top row: Form fields */}
          <Card>
            <CardContent className="space-y-4">
              <h3 className="font-semibold text-lg">Bird Information</h3>
              <div className="grid grid-cols-[3fr_1fr_1fr] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="birdName">Bird Name *</Label>
                  <Input
                    id="birdName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter bird name"
                  />
                </div>
                <div className="space-y-2 w-full">
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
                <div className="space-y-2 w-full">
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
              </div>


              <div className="space-y-2">
                <Label htmlFor="note">Description</Label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full text-sm border rounded-md p-2 min-h-[60px] resize-y"
                  placeholder="Description..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rfid">RFID</Label>
                <Input
                  id="rfid"
                  value={rfid}
                  onChange={(e) => setRfid(e.target.value)}
                  placeholder="RFID tag (optional)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bottom row: Band info + actions */}
          <Card>
            <CardContent className="space-y-4">
              <h3 className="font-semibold text-lg">Band Information</h3>
              <div className="grid grid-cols-4 gap-3">
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
              </div>
            </CardContent>
          </Card>
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {isPending ? "Saving..." : "Add Bird"}
            </Button>
            <Button variant="secondary" onClick={handleSaveAndNew} className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              New Bird
            </Button>
            <Button variant="outline" onClick={() => router.push("/birds")} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Staged birds table — below the hero, where charts would be */}
      {hasStaged && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Staged Birds ({stagedBirds.length})</h3>
              <Button onClick={handleCreateAll} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? "Creating..." : "Create All"}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Band</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>RFID</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagedBirds.map((b, i) => (
                  <TableRow key={b.tempId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {b.band1}-{b.band2}-{b.band3}-{b.band4}
                    </TableCell>
                    <TableCell><Badge variant="outline">{b.color}</Badge></TableCell>
                    <TableCell>{SEX_LABELS[b.sex] || "Unknown"}</TableCell>
                    <TableCell className="text-xs">{b.rfid || "-"}</TableCell>
                    <TableCell>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
