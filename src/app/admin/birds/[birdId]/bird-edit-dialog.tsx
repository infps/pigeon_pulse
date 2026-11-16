"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useDialogHotkeys } from "@/lib/use-dialog-hotkeys";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUpdateBird } from "@/lib/api/bird";
import { COLORS, FEDERATIONS } from "@/lib/bird-constants";
import { apiEndpoints } from "@/lib/endpoints";
import type { Bird } from "@/lib/types";
import type { BirdHealthStatus } from "./bird-health-card";

/** Parent band input -> bird id. undefined = unchanged, null = cleared. Throws if not found. */
export async function resolveParentId(band: string, initial: string): Promise<number | null | undefined> {
  const v = band.trim();
  if (v === initial) return undefined;
  if (!v) return null;
  const res = await fetch(`/api/birds/lookup?band=${encodeURIComponent(v)}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Parent bird ${v} not found`);
  return (await res.json()).birdId as number;
}

interface Props {
  bird: Bird;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function BirdEditDialog({ bird, open, onOpenChange, onSaved }: Props) {
  const [band1, setBand1] = useState(bird.band1 ?? "");
  const [band2, setBand2] = useState(bird.band2 ?? "");
  const [band3, setBand3] = useState(bird.band3 ?? "");
  const [band4, setBand4] = useState(bird.band4 ?? "");
  const [codeMasked, setCodeMasked] = useState(bird.codeMasked ?? "");
  const [color, setColor] = useState(bird.color ?? "");
  const [sex, setSex] = useState(String(bird.sex ?? 0));
  const [birdName, setBirdName] = useState(bird.birdName ?? "");
  const [rfid, setRfid] = useState(bird.rfid ?? "");
  const [isActive, setIsActive] = useState(bird.isActive === 1);
  const [isLost, setIsLost] = useState(bird.isLost === 1);
  const [lostDate, setLostDate] = useState(
    bird.lostDate ? bird.lostDate.slice(0, 10) : ""
  );
  const [lostRaceId, setLostRaceId] = useState(
    bird.lostRaceId != null ? String(bird.lostRaceId) : ""
  );
  const [note, setNote] = useState(bird.note ?? "");
  const [isPublic, setIsPublic] = useState(bird.isPublic === 1);
  const [attention, setAttention] = useState(!!bird.attention);
  const [healthStatus, setHealthStatus] = useState<BirdHealthStatus>(bird.healthStatus ?? "HEALTHY");
  const [healthNote, setHealthNote] = useState(bird.healthNote ?? "");
  const [fatherBand, setFatherBand] = useState(bird.father?.band ?? "");
  const [motherBand, setMotherBand] = useState(bird.mother?.band ?? "");

  useEffect(() => {
    if (!open) return;
    setBand1(bird.band1 ?? "");
    setBand2(bird.band2 ?? "");
    setBand3(bird.band3 ?? "");
    setBand4(bird.band4 ?? "");
    setCodeMasked(bird.codeMasked ?? "");
    setColor(bird.color ?? "");
    setSex(String(bird.sex ?? 0));
    setBirdName(bird.birdName ?? "");
    setRfid(bird.rfid ?? "");
    setIsActive(bird.isActive === 1);
    setIsLost(bird.isLost === 1);
    setLostDate(bird.lostDate ? bird.lostDate.slice(0, 10) : "");
    setLostRaceId(bird.lostRaceId != null ? String(bird.lostRaceId) : "");
    setNote(bird.note ?? "");
    setIsPublic(bird.isPublic === 1);
    setAttention(!!bird.attention);
    setHealthStatus(bird.healthStatus ?? "HEALTHY");
    setHealthNote(bird.healthNote ?? "");
    setFatherBand(bird.father?.band ?? "");
    setMotherBand(bird.mother?.band ?? "");
  }, [bird, open]);

  const updateMutation = useUpdateBird(bird.id);

  const handleSave = async () => {
    try {
      const fatherId = await resolveParentId(fatherBand, bird.father?.band ?? "");
      const motherId = await resolveParentId(motherBand, bird.mother?.band ?? "");
      await updateMutation.mutateAsync({
        fatherId,
        motherId,
        band1,
        band2,
        band3: band3.toUpperCase(),
        band4,
        codeMasked: codeMasked || null,
        birdName: birdName || null,
        color: color || null,
        sex: parseInt(sex),
        rfid: rfid || null,
        isActive: isActive ? 1 : 0,
        isLost: isLost ? 1 : 0,
        lostDate: isLost && lostDate ? lostDate : null,
        lostRaceId: lostRaceId ? parseInt(lostRaceId) : null,
        note: note || null,
        isPublic: isPublic ? 1 : 0,
        attention,
      });
      // Health goes through its own route so the change is logged to event history.
      if (healthStatus !== (bird.healthStatus ?? "HEALTHY") || healthNote !== (bird.healthNote ?? "")) {
        const res = await fetch(apiEndpoints.admin.birds.health(bird.id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ healthStatus, healthNote: healthNote || undefined }),
        });
        if (!res.ok) throw new Error("Failed to update health");
      }
      toast.success("Bird updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to update bird");
    }
  };

  useDialogHotkeys({
    open,
    onSave: handleSave,
    onClose: () => onOpenChange(false),
    disabled: updateMutation.isPending,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bird</DialogTitle>
        </DialogHeader>

        {/* Same columns and boxes as the bird popup, so each field sits where it is displayed. */}
        <div className="grid gap-4 md:grid-cols-3">
          <Section title="Band">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Asc</Label>
                <Select value={band1} onValueChange={setBand1}>
                  <SelectTrigger><SelectValue placeholder="Federation" /></SelectTrigger>
                  <SelectContent>
                    {FEDERATIONS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Year</Label>
                <Input value={band2} onChange={(e) => setBand2(e.target.value)} placeholder="2025" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Letter</Label>
                <Input value={band3} onChange={(e) => setBand3(e.target.value.toUpperCase())} placeholder="ABC" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Number</Label>
                <Input value={band4} onChange={(e) => setBand4(e.target.value)} placeholder="1234" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Code Masked</Label>
              <Input value={codeMasked} onChange={(e) => setCodeMasked(e.target.value)} placeholder="e.g. AU-0-F2-03" />
            </div>
          </Section>

          <Section title="Bird">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={birdName} onChange={(e) => setBirdName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Gender</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Unknown</SelectItem>
                    <SelectItem value="1">Cock</SelectItem>
                    <SelectItem value="2">Hen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Color</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger><SelectValue placeholder="Color" /></SelectTrigger>
                  <SelectContent>
                    {COLORS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">RFID</Label>
              <Input value={rfid} onChange={(e) => setRfid(e.target.value)} placeholder="RFID tag" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Father (band)</Label>
                <Input value={fatherBand} onChange={(e) => setFatherBand(e.target.value)} placeholder="AU-25-ABC-1234" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Mother (band)</Label>
                <Input value={motherBand} onChange={(e) => setMotherBand(e.target.value)} placeholder="AU-25-ABC-1234" />
              </div>
            </div>
          </Section>

          <Section title="Status">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="active" checked={isActive} onCheckedChange={(c) => setIsActive(c as boolean)} />
                <Label htmlFor="active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="lost" checked={isLost} onCheckedChange={(c) => setIsLost(c as boolean)} />
                <Label htmlFor="lost">Lost</Label>
              </div>
            </div>
            {isLost && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Lost Date</Label>
                  <Input type="date" value={lostDate} onChange={(e) => setLostDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Lost Race ID</Label>
                  <Input value={lostRaceId} onChange={(e) => setLostRaceId(e.target.value)} placeholder="Race ID" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Health</Label>
                <select
                  value={healthStatus}
                  onChange={(e) => setHealthStatus(e.target.value as BirdHealthStatus)}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="HEALTHY">Healthy</option>
                  <option value="INJURED">Injured</option>
                  <option value="HOSPITALIZED">Hospitalized</option>
                  <option value="DEAD">Dead</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Health note</Label>
                <Input value={healthNote} onChange={(e) => setHealthNote(e.target.value)} maxLength={1000} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="public" checked={isPublic} onCheckedChange={(c) => setIsPublic(c as boolean)} />
              <Label htmlFor="public">Public profile</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="attention" checked={attention} onCheckedChange={(c) => setAttention(c as boolean)} />
              <Label htmlFor="attention">Pay attention during basketing</Label>
            </div>
          </Section>
        </div>

        <Section title="Notes">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-sm border rounded-md p-2 min-h-[70px] resize-y"
          />
        </Section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
